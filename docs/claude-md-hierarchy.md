# CLAUDE.md Hierarchy

This document explains how context files work in this repository for human reference.

## How It Works

Claude Code uses a **nearest-wins** pattern for loading context:

1. When you start a conversation, Claude loads the **root `CLAUDE.md`**
2. When you edit files in a subdirectory, Claude **automatically loads** any `CLAUDE.md` in that path
3. Subdirectory files provide **specialized context** without bloating the root file

This is built into Claude Code - no configuration needed.

## File Structure

```
CLAUDE.md                           # Always loaded (~113 lines)
├── Project overview, commands
├── Architecture essentials
├── Status pointers
└── Subdirectory context table

manda-app/CLAUDE.md                 # Loaded when editing manda-app/
├── Frontend architecture
├── Component patterns
└── Testing specifics

manda-app/lib/agent/CLAUDE.md       # Loaded when editing lib/agent/
├── Agent implementation status
├── CIM MVP + v2 Chat patterns
├── SSE events, thread IDs
└── Anti-patterns to avoid

manda-processing/CLAUDE.md          # Loaded when editing manda-processing/
├── Python patterns
├── Job handler conventions
└── Backend architecture

docs/CLAUDE.md                      # Loaded when editing docs/
├── Where to put documentation
├── Status indicators
└── Archival policy
```

## Context Loading Examples

| Task | Files Loaded |
|------|--------------|
| General question about project | `CLAUDE.md` only |
| Editing `lib/agent/cim-mvp/graph.ts` | `CLAUDE.md` + `manda-app/lib/agent/CLAUDE.md` |
| Editing `manda-processing/src/jobs/` | `CLAUDE.md` + `manda-processing/CLAUDE.md` |
| Writing documentation | `CLAUDE.md` + `docs/CLAUDE.md` |

## Why This Structure?

| Problem | Solution |
|---------|----------|
| Root CLAUDE.md was 340 lines | Slimmed to 113 lines, moved details to subdirectories |
| Agent patterns needed for agent work only | Moved to `lib/agent/CLAUDE.md` |
| Context window bloat | Only relevant context loads based on task |
| Losing project oversight | Added status pointers to `.planning/` and `docs/decisions/` |

## Best Practices

**Keep root CLAUDE.md lightweight** (~100-150 lines)
- Essential commands, architecture overview, status pointers
- Links to subdirectory context files (for human reference)

**Create subdirectory CLAUDE.md when**
- A directory has specific patterns/conventions
- Context is only relevant when working in that area
- Details would bloat the root file

**Don't duplicate content**
- Each CLAUDE.md should cover unique context
- Use links to detailed docs, don't copy them

## Sources

- [Anthropic: Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [HumanLayer: Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [AGENTS.md Standard](https://agents.md/)
