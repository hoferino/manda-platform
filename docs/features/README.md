# Feature Documentation

This directory is the home for current feature planning and implementation documentation.

## Directory Structure

| Folder | Description |
|--------|-------------|
| [agent-system/](agent-system/) | **All agent documentation** - Chat v2, CIM Builder, LangGraph patterns, behavior spec |
| [knowledge-graph/](knowledge-graph/) | Knowledge graph and Graphiti integration - entity extraction and semantic search |

## Organization Principles

- **One topic per folder** - Each feature has its own subdirectory
- **README.md as landing page** - Each folder's README explains what belongs there
- **Cross-references over duplication** - Link to authoritative sources rather than copying content

## Related Documentation

- **Core docs** remain at `docs/` root:
  - `manda-prd.md` - Product Requirements Document
  - `manda-architecture.md` - System Architecture
  - `epics.md` - Epic definitions and sprint planning

- **Historical planning docs** in `_bmad-output/`:
  - Contains original planning artifacts
  - Kept as reference for context and decisions
  - Superseded content will be archived during consolidation

## Navigation

Use this directory as your starting point for feature-specific documentation. Each subfolder contains implementation details, design decisions, and integration guides for its respective feature.
