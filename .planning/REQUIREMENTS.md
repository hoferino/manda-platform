# Requirements: Documentation Consolidation

**Defined:** 2026-01-20
**Core Value:** Single source of truth per topic — clear where to find current docs

## v1 Requirements

### Structure

- [x] **STRUCT-01**: Create `docs/features/` directory with subfolders (agent-v2/, knowledge-graph/, cim-builder/)
- [x] **STRUCT-02**: Create `docs/features/README.md` explaining the structure
- [x] **STRUCT-03**: Create README.md in each topic subfolder

### Agent v2 Docs

- [ ] **AGT-01**: Review agent-v2 docs from `_bmad-output/` and `docs/`
- [ ] **AGT-02**: Consolidate current docs to `docs/features/agent-v2/`

### Knowledge Graph Docs

- [ ] **KG-01**: Review knowledge-graph docs from `_bmad-output/` and `docs/`
- [ ] **KG-02**: Consolidate current docs to `docs/features/knowledge-graph/`

### CIM Builder Docs

- [ ] **CIM-01**: Review cim-builder docs from `_bmad-output/` and `docs/`
- [ ] **CIM-02**: Consolidate current docs to `docs/features/cim-builder/`

### Core Doc Cleanup

- [ ] **CORE-01**: Review manda-prd.md, identify and remove outdated sections
- [ ] **CORE-02**: Review manda-architecture.md, identify and remove outdated sections

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting doc content | Just reorganize and remove outdated, don't rewrite |
| Deleting `_bmad-output/` | Keep as historical reference |
| Reorganizing non-feature docs | Focus on agent-v2, KG, CIM only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRUCT-01 | Phase 1 | ✓ Complete |
| STRUCT-02 | Phase 1 | ✓ Complete |
| STRUCT-03 | Phase 1 | ✓ Complete |
| AGT-01 | Phase 2 | Pending |
| AGT-02 | Phase 2 | Pending |
| KG-01 | Phase 2 | Pending |
| KG-02 | Phase 2 | Pending |
| CIM-01 | Phase 2 | Pending |
| CIM-02 | Phase 2 | Pending |
| CORE-01 | Phase 3 | Pending |
| CORE-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-20*
