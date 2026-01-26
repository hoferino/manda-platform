# Feature Documentation

This directory contains documentation for each major product feature.

## Features

| Feature | Description | Epics |
|---------|-------------|-------|
| **[agent-system/](agent-system/)** | Chat agent, CIM Builder, LangGraph patterns | E8, E11, E13 |
| **[knowledge-graph/](knowledge-graph/)** | Graphiti + Neo4j, embeddings, hybrid search | E10 |
| **[document-processing/](document-processing/)** | Upload, parsing, extraction pipeline | E2, E3, E4 |
| **[data-room/](data-room/)** | Secure document storage, GCS | E2 |
| **[q-and-a/](q-and-a/)** | Conversational Q&A, chat interface | E8, E11 |
| **[cim-export/](cim-export/)** | PowerPoint and PDF export | E9 |

## Organization Principles

- **One feature per folder** - Each feature has its own subdirectory
- **README.md as landing page** - Each folder's README explains the feature
- **Cross-references over duplication** - Link to authoritative sources

## Related Documentation

- **[PRD](../manda-prd.md)** - Product requirements
- **[Architecture](../manda-architecture.md)** - System architecture
- **[Sprint Artifacts](../sprint-artifacts/)** - Implementation stories
- **[Decisions](../decisions/)** - Architecture decisions

## Navigation Tips

| Starting from | Best path |
|---------------|-----------|
| Agent/chat questions | `agent-system/` |
| Document upload issues | `data-room/` → `document-processing/` |
| Search/retrieval | `knowledge-graph/` |
| CIM workflow | `agent-system/cim-builder.md` |
| Export issues | `cim-export/` |
