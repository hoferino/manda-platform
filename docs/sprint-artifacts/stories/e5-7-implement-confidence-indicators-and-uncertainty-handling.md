# Story E5.7: Implement Confidence Indicators and Uncertainty Handling

Status: ready-for-dev

## Story

As an M&A analyst,
I want to see confidence indicators on agent responses,
so that I know how certain the information is and can make informed decisions.

## Acceptance Criteria

1. **AC1: Confidence Score Extraction** - The agent extracts confidence scores from tool responses (particularly `query_knowledge_base` results) and associates them with relevant parts of the response
2. **AC2: Visual Confidence Badges** - Confidence is displayed using color-coded badges: High (>80%, green), Medium (60-80%, yellow), Low (<60%, red)
3. **AC3: Badge Tooltip with Reasoning** - Hovering over a confidence badge reveals a tooltip explaining the confidence score and contributing factors
4. **AC4: Uncertainty Phrases in Responses** - When confidence is low or medium, the agent includes appropriate caveats in the response text (e.g., "Based on available data...", "I'm not certain, but...")
5. **AC5: Missing Information Handling** - When the agent doesn't have enough information to answer, it explains WHY and suggests next steps (e.g., "Would you like me to add this to the Q&A list?")
6. **AC6: Multiple Finding Aggregation** - When multiple findings contribute to an answer with varying confidence levels, the agent shows the lowest confidence and explains the range
7. **AC7: P2 Compliance - No Raw Scores** - Confidence scores are never shown directly to users as numbers; instead, they are translated to natural explanations per agent-behavior-spec.md P2
8. **AC8: Badge Display in Message Items** - Confidence badges display correctly within MessageItem components in both regular messages and streaming responses

## Tasks / Subtasks

- [ ] Task 1: Create confidence extraction utilities (AC: 1, 6)
  - [ ] Create `lib/utils/confidence.ts` with confidence extraction functions
  - [ ] Implement `extractConfidenceFromToolResults(toolResults)` to parse confidence from tool outputs
  - [ ] Implement `aggregateConfidence(confidences[])` that returns lowest and calculates range
  - [ ] Add confidence score normalization (ensure 0-1 scale)
  - [ ] Handle missing confidence data gracefully (default to medium)

- [ ] Task 2: Create ConfidenceBadge component (AC: 2, 3)
  - [ ] Create `components/chat/ConfidenceBadge.tsx` with High/Medium/Low variants
  - [ ] Implement color coding: green (>80%), yellow (60-80%), red (<60%)
  - [ ] Add tooltip using shadcn/ui Tooltip component
  - [ ] Include reasoning text in tooltip (contributing factors)
  - [ ] Add accessible labels for screen readers

- [ ] Task 3: Create ConfidenceTooltipContent component (AC: 3, 7)
  - [ ] Create `components/chat/ConfidenceTooltipContent.tsx` for rich tooltip display
  - [ ] Show contributing factors: source quality, data recency, number of sources
  - [ ] Translate raw factors to natural language (per P2 spec)
  - [ ] Format as readable list with context

- [ ] Task 4: Update agent prompts for uncertainty handling (AC: 4, 5, 7)
  - [ ] Modify `lib/agent/prompts.ts` to include P2-compliant uncertainty handling instructions
  - [ ] Add instruction: "When confidence is low, include caveats like 'Based on available data...'"
  - [ ] Add instruction: "When information is missing, explain WHY and offer next steps"
  - [ ] Add instruction: "Never show raw confidence scores; translate to natural explanations"
  - [ ] Include examples from agent-behavior-spec.md P2 uncertainty section

- [ ] Task 5: Update MessageItem to display confidence badges (AC: 8)
  - [ ] Modify `components/chat/MessageItem.tsx` to include ConfidenceBadge
  - [ ] Extract confidence from message metadata/sources
  - [ ] Position badge appropriately (after message content or inline)
  - [ ] Handle streaming state (show badge after response complete)

- [ ] Task 6: Update chat API to include confidence in responses (AC: 1)
  - [ ] Modify `app/api/projects/[id]/chat/route.ts` to extract and include confidence
  - [ ] Parse confidence from tool execution results
  - [ ] Include confidence in SSE `done` event payload
  - [ ] Store confidence in messages table (use existing `confidence` column)

- [ ] Task 7: Create confidence reasoning utilities (AC: 3, 6, 7)
  - [ ] Create `lib/utils/confidence-reasoning.ts` for generating explanations
  - [ ] Implement `generateConfidenceReasoning(score, factors)` function
  - [ ] Map factors to natural language: "from audited financials", "from a presentation dating 2 months back"
  - [ ] Handle multiple sources with range explanation

- [ ] Task 8: Testing and verification (AC: all)
  - [ ] Write unit tests for confidence extraction utilities
  - [ ] Write unit tests for confidence reasoning utilities
  - [ ] Write component tests for ConfidenceBadge
  - [ ] Write component tests for ConfidenceTooltipContent
  - [ ] Test high confidence scenario (95%+ from audited docs)
  - [ ] Test medium confidence scenario (65% from drafts)
  - [ ] Test low confidence scenario (<60% from partial data)
  - [ ] Test missing information scenario
  - [ ] Test multiple findings with varying confidence
  - [ ] Verify P2 compliance (no raw scores exposed)
  - [ ] Verify build passes with all changes

## Dev Notes

### Relevant Architecture Patterns and Constraints

This story enhances the chat interface from E5.3 by adding confidence visualization. The agent executor from E5.2 already returns tool results that may contain confidence scores, but these are not currently surfaced to users.

**Key Architecture Constraints:**
- **P2 Compliance:** Confidence scores must NEVER be shown as raw numbers. Always translate to natural language.
- **Existing Components:** `ConfidenceBadge` component exists in `components/shared/` for findings (E4). May need to create chat-specific variant or reuse.
- **Message Schema:** The `messages` table already has a `confidence` column (from E5.3 schema) - use this for storage.
- **Streaming Consideration:** Confidence should only display after response is complete (not during streaming).

**From agent-behavior-spec.md P2:**
```
| Confidence Factor | User-Facing Explanation |
|-------------------|------------------------|
| Older document date | "from a presentation dating 2 months back" |
| Superseded by correction | "this was later corrected in the Q3 report" |
| Forecast vs. actual | "this was a forecast; actuals show..." |
| Different source quality | "from an internal draft" vs "from the audited financials" |
| Partial information | "based on partial Q3 data available at the time" |
```

[Source: docs/agent-behavior-spec.md#P2: Agent Behavior Framework]

**From tech spec acceptance criteria:**
```
#### E5.7: Confidence Indicators
- [ ] High/Medium/Low badges with color coding
- [ ] Tooltip shows confidence reasoning
- [ ] Low confidence triggers caveats in response
- [ ] "I don't know" includes explanation and next steps
```

[Source: docs/sprint-artifacts/tech-spec-epic-E5.md#E5.7: Confidence Indicators]

### Project Structure Notes

- New `lib/utils/confidence.ts` - Confidence extraction utilities
- New `lib/utils/confidence-reasoning.ts` - Natural language reasoning generation
- New `components/chat/ConfidenceBadge.tsx` - Chat-specific confidence badge
- New `components/chat/ConfidenceTooltipContent.tsx` - Rich tooltip content
- Modified `lib/agent/prompts.ts` - Add P2-compliant uncertainty handling
- Modified `components/chat/MessageItem.tsx` - Display confidence badges
- Modified `app/api/projects/[id]/chat/route.ts` - Extract and include confidence
- Tests in `__tests__/lib/utils/confidence.test.ts` and `__tests__/components/chat/ConfidenceBadge.test.ts`

**Existing Components to Consider:**
- `components/shared/ConfidenceBadge.tsx` - Existing badge from E4 findings (may be reusable)
- `components/knowledge-explorer/SimilarityBadge.tsx` - Similar pattern for search results
- `@/components/ui/tooltip` - shadcn/ui tooltip component (already installed)

### Learnings from Previous Story

**From Story e5-6-add-conversation-context-and-multi-turn-support (Status: done)**

- **ConversationContextManager Pattern**: Clean class-based utility pattern established for chat operations - follow similar pattern for confidence utilities
- **Token Counter Character Estimation**: Used ~4 chars/token approximation instead of tiktoken due to WASM issues - consider similar pragmatic approaches
- **P4 Prompt Enhancement Pattern**: Successfully added spec-compliant section to `prompts.ts` with explicit examples - follow same pattern for P2 uncertainty handling
- **Chat API Integration**: Context loading integrated via simple method call - confidence extraction can follow same pattern
- **34 Unit Tests**: Comprehensive testing pattern established for utility classes

**Key Files from E5.6:**
- `manda-app/lib/agent/context.ts` - ConversationContextManager pattern to follow
- `manda-app/lib/agent/prompts.ts` - P4 section added, need to add P2 uncertainty section
- `manda-app/app/api/projects/[id]/chat/route.ts` - Integration point for confidence

**New Infrastructure from E5.6:**
- Context management class pattern
- Prompt template structure for spec compliance
- Test patterns for utility classes

[Source: docs/sprint-artifacts/stories/e5-6-add-conversation-context-and-multi-turn-support.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E5.md#E5.7: Confidence Indicators]
- [Source: docs/epics.md#Story E5.7: Implement Confidence Indicators and Uncertainty Handling]
- [Source: docs/agent-behavior-spec.md#P2: Agent Behavior Framework]
- [Source: manda-app/lib/agent/prompts.ts]
- [Source: manda-app/components/chat/MessageItem.tsx]
- [Source: manda-app/components/shared/ConfidenceBadge.tsx]
- [Source: manda-app/app/api/projects/[id]/chat/route.ts]

## Dev Agent Record

### Context Reference

- [e5-7-implement-confidence-indicators-and-uncertainty-handling.context.xml](e5-7-implement-confidence-indicators-and-uncertainty-handling.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story drafted from epics.md and tech-spec-epic-E5.md | SM Agent |
