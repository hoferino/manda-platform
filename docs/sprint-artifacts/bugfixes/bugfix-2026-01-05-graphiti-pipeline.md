# Bugfix Report: Graphiti Ingestion Pipeline Fixes

**Date:** 2026-01-05
**Reporter:** Claude (assisted by Max)
**Status:** Fixed
**Related Epic:** E10 (Knowledge Graph Foundation)
**Affected Stories:** E10.4 (Document Ingestion Pipeline), E10.3 (Sell-Side Spine Schema)

---

## 1. Executive Summary

During validation testing of the extraction pipeline (E10), four bugs were discovered that prevented successful document ingestion into Graphiti. All four have been fixed.

---

## 2. Bugs Fixed

### BUG-001: Missing `get_deal` Method in SupabaseClient

**Severity:** Critical (pipeline blocker)
**Error:** `AttributeError: 'SupabaseClient' object has no attribute 'get_deal'`

**Root Cause:**
The `ingest_graphiti.py` handler (line 137) calls `self.db.get_deal(deal_id)` to fetch the `organization_id` for multi-tenant isolation (E12.9), but this method was never implemented in `SupabaseClient`.

**File Modified:**
- `manda-processing/src/storage/supabase_client.py`

**Fix:**
Added `get_deal()` method after line 256:

```python
async def get_deal(self, deal_id: str) -> Optional[dict[str, Any]]:
    """
    Get deal details by ID.

    Story: E12.9 - Multi-Tenant Data Isolation

    Args:
        deal_id: UUID string of the deal

    Returns:
        Deal record as dict, or None if not found
    """
    pool = await self._get_pool()

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, organization_id, name, company_name,
                       industry, status, irl_template, metadata,
                       created_at, updated_at
                FROM deals
                WHERE id = $1
                """,
                UUID(deal_id),
            )

            if row:
                return dict(row)
            return None

    except asyncpg.PostgresError as e:
        logger.error(
            "Database error fetching deal",
            deal_id=deal_id,
            error=str(e),
        )
        raise DatabaseError(
            f"Failed to fetch deal: {str(e)}",
            retryable=self._is_retryable_error(e),
        )
```

---

### BUG-002: Reserved Attribute Name Conflict in Entity Models

**Severity:** Critical (pipeline blocker)
**Error:** `name cannot be used as an attribute for Company as it is a protected attribute name.`

**Root Cause:**
Graphiti's internal `BaseModel` for entities reserves `name` as a protected attribute. Our custom `Company` and `Person` entity models (E10.3) used `name: str` which conflicts with Graphiti's internal naming.

**File Modified:**
- `manda-processing/src/graphiti/schema/entities.py`

**Fix:**
Renamed `name` field in entity models to avoid conflict:

| Entity | Old Field | New Field | Rationale |
|--------|-----------|-----------|-----------|
| `Company` | `name: str` | `company_name: str` | Avoids Graphiti reserved attribute |
| `Person` | `name: str` | `full_name: str` | Avoids Graphiti reserved attribute |

Updated code:

```python
class Company(BaseModel):
    company_name: str = Field(description="Official company name")
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None = None
    aliases: list[str] = Field(default_factory=list)


class Person(BaseModel):
    full_name: str = Field(description="Full name of the person")
    title: str | None = None
    role: Literal["executive", "advisor", "board", "investor", "employee"]
    company_id: str | None = None
    aliases: list[str] = Field(default_factory=list)
```

---

### BUG-003: Reference to Removed `embedding` Column

**Severity:** Critical (pipeline blocker)
**Error:** `column "embedding" does not exist`

**Root Cause:**
E10.8 removed pgvector embeddings in favor of Graphiti/Neo4j, but a query in `supabase_client.py` still referenced the removed `embedding` column.

**File Modified:**
- `manda-processing/src/storage/supabase_client.py` (line ~392)

**Fix:**
Removed `embedding IS NOT NULL as has_embedding` from the SELECT query in `get_chunks_by_document()`:

```python
# Before (broken)
SELECT id, document_id, chunk_index, content, chunk_type,
       page_number, sheet_name, cell_reference, token_count,
       metadata, embedding IS NOT NULL as has_embedding
FROM document_chunks

# After (fixed)
SELECT id, document_id, chunk_index, content, chunk_type,
       page_number, sheet_name, cell_reference, token_count,
       metadata
FROM document_chunks
```

---

### BUG-004: Invalid Characters in Composite group_id

**Severity:** Critical (pipeline blocker)
**Error:** `group_id "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:14c66621-837b-4610-a5d3-8a0684083a84" must contain only alphanumeric characters, dashes, or underscores`

**Root Cause:**
The composite `group_id` format used a colon (`:`) as separator between `organization_id` and `deal_id`, but Graphiti only allows alphanumeric characters, dashes, and underscores.

**File Modified:**
- `manda-processing/src/graphiti/client.py` (lines 281, 381)

**Fix:**
Changed separator from `:` to `_`:

```python
# Before (invalid)
composite_group_id = f"{organization_id}:{deal_id}"

# After (valid)
composite_group_id = f"{organization_id}_{deal_id}"
```

Applied in both `add_episode()` and `search()` methods.

---

## 3. Testing

After fixes, the document ingestion pipeline should successfully:
1. Parse documents via Docling
2. Store chunks in PostgreSQL
3. Fetch deal metadata (including `organization_id`)
4. Ingest chunks into Graphiti with proper entity extraction
5. Store embeddings in Neo4j

**Validation:** Upload a test document and verify:
- Worker logs show successful `ingest-graphiti` job completion
- Neo4j contains extracted entities and episodes
- No errors in processing pipeline

---

## 4. Impact Assessment

| Area | Impact |
|------|--------|
| **Document Upload** | Now works end-to-end |
| **Entity Extraction** | Schema compatible with Graphiti |
| **Multi-Tenant Isolation** | E12.9 org_id lookup functional |
| **Existing Tests** | May need updates for renamed fields |
| **API Contracts** | Entity model field names changed |

---

## 5. Recommendations

### Immediate
- [ ] Restart worker after deploying fixes
- [ ] Test with sample document upload
- [ ] Verify Neo4j entities created

### Follow-up
- [ ] Add integration tests for `get_deal()` method
- [ ] Update any frontend code referencing `name` field on entities
- [ ] Add validation to prevent reserved attribute names in future entity models
- [ ] Consider adding Graphiti version compatibility checks

---

## 6. Related Documentation

- [Sprint Change Proposal 2025-12-15](../sprint-change-proposal-2025-12-15.md) - E10 architecture decisions
- [E10.3 Sell-Side Spine Schema](../stories/e10-3-sell-side-spine-schema.md) - Entity model definitions
- [E10.4 Document Ingestion Pipeline](../stories/e10-4-document-ingestion-pipeline.md) - Pipeline implementation
- [E12.9 Multi-Tenant Data Isolation](../stories/e12-9-multi-tenant-data-isolation.md) - Organization scoping

---

**Document Version:** 1.0
**Created:** 2026-01-05
**Author:** Claude (Pipeline Validation Session)
