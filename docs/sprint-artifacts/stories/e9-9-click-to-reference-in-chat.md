# Story 9.9: Click-to-Reference in Chat

Status: ready-for-dev

## Story

As a **M&A analyst**,
I want **to click on any component in the slide preview and have it automatically appear as a reference in my chat input**,
so that **I can quickly edit specific slide content by telling the agent exactly which element I want to change without manually typing identifiers**.

## Acceptance Criteria

1. **AC #1: Component Click → Reference in Input** - Clicking any rendered component in the preview panel inserts a formatted reference into the chat input: `📍 [s3_bullet1] "content excerpt" -` with cursor positioned after the dash for immediate typing (Click component, verify reference appears in input)
2. **AC #2: Reference Format** - Reference follows exact format: `📍 [{componentId}] "{content truncated to 30 chars}..." -` where componentId is the stable ID from E9.8 (e.g., s3_bullet1, s5_chart1) (String match verification)
3. **AC #3: User Can Complete Message** - After reference is inserted, user can type their edit instruction (e.g., "change to 22% based on Q3") and submit the complete message with Enter or Send button (Type after reference, submit works)
4. **AC #4: Agent Parses Reference** - Agent receives the message, parses the `📍 [{componentId}]` prefix to identify the target component, and understands this as an edit request for that specific component (Agent response correctly identifies component)
5. **AC #5: Agent Updates Component** - Agent uses the updateSlideTool to modify the referenced component's content, and the preview panel re-renders to show the updated content (Component updates in preview after agent response)

## Tasks / Subtasks

- [ ] Task 1: Implement Click-to-Reference UI Flow (AC: #1, #2, #3)
  - [ ] 1.1: Add `onComponentSelect` prop to CIMBuilderPage to handle component clicks from PreviewPanel
  - [ ] 1.2: Create `formatComponentReference(componentId: string, content: string): string` utility that produces `📍 [{componentId}] "{truncated content}..." -` format
  - [ ] 1.3: Wire PreviewPanel's `onComponentSelect` callback through CIMBuilderPage to populate chat input
  - [ ] 1.4: Update CIMChatInput to accept and display component reference (use existing sourceRef prop mechanism)
  - [ ] 1.5: Ensure cursor is positioned at end of reference for immediate typing
  - [ ] 1.6: Add visual distinction for component reference vs source reference in input badge

- [ ] Task 2: Implement Reference Parsing in Agent (AC: #4)
  - [ ] 2.1: Create `parseComponentReference(message: string): { componentId: string | null, instruction: string }` utility
  - [ ] 2.2: Add reference parsing to CIM agent's message preprocessing in the chat handler
  - [ ] 2.3: When reference detected, set context for agent to understand this is a component edit request
  - [ ] 2.4: Include component's current content in agent context for informed editing
  - [ ] 2.5: Add unit tests for parseComponentReference with various formats

- [ ] Task 3: Implement Component Update Flow (AC: #5)
  - [ ] 3.1: Enhance agent prompting to recognize `📍 [componentId]` as edit trigger
  - [ ] 3.2: Agent calls updateSlideTool with correct slide_id and component update
  - [ ] 3.3: After tool execution, onCIMStateChanged callback triggers preview refresh
  - [ ] 3.4: Verify component in preview shows updated content
  - [ ] 3.5: Handle error cases: component not found, slide locked, update failed

- [ ] Task 4: Write Unit Tests (AC: #1-#5)
  - [ ] 4.1: Test formatComponentReference produces correct format with truncation
  - [ ] 4.2: Test parseComponentReference extracts componentId and instruction correctly
  - [ ] 4.3: Test CIMChatInput displays component reference badge
  - [ ] 4.4: Test component click → reference → submit flow end-to-end
  - [ ] 4.5: Test agent receives parsed reference in context

- [ ] Task 5: Integration Testing (AC: #1-#5)
  - [ ] 5.1: E2E test: click component → type edit → submit → verify update
  - [ ] 5.2: Test edge cases: long content truncation, special characters in content
  - [ ] 5.3: Test clearing component reference with X button
  - [ ] 5.4: Test multiple sequential component edits

## Dev Notes

### Architecture Alignment

This story connects the E9.8 wireframe preview's click handling with the chat interface and CIM agent. The key integration points are:

**Data Flow:**
```
User clicks component in SlidePreview
    ↓
ComponentRenderer fires onClick(componentId, content)
    ↓
PreviewPanel.onComponentSelect(componentId, content)
    ↓
CIMBuilderPage.handleComponentSelect()
    ↓
formatComponentReference(componentId, content)
    ↓
setSourceRef() populates CIMChatInput
    ↓
User types instruction, submits
    ↓
ConversationPanel.handleSend() prepends reference
    ↓
CIM Agent receives message with 📍 prefix
    ↓
parseComponentReference() extracts target
    ↓
Agent calls updateSlideTool
    ↓
onCIMStateChanged() refreshes CIM state
    ↓
SlidePreview re-renders with updated content
```

### Reference Format Specification

The click-to-reference format is designed to be:
- **Visually distinct**: 📍 pin emoji clearly marks it as a component reference
- **Machine parseable**: `[{componentId}]` bracketed format is unambiguous
- **Human readable**: Quoted content excerpt provides context
- **Edit-ready**: Trailing ` -` invites user to type instruction

**Format:**
```
📍 [s3_bullet1] "Revenue grew 25%..." -
```

**Parsing Regex:**
```typescript
const COMPONENT_REF_PATTERN = /^📍 \[([^\]]+)\] "([^"]*)".*? - /
```

### Key Components to Modify

| Component | Path | Changes |
|-----------|------|---------|
| CIMBuilderPage | `components/cim-builder/CIMBuilderPage.tsx` | Add handleComponentSelect, wire to PreviewPanel |
| PreviewPanel | `components/cim-builder/PreviewPanel/PreviewPanel.tsx` | Already has onComponentSelect prop from E9.8 |
| CIMChatInput | `components/cim-builder/ConversationPanel/CIMChatInput.tsx` | Distinguish component refs from source refs visually |
| ConversationPanel | `components/cim-builder/ConversationPanel/ConversationPanel.tsx` | Pass component reference through handleSend |
| CIM Chat Handler | `app/api/cims/[id]/chat/route.ts` | Parse reference, add context for agent |

### Key Components to Create

| Component | Path | Purpose |
|-----------|------|---------|
| reference-utils.ts | `lib/cim/reference-utils.ts` | formatComponentReference, parseComponentReference utilities |
| reference-utils.test.ts | `__tests__/lib/cim/reference-utils.test.ts` | Unit tests for reference utilities |

### Existing Infrastructure from E9.8

From [ComponentRenderer.tsx](manda-app/components/cim-builder/PreviewPanel/ComponentRenderer.tsx):
- `generateComponentId(slideId, type, index)` produces stable IDs like `s3_bullet1`
- `ClickableWrapper` component with `onClick(componentId, content)` callback
- `data-component-id` attribute on all rendered components

From [SlidePreview.tsx](manda-app/components/cim-builder/PreviewPanel/SlidePreview.tsx):
- `onComponentClick?: (componentId: string, content: string) => void` prop

From [PreviewPanel.tsx](manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx):
- `onComponentSelect?: (componentId: string, content: string) => void` prop already wired through

### Agent Integration

The CIM agent already has `updateSlideTool` from E9.7 that can modify slide components. This story adds:

1. **Reference awareness**: Agent recognizes `📍 [componentId]` prefix as edit intent
2. **Context enrichment**: Agent receives the component's current content for informed editing
3. **Smart responses**: Agent confirms the update and may flag dependency implications

**Agent Prompt Enhancement:**
```
When user message starts with "📍 [componentId]", this indicates they want to edit that specific component.
Parse the componentId, find it in the current slide's components, and use updateSlideTool to make the requested change.
After updating, confirm the change and note any slides that may need review due to dependencies.
```

### CIMChatInput Badge Enhancement

Current implementation shows a generic source reference badge. For component references:

```tsx
// Detect component reference vs source reference
const isComponentRef = sourceRef.startsWith('📍')

<Badge variant={isComponentRef ? 'default' : 'secondary'}>
  {isComponentRef && <MapPin className="h-3 w-3 mr-1" />}
  <span className="truncate">{sourceRef}</span>
  ...
</Badge>
```

### Error Handling

| Error Case | Handling |
|------------|----------|
| Component not found | Agent responds: "I couldn't find that component. It may have been removed." |
| Slide is locked | Agent responds: "This slide is locked. Would you like to unlock it first?" |
| Update failed | Agent responds: "I couldn't update that component. Please try again." |
| Invalid reference format | Treat as regular message (graceful degradation) |

### Project Structure Notes

- All new utilities go in `lib/cim/` directory following existing patterns
- Tests follow `__tests__/` mirror structure
- No new API endpoints needed - uses existing chat handler

### Learnings from Previous Story

**From Story e9-8-wireframe-preview-renderer (Status: done)**

- **Click Handler Pattern**: E9.8 established the `onComponentClick(componentId, content)` callback pattern - this story consumes it
- **Stable IDs**: `generateComponentId()` produces consistent IDs like `s3_bullet1` - use these exact IDs in references
- **Component Content**: Content passed to callback is the full component.content - may need truncation for display
- **77 Tests Pass**: Comprehensive test coverage in E9.8 - follow same patterns for reference utility tests
- **Build Verified**: TypeScript type-check passes, full test suite passes

**Key Files from E9.8 to Reference:**
- [ComponentRenderer.tsx:49-53](manda-app/components/cim-builder/PreviewPanel/ComponentRenderer.tsx#L49-L53) - `generateComponentId()` function
- [ComponentRenderer.tsx:67-97](manda-app/components/cim-builder/PreviewPanel/ComponentRenderer.tsx#L67-L97) - `ClickableWrapper` component
- [PreviewPanel.tsx:onComponentSelect](manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx) - Prop already wired

[Source: stories/e9-8-wireframe-preview-renderer.md#Dev-Agent-Record]

### Testing Strategy

**Unit Tests (Vitest):**
- formatComponentReference() with various content lengths
- parseComponentReference() with valid/invalid formats
- Component reference detection in CIMChatInput

**Integration Tests:**
- Click → reference → submit flow
- Agent receives parsed reference
- Component updates after agent response

**E2E Tests (Playwright):**
- Full click-to-edit-to-update journey
- Multiple component edits in sequence
- Error handling scenarios

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#E9.9-Click-to-Reference-in-Chat] - Acceptance criteria AC-9.9.1 through AC-9.9.5
- [Source: docs/epics.md#E9.9] - Story definition
- [Source: components/cim-builder/PreviewPanel/ComponentRenderer.tsx] - Component ID generation and click handling
- [Source: components/cim-builder/PreviewPanel/SlidePreview.tsx] - Click callback prop
- [Source: components/cim-builder/PreviewPanel/PreviewPanel.tsx] - onComponentSelect prop
- [Source: components/cim-builder/ConversationPanel/CIMChatInput.tsx] - Current sourceRef implementation
- [Source: components/cim-builder/CIMBuilderPage.tsx] - Main orchestration component
- [Source: stories/e9-8-wireframe-preview-renderer.md] - Previous story with click handling patterns

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-10 | Story drafted from tech spec E9 and epic definition | SM Agent (Claude Opus 4.5) |
