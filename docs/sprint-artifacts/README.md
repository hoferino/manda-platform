# Sprint Artifacts

Sprint work organized by status: active (E12+) vs archived (E1-E11).

## Directory Structure

```
sprint-artifacts/
├── README.md              # This file
├── epics/                 # Epic definitions (E1-E13)
│
├── active/                # Current work (E12+)
│   └── stories/           # Active story files
│
├── archive/               # Completed work (E1-E11)
│   ├── stories/           # Completed stories
│   ├── tech-specs/        # Completed tech specs
│   └── retrospectives/    # Completed retrospectives
│
├── tech-specs/            # Active tech specs
├── retrospectives/        # Remaining retrospectives
├── bugfixes/              # Bug fix documentation
└── features/              # Feature-specific docs
```

## Finding Stories

| Epic | Status | Location |
|------|--------|----------|
| E1-E11 | Complete | `archive/stories/` |
| E12-E13 | In Progress | `active/stories/` |

## File Naming

Stories: `e{epic}-{number}-{title}.md`

Tech specs: `tech-spec-epic-E{N}.md` or `tech-spec-{feature}.md`

Retrospectives: `epic-E{N}-retrospective.md`
