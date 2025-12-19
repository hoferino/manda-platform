#!/usr/bin/env python3
"""
Neo4j group_id migration script for E12.9 Multi-Tenant Data Isolation.

This script migrates existing Graphiti data from deal-only group_ids
to composite "{organization_id}:{deal_id}" format for multi-tenant isolation.

Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

Usage:
    python scripts/migrate_graphiti_group_ids.py

Requirements:
    - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables
    - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY for deal->org mapping
    - Run AFTER Supabase migrations (00042-00044) have been applied

What this script does:
    1. Fetches all deals with their organization_ids from Supabase
    2. For each unique group_id in Neo4j that matches a deal_id:
       - Updates to composite format "{org_id}:{deal_id}"
       - Updates on all Entity, Fact, Episode, and Relationship nodes
    3. Reports migration statistics

Safety:
    - Idempotent: Can be run multiple times safely
    - Already-migrated data (contains ":") is skipped
    - Dry-run mode available for verification
"""

import asyncio
import os
import sys
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def migrate_graphiti_group_ids(dry_run: bool = False) -> dict:
    """
    Migrate Neo4j group_ids to composite organization:deal format.

    Args:
        dry_run: If True, only report what would be done without making changes

    Returns:
        Dict with migration statistics
    """
    from neo4j import AsyncGraphDatabase
    from supabase import create_client

    # Load settings
    neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not neo4j_password:
        raise ValueError("NEO4J_PASSWORD environment variable required")
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

    print(f"🔄 Starting group_id migration (dry_run={dry_run})")
    print(f"   Neo4j: {neo4j_uri}")
    print(f"   Supabase: {supabase_url[:50]}...")

    stats = {
        "deals_found": 0,
        "group_ids_updated": 0,
        "entities_updated": 0,
        "facts_updated": 0,
        "episodes_updated": 0,
        "edges_updated": 0,
        "already_migrated": 0,
        "orphaned_group_ids": [],
        "errors": [],
    }

    # Step 1: Fetch deal -> organization mapping from Supabase
    print("\n📋 Fetching deal->organization mapping from Supabase...")
    supabase = create_client(supabase_url, supabase_key)

    result = supabase.table("deals").select("id, organization_id").execute()
    deal_org_map = {str(d["id"]): str(d["organization_id"]) for d in result.data if d.get("organization_id")}
    stats["deals_found"] = len(deal_org_map)
    print(f"   Found {len(deal_org_map)} deals with organization_id")

    if not deal_org_map:
        print("⚠️  No deals found with organization_id. Run Supabase migrations first.")
        return stats

    # Step 2: Connect to Neo4j and find all unique group_ids
    print("\n🔍 Scanning Neo4j for group_ids to migrate...")

    driver = AsyncGraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))

    async with driver.session() as session:
        # Find all unique group_ids in the database
        query = """
        MATCH (n)
        WHERE n.group_id IS NOT NULL
        RETURN DISTINCT n.group_id as group_id, labels(n) as labels
        """
        result = await session.run(query)
        records = [record async for record in result]

        unique_group_ids = set()
        for record in records:
            group_id = record["group_id"]
            if group_id:
                unique_group_ids.add(group_id)

        print(f"   Found {len(unique_group_ids)} unique group_ids")

        # Step 3: Process each group_id
        for group_id in unique_group_ids:
            # Skip already-migrated (contains ":")
            if ":" in group_id:
                stats["already_migrated"] += 1
                continue

            # Check if this is a valid deal_id with org mapping
            if group_id not in deal_org_map:
                stats["orphaned_group_ids"].append(group_id)
                continue

            org_id = deal_org_map[group_id]
            new_group_id = f"{org_id}:{group_id}"

            print(f"\n   Migrating: {group_id[:8]}... → {new_group_id[:20]}...")

            if dry_run:
                # Count what would be updated
                count_query = """
                MATCH (n {group_id: $old_group_id})
                RETURN labels(n) as labels, count(n) as cnt
                """
                result = await session.run(count_query, old_group_id=group_id)
                async for record in result:
                    label = record["labels"][0] if record["labels"] else "Unknown"
                    count = record["cnt"]
                    print(f"      Would update {count} {label} nodes")
            else:
                # Actually update the group_ids
                update_query = """
                MATCH (n {group_id: $old_group_id})
                SET n.group_id = $new_group_id
                RETURN labels(n) as labels, count(n) as cnt
                """
                result = await session.run(
                    update_query,
                    old_group_id=group_id,
                    new_group_id=new_group_id,
                )
                async for record in result:
                    label = record["labels"][0] if record["labels"] else "Unknown"
                    count = record["cnt"]
                    print(f"      Updated {count} {label} nodes")

                    # Track by type
                    if "Entity" in label:
                        stats["entities_updated"] += count
                    elif "Fact" in label:
                        stats["facts_updated"] += count
                    elif "Episode" in label:
                        stats["episodes_updated"] += count
                    else:
                        stats["edges_updated"] += count

            stats["group_ids_updated"] += 1

    await driver.close()

    # Print summary
    print("\n" + "=" * 60)
    print("📊 Migration Summary")
    print("=" * 60)
    print(f"   Deals found in Supabase:    {stats['deals_found']}")
    print(f"   Group IDs migrated:         {stats['group_ids_updated']}")
    print(f"   Already migrated (skipped): {stats['already_migrated']}")
    print(f"   Entities updated:           {stats['entities_updated']}")
    print(f"   Facts updated:              {stats['facts_updated']}")
    print(f"   Episodes updated:           {stats['episodes_updated']}")
    print(f"   Edges updated:              {stats['edges_updated']}")

    if stats["orphaned_group_ids"]:
        print(f"\n⚠️  Orphaned group_ids (no matching deal): {len(stats['orphaned_group_ids'])}")
        for gid in stats["orphaned_group_ids"][:5]:
            print(f"      - {gid}")
        if len(stats["orphaned_group_ids"]) > 5:
            print(f"      ... and {len(stats['orphaned_group_ids']) - 5} more")

    if dry_run:
        print("\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply.")
    else:
        print("\n✅ Migration complete!")

    return stats


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate Neo4j group_ids to composite org:deal format"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be done without making changes",
    )
    args = parser.parse_args()

    asyncio.run(migrate_graphiti_group_ids(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
