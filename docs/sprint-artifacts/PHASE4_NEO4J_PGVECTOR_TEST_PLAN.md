# Phase 4 & 5 Testing Plan: Neo4j & pgvector Hybrid Search

**Date**: 2025-12-12
**Testing Scope**: Knowledge Graph + Vector Search + Hybrid Retrieval

---

## Overview

Based on the code exploration, the system implements a sophisticated **multi-layer hybrid search**:

1. **pgvector** (PostgreSQL): Semantic similarity search on embeddings
2. **Neo4j**: Knowledge graph with Finding nodes and relationships
3. **Agent Tools**: LangChain-based orchestration with 4 knowledge tools
4. **Temporal Awareness**: Time-based conflict detection and supersession
5. **Contradiction Detection**: LLM-powered finding comparison

---

## Current Status

### ✅ Already Working (Phases 1-3 Complete):
- Document upload → GCS storage
- Docling parsing → chunks in `document_chunks` table
- OpenAI embeddings → 3072-dim vectors in pgvector column
- Documents visible in UI immediately

### 🔄 To Test (Phases 4-5):
- **analyze-document job** → Finding extraction and Neo4j node creation
- **pgvector semantic search** → Query embeddings and similarity ranking
- **Neo4j graph queries** → Relationship traversal (CONTRADICTS, SUPPORTS, SUPERSEDES)
- **detect-contradictions job** → LLM-based contradiction detection
- **Agent tools** → Hybrid search orchestration

---

## Testing Architecture

### Post-Embedding Pipeline Flow

```
[Current Status: embedded]
    ↓
[analyze-document job] ← WE ARE HERE
    ├─ Load chunks with embeddings
    ├─ Analyze with Gemini 2.5 Pro (requires GOOGLE_API_KEY)
    ├─ Extract findings:
    │   - Type: metric, fact, risk, opportunity
    │   - Domain: financial, operational, market, legal, technical
    │   - Confidence score (0-1)
    ├─ Store findings in Supabase with embeddings
    ├─ Create Finding nodes in Neo4j
    └─ Enqueue next jobs:
        ├─ extract-financials (if Excel/PDF+tables)
        └─ detect-contradictions (always)
    ↓
[detect-contradictions job]
    ├─ Fetch all findings for deal
    ├─ Group by domain
    ├─ Pre-filter pairs (min similarity: 0.6)
    ├─ LLM comparison (Gemini 2.5 Pro)
    ├─ Store contradictions (70% threshold)
    └─ Create CONTRADICTS relationships in Neo4j
    ↓
[Knowledge Graph Complete]
    ├─ Findings in Supabase + pgvector
    ├─ Neo4j graph with relationships
    └─ Ready for hybrid search
```

---

## Phase 4: Neo4j Knowledge Graph Testing

### Prerequisites

1. **Neo4j Running**: ✅ Already running on port 7687
2. **Google API Key**: ⚠️ Required for analyze-document job
3. **Document with Findings**: ✅ Already have embedded document

### Test 4.1: Enable Document Analysis

**Action**: Add Google API key to enable analyze-document job

**Steps**:
```bash
# Add to manda-processing/.env
echo "GOOGLE_API_KEY=your-gemini-api-key-here" >> manda-processing/.env

# Restart worker to load new env variable
cd manda-processing
pkill -9 python3
sleep 2
python3 -m src.jobs > worker.log 2>&1 &
```

**Expected**: analyze-document job will retry and succeed

**Verification**:
```bash
# Monitor worker log
tail -f manda-processing/worker.log | grep -E "(analyze-document|Finding|Neo4j)"
```

**Success Criteria**:
- Job completes without Google API key error
- Findings extracted and stored in Supabase `findings` table
- Finding nodes created in Neo4j
- detect-contradictions job enqueued

---

### Test 4.2: Verify Neo4j Connection

**Action**: Test Neo4j connectivity from Next.js app

**Steps**:
```bash
# Check Neo4j is running
docker ps | grep neo4j

# Test connection from Next.js
cd manda-app
node -e "
const { createClient } = require('./lib/neo4j/client.ts');
const client = createClient();
client.verifyConnectivity().then(() => {
  console.log('✅ Neo4j connected');
  client.close();
}).catch(err => {
  console.error('❌ Neo4j connection failed:', err);
});
"
```

**Expected**: "✅ Neo4j connected"

**Success Criteria**:
- Neo4j driver connects successfully
- No authentication errors
- Database is writable

---

### Test 4.3: Verify Finding Nodes in Neo4j

**Action**: Query Neo4j for Finding nodes created by analyze-document job

**Steps**:
```cypher
# Connect to Neo4j browser: http://localhost:7474
# Run query:
MATCH (f:Finding)
WHERE f.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
RETURN f
LIMIT 10
```

**Alternative (CLI)**:
```bash
docker exec -it <neo4j-container-id> cypher-shell -u neo4j -p mandadev123
```

**Expected Results**:
- Finding nodes with properties:
  - `id`: UUID
  - `text`: Finding content
  - `confidence`: 0.0 - 1.0
  - `category`: metric/fact/risk/opportunity
  - `domain`: financial/operational/market/legal/technical
  - `deal_id`: Project ID
  - `source_document_id`: Document ID

**Success Criteria**:
- At least 1 Finding node exists
- Properties are correctly populated
- deal_id matches test document

---

### Test 4.4: Verify EXTRACTED_FROM Relationships

**Action**: Verify findings are linked to source documents

**Steps**:
```cypher
MATCH (f:Finding)-[r:EXTRACTED_FROM]->(d:Document)
WHERE f.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
RETURN f.text AS finding, d.name AS document, r.page AS page
LIMIT 10
```

**Expected Results**:
- EXTRACTED_FROM relationships exist
- Relationship properties include:
  - `page`: Page number (for PDFs)
  - `extracted_at`: Timestamp

**Success Criteria**:
- Each Finding has EXTRACTED_FROM → Document relationship
- Source attribution is correct

---

### Test 4.5: Verify Contradiction Detection

**Action**: Upload a second document with contradictory information

**Preparation**:
```markdown
# Create test document: contradictory-revenue.pdf
Content: "Company reported $50M revenue in Q1 2024"

# First document should say different revenue number
# This will trigger contradiction detection
```

**Steps**:
1. Upload contradictory-revenue.pdf via UI
2. Wait for processing to complete
3. Monitor worker log for detect-contradictions job
4. Query Neo4j for CONTRADICTS relationships

**Cypher Query**:
```cypher
MATCH (f1:Finding)-[r:CONTRADICTS]->(f2:Finding)
WHERE f1.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
RETURN
  f1.text AS finding1,
  f2.text AS finding2,
  r.reason AS reason,
  r.confidence AS confidence,
  r.detected_at AS detected_at
```

**Expected Results**:
- CONTRADICTS relationship created
- `r.confidence` >= 0.70 (70% threshold)
- `r.reason` explains the contradiction
- `r.detected_at` timestamp present

**Success Criteria**:
- Contradictory findings are detected
- Relationship has high confidence score
- Reason is meaningful

---

## Phase 5: pgvector Semantic Search Testing

### Test 5.1: Direct pgvector Search (Python API)

**Action**: Test vector similarity search via Python backend

**Steps**:
```bash
# Search for similar chunks
curl -X GET "http://localhost:8000/api/search/similar?query=revenue&project_id=863d2224-4f3a-45df-af22-f1068211fdc8&limit=5" \
  -H "X-API-Key: 2ea8e1894d889433c5c82161cd3a15ffe083e7d688f41f9ab847cec7babe5384" \
  | python3 -m json.tool
```

**Expected Response**:
```json
{
  "results": [
    {
      "chunk_id": "...",
      "document_id": "...",
      "content": "Revenue-related text...",
      "document_name": "brainstorming-session-results.pdf",
      "similarity": 0.85,
      "chunk_type": "text",
      "page_number": 1
    }
  ],
  "total": 1,
  "query": "revenue"
}
```

**Success Criteria**:
- Results returned sorted by similarity (highest first)
- Similarity scores between 0.0 and 1.0
- Content is relevant to query
- Response time < 500ms

---

### Test 5.2: Findings Search (Supabase RPC)

**Action**: Test match_findings() RPC function

**Steps**:
```typescript
// In Next.js console or API route
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings/openai'

const supabase = createClient()
const query = "What are the key financial metrics?"
const embedding = await generateEmbedding(query)

const { data, error } = await supabase.rpc('match_findings', {
  query_embedding: JSON.stringify(embedding),
  match_threshold: 0.5,
  match_count: 5,
  p_deal_id: '863d2224-4f3a-45df-af22-f1068211fdc8'
})

console.log('Findings:', data)
```

**Expected Results**:
- Findings ordered by similarity
- Each finding includes:
  - `id`, `text`, `confidence`, `category`, `domain`
  - `similarity` score
  - `source_document_id`

**Success Criteria**:
- Results are semantically relevant
- Similarity scores make sense
- Deal filtering works correctly

---

### Test 5.3: Agent Tool Testing (Hybrid Search)

**Action**: Test the `query_knowledge_base` agent tool

**Prerequisites**:
- Agent system must be set up
- LLM API key configured (OpenAI/Anthropic)

**Steps**:
```typescript
// Use agent via API or SDK
const result = await agent.run({
  tools: ['query_knowledge_base'],
  query: "What are the company's revenue figures?",
  dealId: '863d2224-4f3a-45df-af22-f1068211fdc8'
})
```

**Expected Behavior**:
1. Tool detects query mode (fact vs research)
2. Generates query embedding
3. Calls `match_findings()` with appropriate threshold
4. Returns formatted findings with similarity scores
5. Agent synthesizes response

**Success Criteria**:
- Query mode detection works (fact = 0.5 threshold, research = 0.3)
- Results are filtered by dealId
- Agent provides coherent answer citing findings

---

### Test 5.4: Temporal Conflict Detection (validate_finding tool)

**Action**: Test temporal-aware contradiction checking

**Steps**:
```typescript
// Validate a new finding against historical data
await agent.run({
  tools: ['validate_finding'],
  finding: {
    text: "Revenue for Q1 2024 was $75M",
    dateReferenced: "2024-03-31", // Q1 2024
    domain: "financial"
  },
  dealId: '863d2224-4f3a-45df-af22-f1068211fdc8'
})
```

**Expected Behavior**:
1. Generates embedding for new finding
2. Searches for similar findings via `match_findings()`
3. Filters results to same fiscal quarter (Q1 2024)
4. Checks for contradictions only within temporal context
5. Returns validation result with conflicting findings (if any)

**Success Criteria**:
- Only compares findings from same time period
- Doesn't flag contradictions from different quarters
- Identifies real conflicts accurately

---

### Test 5.5: Knowledge Graph Update (update_knowledge_graph tool)

**Action**: Test creating relationships between findings

**Steps**:
```typescript
// Create SUPPORTS relationship
await agent.run({
  tools: ['update_knowledge_graph'],
  source_finding_id: '<finding-1-id>',
  target_finding_id: '<finding-2-id>',
  relationship_type: 'SUPPORTS',
  metadata: {
    strength: 0.9,
    detected_at: new Date().toISOString()
  }
})
```

**Verification (Neo4j)**:
```cypher
MATCH (f1:Finding)-[r:SUPPORTS]->(f2:Finding)
WHERE f1.id = '<finding-1-id>' AND f2.id = '<finding-2-id>'
RETURN r
```

**Expected Results**:
- SUPPORTS relationship created in Neo4j
- Relationship has strength and detected_at properties
- Both Finding nodes exist

**Success Criteria**:
- Relationship is created correctly
- Properties are stored
- Graph is queryable

---

## Test Scenarios

### Scenario 1: Full Pipeline Test (Upload to Query)

**Objective**: End-to-end test from document upload to knowledge retrieval

**Steps**:
1. Upload new document with clear findings (e.g., financial statement)
2. Monitor processing through all stages:
   - parse-document
   - generate-embeddings
   - analyze-document
   - extract-financials (if applicable)
   - detect-contradictions
3. Verify findings in Supabase
4. Verify Finding nodes in Neo4j
5. Query via agent tool: "What are the key metrics in the latest document?"
6. Verify agent retrieves and cites findings correctly

**Success Criteria**:
- Complete pipeline executes without errors
- Findings are extractable and searchable
- Agent provides accurate answers with citations

---

### Scenario 2: Multi-Document Contradiction Detection

**Objective**: Test contradiction detection across multiple documents

**Steps**:
1. Upload document 1: "Revenue was $50M in Q1 2024"
2. Wait for processing to complete
3. Upload document 2: "Revenue was $75M in Q1 2024"
4. Wait for detect-contradictions job
5. Query Neo4j for CONTRADICTS relationships
6. Use validate_finding tool to check for conflicts

**Success Criteria**:
- Contradiction detected between documents
- CONTRADICTS relationship created with confidence >= 0.70
- Temporal filtering works (same Q1 2024)
- validate_finding tool returns the conflict

---

### Scenario 3: Hybrid Search Performance Test

**Objective**: Test search performance with multiple documents

**Steps**:
1. Upload 5-10 documents
2. Wait for all processing to complete
3. Run semantic search queries:
   - Specific fact lookup: "What is the company's valuation?"
   - Broad research: "What are all the financial risks?"
4. Measure response times
5. Verify result relevance

**Success Criteria**:
- Search completes in < 500ms
- Results are ranked by relevance
- Fact queries use higher threshold (0.5)
- Research queries use lower threshold (0.3)

---

## Verification Commands

### Check Document Processing Status
```sql
-- Via Supabase SQL Editor
SELECT
  id,
  name,
  processing_status,
  upload_status,
  created_at
FROM documents
WHERE deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
ORDER BY created_at DESC;
```

### Check Findings
```sql
SELECT
  id,
  text,
  category,
  domain,
  confidence,
  source_document_id
FROM findings
WHERE deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
LIMIT 10;
```

### Check Contradictions
```sql
SELECT
  c.id,
  f1.text AS finding1,
  f2.text AS finding2,
  c.reason,
  c.confidence,
  c.detected_at
FROM contradictions c
JOIN findings f1 ON c.finding1_id = f1.id
JOIN findings f2 ON c.finding2_id = f2.id
WHERE c.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8';
```

### Neo4j Queries

#### Count Findings
```cypher
MATCH (f:Finding {deal_id: '863d2224-4f3a-45df-af22-f1068211fdc8'})
RETURN count(f) AS total_findings
```

#### Find Contradictions
```cypher
MATCH (f1:Finding)-[r:CONTRADICTS]->(f2:Finding)
WHERE f1.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
RETURN f1.text, f2.text, r.confidence, r.reason
```

#### Graph Visualization
```cypher
MATCH path = (f1:Finding)-[r]-(f2:Finding)
WHERE f1.deal_id = '863d2224-4f3a-45df-af22-f1068211fdc8'
RETURN path
LIMIT 100
```

---

## Expected Issues & Solutions

### Issue 1: Google API Key Missing
**Symptom**: analyze-document job fails
**Solution**: Add `GOOGLE_API_KEY` to manda-processing/.env

### Issue 2: Neo4j Connection Failed
**Symptom**: Finding nodes not created
**Solution**:
- Verify Neo4j is running: `docker ps | grep neo4j`
- Check credentials in manda-app/.env.local
- Test connection via Next.js

### Issue 3: No Findings Extracted
**Symptom**: analyze-document completes but no findings
**Solution**:
- Check LLM response in worker logs
- Verify document has extractable content
- Try document with clear metrics/facts

### Issue 4: Low Similarity Scores
**Symptom**: Search returns irrelevant results
**Solution**:
- Check embedding model consistency
- Verify embeddings are actually stored
- Try more specific queries

### Issue 5: Contradictions Not Detected
**Symptom**: No CONTRADICTS relationships
**Solution**:
- Upload documents with clear contradictions
- Check confidence threshold (0.70)
- Verify LLM is analyzing correctly

---

## Success Metrics

### Phase 4 (Neo4j) Success Criteria:
- ✅ Finding nodes created in Neo4j
- ✅ EXTRACTED_FROM relationships link findings to documents
- ✅ CONTRADICTS relationships created for conflicting findings
- ✅ Graph is queryable and traversable
- ✅ Temporal filtering works correctly

### Phase 5 (Hybrid Search) Success Criteria:
- ✅ Vector similarity search works (pgvector)
- ✅ Semantic search returns relevant results
- ✅ Agent tools orchestrate hybrid search
- ✅ Temporal conflict detection prevents false positives
- ✅ Knowledge graph updates work correctly
- ✅ Response times < 500ms
- ✅ Results are accurate and relevant

---

## Next Steps

1. **Add Google API Key** to enable analyze-document job
2. **Upload Test Documents** with clear findings
3. **Verify Neo4j Nodes** are created
4. **Test Vector Search** via API and agent tools
5. **Test Contradiction Detection** with conflicting documents
6. **Measure Performance** (response times, accuracy)
7. **Document Results** in test summary

---

## References

- [Agent Tools Documentation](../../../manda-app/lib/agent/tools/knowledge-tools.ts)
- [Neo4j Operations](../../../manda-app/lib/neo4j/operations.ts)
- [pgvector Search](../../../manda-processing/src/api/routes/search.py)
- [Contradiction Detection](../../../manda-processing/src/jobs/handlers/detect_contradictions.py)
