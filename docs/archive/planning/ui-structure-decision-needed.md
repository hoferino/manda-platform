# UI Structure - Decision Needed

**Date:** 2025-11-24
**Status:** Pending Review
**Owner:** Max

---

## Question

Should we restructure the project workspace navigation to better separate reactive chat from guided workflows?

## Current UX Design

```
Project Workspace
├─ Dashboard
├─ Data Room
├─ Knowledge Explorer
├─ Chat          ← Reactive agent (queries, finding capture)
└─ Deliverables  ← Contains CIM Builder + Q&A Builder
```

## Proposed Alternative

```
Project Workspace
├─ Dashboard
├─ Data Room
├─ Analysis (Chat Agent)     ← Reactive queries, finding capture
├─ Knowledge Explorer         ← Browse findings, patterns, contradictions
├─ Q&A Builder (Workflow)     ← Guided Q&A creation
└─ CIM Builder (Workflow)     ← Guided CIM creation
```

## Rationale for Change

**Current Issue:**
- "Chat" doesn't clearly convey M&A analysis context
- Workflows hidden under generic "Deliverables" tab
- Not obvious that CIM/Q&A are different interaction modes

**Proposed Benefits:**
- "Analysis" tab clearly signals M&A work (not generic chatbot)
- CIM Builder and Q&A Builder promoted to top-level (clearer access)
- Navigation structure reflects agent interaction model (reactive vs guided)

## Decision Required

1. Keep current structure ("Chat" + "Deliverables")?
2. Adopt proposed structure ("Analysis" + separate workflow tabs)?
3. Alternative structure?

## Impact

**If Changed:**
- Update UX Design Specification (navigation section)
- Update Epic 5 stories (rename Chat → Analysis)
- Update Epic 8, 9 stories (route changes)
- Minimal technical impact (routing changes only)

**If Kept:**
- No changes needed
- Consider renaming "Chat" → "Analysis" for clarity

## Next Steps

- [ ] Review during UX refinement session
- [ ] Decide before Epic 5 implementation
- [ ] Update UX Design Specification based on decision
- [ ] Update Epic stories if structure changes

---

**Notes:**
- This does not block implementation - can decide during Epic 5 sprint planning
- Current design is functional, this is a clarity/UX optimization question
