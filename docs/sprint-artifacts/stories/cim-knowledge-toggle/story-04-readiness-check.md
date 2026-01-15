# Story 4: Knowledge Readiness Check

**Files:** `knowledge-service.ts`, `CIMBuilderPage.tsx`, API route
**Estimate:** Small
**Dependencies:** Story 3

---

## Overview

Before allowing CIM creation in Graphiti mode, validate that the deal has sufficient knowledge indexed. This prevents users from getting a poor CIM experience due to sparse or missing data.

## Problem Statement

If a user switches to Graphiti mode but the deal has:
- No documents uploaded
- Documents uploaded but not yet indexed
- Very few findings extracted

...the CIM agent will have nothing to work with, leading to frustration.

## Solution

Add a pre-flight check that queries Graphiti to assess data readiness:

```
User enables Graphiti mode
        ↓
Check knowledge readiness
        ↓
    ┌───┴───┐
    │       │
  Ready   Not Ready
    │       │
    ↓       ↓
Proceed   Show warning with options:
          - Switch to JSON mode
          - Proceed anyway
          - Upload more documents
```

## Tasks

- [x] 4.1 Add `checkReadiness()` method to `KnowledgeService`
- [x] 4.2 Define readiness thresholds (min findings, min coverage)
- [x] 4.3 Create API endpoint `/api/projects/[id]/cims/knowledge-readiness`
- [x] 4.4 Add readiness check when toggle switches to Graphiti mode
- [x] 4.5 Display readiness indicator in UI (green/yellow/red)
- [x] 4.6 Show warning dialog when readiness is low
- [x] 4.7 Allow user to proceed anyway or switch modes
- [x] 4.8 Run `npm run type-check` - must pass
- [ ] 4.9 Test readiness check manually

## Completion Notes

**Completed:** 2026-01-15
**Status:** Done (pending manual testing)

### Implementation Summary
- **knowledge-service.ts:**
  - Added `KnowledgeReadiness` interface with score, level, details, recommendations
  - Implemented `checkReadiness()` method that routes based on mode
  - JSON mode always returns 100% ready (static file)
  - Graphiti mode probes for financial/market/company coverage
  - `getDataSummary()` method for formatted output
- **knowledge-readiness/route.ts:**
  - Created GET endpoint at `/api/projects/[id]/cims/knowledge-readiness`
  - Returns readiness data including score, level, coverage details, recommendations
  - Uses `createKnowledgeService` with graphiti mode
- **CIMBuilderPage.tsx:**
  - Added `knowledgeReadiness` state and fetch on toggle change
  - Badge component shows coverage percentage with color coding
  - AlertDialog warns users when coverage is insufficient
  - User can choose "Use Dev Mode" or "Proceed Anyway"

### Readiness Thresholds
| Level | Score | UI Treatment |
|-------|-------|--------------|
| Good | 60-100% | Green badge, no warning |
| Limited | 30-59% | Yellow badge, warning dialog |
| Insufficient | 0-29% | Red badge, strong warning |

### Coverage Calculation
Coverage is calculated by querying Graphiti for each section type:
- Financial: queries for "revenue profit EBITDA"
- Market: queries for "market competition industry"
- Company: queries for "company team history"
Each section scores 0-100% based on result count (20% per result, max 5)

## Implementation

### 4.1 KnowledgeService Method

```typescript
// knowledge-service.ts

export interface KnowledgeReadiness {
  ready: boolean
  score: number // 0-100
  level: 'good' | 'limited' | 'insufficient'
  details: {
    financialCoverage: number // 0-100
    marketCoverage: number
    companyCoverage: number
    documentCount: number
    findingCount: number
  }
  recommendations: string[]
}

export class KnowledgeService {
  async checkReadiness(): Promise<KnowledgeReadiness> {
    if (this.config.mode === 'json') {
      // JSON mode is always "ready" (static file)
      return {
        ready: true,
        score: 100,
        level: 'good',
        details: { /* from JSON metadata */ },
        recommendations: [],
      }
    }

    // Graphiti mode - probe for data coverage
    return this.checkGraphitiReadiness()
  }

  private async checkGraphitiReadiness(): Promise<KnowledgeReadiness> {
    const metadata = await this.getMetadata()

    // Calculate coverage by section
    const financialResults = await this.search('revenue profit EBITDA', { limit: 5 })
    const marketResults = await this.search('market competition industry', { limit: 5 })
    const companyResults = await this.search('company team history', { limit: 5 })

    const financialCoverage = Math.min(100, financialResults.length * 20)
    const marketCoverage = Math.min(100, marketResults.length * 20)
    const companyCoverage = Math.min(100, companyResults.length * 20)

    const score = Math.round((financialCoverage + marketCoverage + companyCoverage) / 3)

    const level = score >= 60 ? 'good' : score >= 30 ? 'limited' : 'insufficient'
    const ready = score >= 30 // Allow with warning at 30%+

    const recommendations: string[] = []
    if (financialCoverage < 40) recommendations.push('Upload financial statements')
    if (marketCoverage < 40) recommendations.push('Upload market research or pitch deck')
    if (companyCoverage < 40) recommendations.push('Upload company overview or team bios')

    return {
      ready,
      score,
      level,
      details: {
        financialCoverage,
        marketCoverage,
        companyCoverage,
        documentCount: metadata.documentCount,
        findingCount: financialResults.length + marketResults.length + companyResults.length,
      },
      recommendations,
    }
  }
}
```

### 4.3 API Endpoint

```typescript
// app/api/projects/[id]/cims/knowledge-readiness/route.ts

import { createKnowledgeService } from '@/lib/agent/cim-mvp'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const knowledgeService = createKnowledgeService({
    mode: 'graphiti',
    dealId: params.id,
    groupId: params.id,
  })

  const readiness = await knowledgeService.checkReadiness()

  return Response.json(readiness)
}
```

### 4.4-4.7 UI Implementation

```typescript
// CIMBuilderPage.tsx

const [knowledgeReadiness, setKnowledgeReadiness] = useState<KnowledgeReadiness | null>(null)
const [showReadinessWarning, setShowReadinessWarning] = useState(false)

// Check readiness when switching to Graphiti mode
const handleToggleChange = async (checked: boolean) => {
  if (!checked) {
    // Switching to Graphiti mode - check readiness first
    const response = await fetch(`/api/projects/${projectId}/cims/knowledge-readiness`)
    const readiness = await response.json()
    setKnowledgeReadiness(readiness)

    if (readiness.level === 'insufficient') {
      setShowReadinessWarning(true)
      return // Don't toggle yet
    }
  }
  setUseJsonKnowledge(checked)
}

// Readiness indicator
{knowledgeReadiness && !useJsonKnowledge && (
  <Badge variant={
    knowledgeReadiness.level === 'good' ? 'default' :
    knowledgeReadiness.level === 'limited' ? 'warning' : 'destructive'
  }>
    {knowledgeReadiness.score}% data coverage
  </Badge>
)}

// Warning dialog
<AlertDialog open={showReadinessWarning}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Limited Knowledge Available</AlertDialogTitle>
      <AlertDialogDescription>
        This deal has {knowledgeReadiness?.score}% data coverage.
        CIM quality may be affected.

        {knowledgeReadiness?.recommendations.length > 0 && (
          <ul className="mt-2 list-disc list-inside">
            {knowledgeReadiness.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => {
        setShowReadinessWarning(false)
        // Keep JSON mode
      }}>
        Use JSON Mode
      </AlertDialogCancel>
      <AlertDialogAction onClick={() => {
        setShowReadinessWarning(false)
        setUseJsonKnowledge(false) // Proceed with Graphiti
      }}>
        Proceed Anyway
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Readiness Thresholds

| Level | Score | Behavior |
|-------|-------|----------|
| **Good** | 60-100% | Proceed normally, green indicator |
| **Limited** | 30-59% | Show warning, yellow indicator, allow proceed |
| **Insufficient** | 0-29% | Show warning, red indicator, recommend JSON mode |

## Acceptance Criteria

1. `checkReadiness()` method returns coverage score and recommendations
2. API endpoint returns readiness data for a deal
3. UI shows readiness indicator when Graphiti mode active
4. Warning dialog shown when switching to Graphiti with low coverage
5. User can proceed anyway or switch back to JSON mode
6. Recommendations specific to missing data categories
7. `npm run type-check` passes

## Testing Checklist

- [ ] Deal with many documents: Should show "good" readiness
- [ ] Deal with few documents: Should show "limited" with recommendations
- [ ] Deal with no documents: Should show "insufficient" with strong warning
- [ ] Warning dialog actions work correctly
- [ ] Readiness indicator updates after document upload (refresh)

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/agent/cim-mvp/knowledge-service.ts` | MODIFY - Add checkReadiness() |
| `app/api/projects/[id]/cims/knowledge-readiness/route.ts` | CREATE - Readiness endpoint |
| `components/cim-builder/CIMBuilderPage.tsx` | MODIFY - Add readiness UI |

## Future Enhancements

1. **Auto-switch suggestion:** If Graphiti has 80%+ coverage, suggest switching from JSON
2. **Real-time updates:** WebSocket/polling to update indicator as documents are indexed
3. **Section-specific warnings:** "Your CIM financial section may be weak" during workflow
