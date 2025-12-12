"""
Inspect processing quality for chunks, embeddings, and findings.

Usage:
    python3 -m src.scripts.inspect_processing_quality <document_id>
    python3 -m src.scripts.inspect_processing_quality --latest

This script helps evaluate:
1. Chunking quality - token counts, overlap, coverage
2. Embedding quality - dimension check, similarity patterns
3. Finding extraction quality - coverage, relevance, confidence
"""

import asyncio
import sys
from typing import Any, Optional
from uuid import UUID

import structlog

from src.storage.supabase_client import get_supabase_client

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger(__name__)


async def inspect_document_processing(document_id: UUID) -> None:
    """
    Inspect processing quality for a document.

    Args:
        document_id: UUID of the document to inspect
    """
    db = get_supabase_client()

    # Get document info
    doc = await db.get_document(document_id)
    if not doc:
        logger.error("Document not found", document_id=str(document_id))
        return

    print("\n" + "="*80)
    print(f"PROCESSING QUALITY REPORT: {doc['name']}")
    print("="*80 + "\n")

    # 1. CHUNKING ANALYSIS
    print("📄 CHUNKING ANALYSIS")
    print("-" * 80)

    chunks = await db.get_chunks_by_document(document_id)

    if not chunks:
        print("❌ No chunks found for this document")
    else:
        token_counts = [c.get('token_count', 0) for c in chunks]
        chunk_types = {}
        for c in chunks:
            chunk_type = c.get('chunk_type', 'unknown')
            chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1

        embeddings_present = sum(1 for c in chunks if c.get('has_embedding', False))

        print(f"Total chunks: {len(chunks)}")
        print(f"Chunk types: {dict(chunk_types)}")
        print(f"Token count stats:")
        print(f"  - Min: {min(token_counts) if token_counts else 0}")
        print(f"  - Max: {max(token_counts) if token_counts else 0}")
        print(f"  - Avg: {sum(token_counts) / len(token_counts) if token_counts else 0:.0f}")
        print(f"  - Total: {sum(token_counts)}")
        print(f"Embeddings: {embeddings_present}/{len(chunks)} chunks ({embeddings_present/len(chunks)*100:.1f}%)")

        # Show sample chunks
        print("\nSample chunks (first 3):")
        for i, chunk in enumerate(chunks[:3]):
            content_preview = chunk.get('content', '')[:100]
            print(f"\n  Chunk {i+1} (index={chunk.get('chunk_index')}, type={chunk.get('chunk_type')}):")
            print(f"    Tokens: {chunk.get('token_count')}")
            print(f"    Content: {content_preview}...")
            if chunk.get('page_number'):
                print(f"    Page: {chunk.get('page_number')}")

    # 2. EMBEDDING QUALITY
    print("\n\n🔍 EMBEDDING ANALYSIS")
    print("-" * 80)

    if embeddings_present == 0:
        print("❌ No embeddings found for this document")
    else:
        print(f"✓ {embeddings_present} chunks have embeddings")
        print(f"  Coverage: {embeddings_present/len(chunks)*100:.1f}%")

        # Test semantic search with a sample query
        if embeddings_present > 0:
            print("\nTesting semantic search capability...")
            # Use first chunk's content as a test query
            test_query = chunks[0].get('content', '')[:100]
            print(f"  Test query (from first chunk): '{test_query}...'")

            # Note: We'd need to generate embedding for the query to test similarity
            # This is a placeholder - actual implementation would need the embedding service
            print("  ℹ️  Semantic search test requires embedding service (skipped)")

    # 3. FINDING EXTRACTION QUALITY
    print("\n\n💡 FINDING EXTRACTION ANALYSIS")
    print("-" * 80)

    findings = await db.get_findings_by_document(document_id)

    if not findings:
        print("❌ No findings extracted for this document")
    else:
        # Group by type and domain
        by_type = {}
        by_domain = {}
        confidences = []

        for f in findings:
            ftype = f.get('finding_type', 'unknown')
            domain = f.get('domain', 'unknown')
            confidence = f.get('confidence', 0.0)

            by_type[ftype] = by_type.get(ftype, 0) + 1
            by_domain[domain] = by_domain.get(domain, 0) + 1
            confidences.append(confidence)

        print(f"Total findings: {len(findings)}")
        print(f"\nBy type:")
        for ftype, count in sorted(by_type.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {ftype}: {count} ({count/len(findings)*100:.1f}%)")

        print(f"\nBy domain:")
        for domain, count in sorted(by_domain.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {domain}: {count} ({count/len(findings)*100:.1f}%)")

        print(f"\nConfidence scores:")
        print(f"  - Min: {min(confidences):.2f}")
        print(f"  - Max: {max(confidences):.2f}")
        print(f"  - Avg: {sum(confidences)/len(confidences):.2f}")

        # Show sample findings
        print("\nSample findings (top 3 by confidence):")
        sorted_findings = sorted(findings, key=lambda f: f.get('confidence', 0), reverse=True)
        for i, finding in enumerate(sorted_findings[:3]):
            print(f"\n  Finding {i+1}:")
            print(f"    Type: {finding.get('finding_type')}")
            print(f"    Domain: {finding.get('domain')}")
            print(f"    Confidence: {finding.get('confidence', 0):.2f}")
            text = finding.get('text', '')[:150]
            print(f"    Text: {text}...")

    # 4. OVERALL QUALITY METRICS
    print("\n\n📊 OVERALL QUALITY METRICS")
    print("-" * 80)

    # Calculate coverage ratio
    if chunks:
        findings_per_chunk = len(findings) / len(chunks) if chunks else 0
        print(f"Findings per chunk: {findings_per_chunk:.2f}")

        if findings_per_chunk < 0.1:
            print("  ⚠️  Low extraction rate - consider reviewing LLM prompts")
        elif findings_per_chunk > 2.0:
            print("  ⚠️  High extraction rate - may have duplicate/overlapping findings")
        else:
            print("  ✓ Extraction rate looks reasonable")

    # Check embedding coverage
    if chunks:
        embedding_coverage = embeddings_present / len(chunks)
        if embedding_coverage < 1.0:
            print(f"⚠️  Incomplete embeddings: {embedding_coverage*100:.1f}% coverage")
        else:
            print("✓ All chunks have embeddings")

    # Check finding confidence
    if findings and confidences:
        avg_confidence = sum(confidences) / len(confidences)
        if avg_confidence < 0.5:
            print(f"⚠️  Low average confidence: {avg_confidence:.2f}")
        else:
            print(f"✓ Good average confidence: {avg_confidence:.2f}")

    print("\n" + "="*80 + "\n")


async def get_latest_document() -> Optional[UUID]:
    """Get the most recently processed document."""
    db = get_supabase_client()
    pool = await db._get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id FROM documents
            WHERE processing_status = 'analyzed'
            ORDER BY updated_at DESC
            LIMIT 1
            """
        )

        return row['id'] if row else None


async def main() -> None:
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 -m src.scripts.inspect_processing_quality <document_id>")
        print("  python3 -m src.scripts.inspect_processing_quality --latest")
        sys.exit(1)

    if sys.argv[1] == "--latest":
        document_id = await get_latest_document()
        if not document_id:
            logger.error("No analyzed documents found")
            sys.exit(1)
        logger.info("Using latest document", document_id=str(document_id))
    else:
        try:
            document_id = UUID(sys.argv[1])
        except ValueError:
            logger.error("Invalid document ID format", input=sys.argv[1])
            sys.exit(1)

    await inspect_document_processing(document_id)


if __name__ == "__main__":
    asyncio.run(main())
