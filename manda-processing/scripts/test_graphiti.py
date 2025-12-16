#!/usr/bin/env python3
"""
Graphiti Smoke Test Script
Story: E10.1 - Graphiti Infrastructure Setup (AC: #5)

This script verifies that Graphiti is correctly configured and working:
1. Episode ingestion test
2. Graph query test
3. Group_id isolation test (deal A returns nothing from deal B)

Prerequisites:
    1. Neo4j running: docker compose up neo4j -d
    2. Environment variables set (see .env.example)

Usage:
    cd manda-processing
    python scripts/test_graphiti.py

Expected output:
    ✓ Neo4j connection successful
    ✓ Episode ingestion successful
    ✓ Graph query successful
    ✓ Group_id isolation verified
    All smoke tests passed!
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from uuid import uuid4

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.graphiti.client import GraphitiClient, GraphitiConnectionError


async def test_connection() -> bool:
    """Test basic Neo4j connection via Graphiti."""
    print("\n--- Test 1: Neo4j Connection ---")
    try:
        client = await GraphitiClient.get_instance()
        print("✓ Neo4j connection successful")
        return True
    except GraphitiConnectionError as e:
        print(f"✗ Connection failed: {e}")
        return False


async def test_episode_ingestion(deal_id: str) -> bool:
    """Test adding an episode to the graph."""
    print("\n--- Test 2: Episode Ingestion ---")

    test_content = """
    TechCorp Inc. Annual Financial Report 2024

    Revenue: $150 million (up 15% YoY)
    Net Income: $25 million
    Employee Count: 500

    Key Developments:
    - Launched new AI product line generating $20M in Q4
    - Acquired DataSmart for $30M in January 2024
    - CEO John Smith announced expansion to European markets
    """

    try:
        await GraphitiClient.add_episode(
            deal_id=deal_id,
            content=test_content,
            name="techcorp-annual-report-2024.pdf",
            source_description="TechCorp Inc. Annual Financial Report for fiscal year 2024",
            reference_time=datetime(2024, 12, 15, tzinfo=timezone.utc),
        )
        print("✓ Episode ingestion successful")
        return True
    except GraphitiConnectionError as e:
        print(f"✗ Episode ingestion failed: {e}")
        return False


async def test_graph_query(deal_id: str) -> bool:
    """Test querying the graph."""
    print("\n--- Test 3: Graph Query ---")

    try:
        results = await GraphitiClient.search(
            deal_id=deal_id,
            query="What is the company's revenue?",
            num_results=5,
        )

        if results:
            print(f"✓ Graph query successful ({len(results)} results)")
            for i, result in enumerate(results[:3], 1):
                # Display first 3 results
                result_str = str(result)[:100] + "..." if len(str(result)) > 100 else str(result)
                print(f"  Result {i}: {result_str}")
        else:
            print("✓ Graph query successful (no results - may need more episodes)")

        return True
    except GraphitiConnectionError as e:
        print(f"✗ Graph query failed: {e}")
        return False


async def test_group_id_isolation(deal_a_id: str, deal_b_id: str) -> bool:
    """Test that group_id provides proper isolation between deals."""
    print("\n--- Test 4: Group ID Isolation ---")

    # Add content to Deal B
    deal_b_content = """
    AcmeCorp Private Information - Deal B Only
    Secret revenue: $500 million
    Acquisition target: MegaInc for $200M
    """

    try:
        # Add episode to Deal B
        await GraphitiClient.add_episode(
            deal_id=deal_b_id,
            content=deal_b_content,
            name="acme-secret-doc.pdf",
            source_description="Confidential AcmeCorp document",
        )

        # Query Deal A for Deal B's content
        results_a = await GraphitiClient.search(
            deal_id=deal_a_id,
            query="AcmeCorp secret revenue",
            num_results=10,
        )

        # Query Deal B for Deal B's content
        results_b = await GraphitiClient.search(
            deal_id=deal_b_id,
            query="AcmeCorp secret revenue",
            num_results=10,
        )

        # Verify isolation: Deal A should NOT see Deal B's data
        # Note: We can't guarantee zero results from Deal A due to potential
        # semantic similarity, but results should be different

        if results_b:
            print(f"✓ Deal B query found {len(results_b)} results (expected)")
        else:
            print("⚠ Deal B query found no results (may need more episodes)")

        # Check if Deal A results contain Deal B specific content
        deal_a_str = str(results_a).lower() if results_a else ""
        has_leak = "acmecorp" in deal_a_str or "secret" in deal_a_str

        if not has_leak:
            print("✓ Group_id isolation verified (Deal A cannot see Deal B data)")
            return True
        else:
            print("✗ Group_id isolation FAILED - Deal A may see Deal B data")
            return False

    except GraphitiConnectionError as e:
        print(f"✗ Isolation test failed: {e}")
        return False


async def main():
    """Run all smoke tests."""
    print("=" * 60)
    print("Graphiti Smoke Test - E10.1")
    print("=" * 60)

    # Generate unique deal IDs for test isolation
    deal_a_id = f"smoke-test-deal-a-{uuid4().hex[:8]}"
    deal_b_id = f"smoke-test-deal-b-{uuid4().hex[:8]}"

    print(f"\nTest Deal A ID: {deal_a_id}")
    print(f"Test Deal B ID: {deal_b_id}")

    all_passed = True

    # Test 1: Connection
    if not await test_connection():
        print("\n" + "=" * 60)
        print("SMOKE TEST FAILED: Cannot connect to Neo4j")
        print("Make sure Neo4j is running: docker compose up neo4j -d")
        print("=" * 60)
        await GraphitiClient.close()
        return 1

    # Test 2: Episode Ingestion
    if not await test_episode_ingestion(deal_a_id):
        all_passed = False

    # Test 3: Graph Query
    if not await test_graph_query(deal_a_id):
        all_passed = False

    # Test 4: Group ID Isolation
    if not await test_group_id_isolation(deal_a_id, deal_b_id):
        all_passed = False

    # Cleanup
    await GraphitiClient.close()

    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ All smoke tests passed!")
        print("=" * 60)
        return 0
    else:
        print("✗ Some smoke tests failed")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
