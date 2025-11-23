# External Dependencies Analysis - Manda Module

## Overview

Analysis of all dependencies outside the `/bmad/manda/` directory for making this module fully self-contained.

---

## Dependencies Found

### 1. **config.yaml** (MISSING in manda/)

**Referenced by:** All 5 agent files + 1 workflow file

**Locations:**
- `agents/deal-orchestrator.agent.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`
- `agents/information-vault.agent.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`
- `agents/company-analyst.agent.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`
- `agents/finance-analyst.agent.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`
- `agents/story-architect.agent.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`
- `workflows/data-room-audit/workflow.yaml` → `config_source: '{project-root}/bmad/manda/config.yaml'`

**Why it exists:**
- Stores user configuration (user_name, paths, preferences)
- Provides variables that agents can reference (e.g., `{{data_room_path}}`)
- Loaded by BMAD framework at runtime

**Current location:** Does NOT exist in manda/ (expected at runtime)

**What's needed:**
Configuration values like:
- `user_name` (referenced in agent prompts as "You are Max's trusted...")
- `data_room_path` (where documents are stored)
- `output_location` (where to save generated files)
- `knowledge_base_path` (for RAG system)
- `template_preference` (standard/modern/custom)
- `inconsistency_sensitivity` (relaxed/standard/strict)

---

### 2. **workflow.xml** (External bmad/core dependency)

**Referenced by:** `workflows/data-room-audit/instructions.md`

**Location:**
- Line 6: `<critical>The workflow execution engine is governed by: {project_root}/bmad/core/tasks/workflow.xml</critical>`

**Why it exists:**
- Defines HOW to execute workflows (the execution engine)
- Specifies what XML tags mean (`<step>`, `<action>`, `<ask>`, `<template-output>`)
- Controls flow (step order, user approval, checkpoints)
- Handles variable resolution and template processing

**Current location:** `/bmad/core/tasks/workflow.xml` (external to manda)

**What it does:**
- Interprets workflow instructions with special XML tags
- Manages step-by-step execution
- Handles user interaction patterns
- Controls template output and file generation

**Size:** 156 lines of XML

---

### 3. **Path Structure Dependencies**

**Issue:** All paths reference `{project-root}/bmad/manda/...`

**This assumes:**
```
project-root/
├── bmad/
│   └── manda/        ← Module is HERE
│       ├── agents/
│       ├── workflows/
│       └── config.yaml
├── data/             ← User data HERE
└── output/           ← Generated files HERE
```

**Referenced in:**
- `install-config.yaml` (8 times)
- All agent files (6 times)
- All workflow files (3 times)

**Why it exists:**
- BMAD convention: modules live in `bmad/` subdirectory
- User data lives at project root level
- Allows multiple BMAD modules to coexist

---

## Summary Table

| Dependency | Type | Location | Used By | Critical? |
|------------|------|----------|---------|-----------|
| **config.yaml** | File | Missing (expected) | 5 agents + 1 workflow | ✅ YES |
| **workflow.xml** | File | `../core/tasks/` | 1 workflow instructions | ✅ YES |
| **Path Structure** | Convention | `{project-root}/bmad/manda/` | All files | ✅ YES |
| **Data directories** | Convention | `{project-root}/data/` | Runtime | ⚠️ MEDIUM |

---

## What Each Dependency Does

### config.yaml Purpose

**Stores runtime configuration:**
```yaml
# User settings
user_name: "Max"

# Paths (where things are)
data_room_path: "./data/deals"
output_location: "./output/manda"
knowledge_base_path: "./data/knowledge-base"

# Preferences (how system behaves)
template_preference: "standard"
inconsistency_sensitivity: "standard"

# Module metadata
module_version: "1.0.0"
module_name: "M&A Deal Intelligence Platform"
module_code: "manda"
```

**Used for:**
- Agent personalization ("You are Max's trusted coordinator...")
- Variable substitution in prompts (`{{data_room_path}}`, `{{output_location}}`)
- User preferences (template style, inconsistency detection sensitivity)
- Path resolution (where to find/save files)

**Referenced in agents as:**
```yaml
system_prompt: |
  You are {{user_name}}'s trusted M&A coordinator.
  Data room is at: {{data_room_path}}
  Save reports to: {{output_location}}
  Inconsistency sensitivity: {{inconsistency_sensitivity}}
```

---

### workflow.xml Purpose

**Defines workflow execution rules:**

1. **Step Management**
   - Execute steps in numerical order (1, 2, 3...)
   - Handle optional steps (ask user unless #yolo mode)
   - Support conditional execution (`if="condition"`)

2. **Variable Resolution**
   - Load config.yaml and merge values
   - Resolve `{{variables}}` in workflow text
   - Handle system variables (`{project-root}`, `{date}`)

3. **User Interaction**
   - `<ask>` tags → prompt user and wait
   - `<action>` tags → perform action
   - `<template-output>` → save checkpoint, show user, get approval

4. **Template Processing**
   - Load template file
   - Fill in placeholders
   - Save to output file
   - Show user for approval

**Example workflow instruction it interprets:**
```xml
<step n="1" goal="Initialize Audit Scope">
  <action>Greet user and explain the data room audit process</action>
  <ask response="scope_confirmation">
    Would you like to proceed with this scope? [proceed/modify]
  </ask>
  <check if="user_response == 'modify'">
    <goto step="0">Re-configure scope</goto>
  </check>
</step>
```

Without workflow.xml, Claude doesn't know:
- What `<step>` means
- How to handle `<ask>` (wait for user input)
- What `<check if="">` does (conditional execution)
- How to process `<template-output>` (save to file)

---

### Path Structure Purpose

**Why `{project-root}/bmad/manda/` pattern:**

1. **Multi-Module Support**
   ```
   project-root/
   ├── bmad/
   │   ├── core/        ← BMAD framework
   │   ├── manda/       ← Your M&A module
   │   ├── finance/     ← Another module
   │   └── legal/       ← Another module
   ```

2. **Separation of Concerns**
   - `bmad/` = AI agents and logic
   - `data/` = User's business data
   - `output/` = Generated documents

3. **Module Discovery**
   - BMAD can auto-discover modules in `bmad/*/`
   - Each module is self-contained in its directory
   - Modules can reference each other

**References in code:**
```yaml
# Agent files
config_source: '{project-root}/bmad/manda/config.yaml'

# Workflow files
instructions: '{project-root}/bmad/manda/workflows/data-room-audit/instructions.md'

# Install config
agent_path:
  result: '{project-root}/bmad/manda/agents'
```

---

## Dependency Impact Analysis

### If config.yaml is Missing

**What breaks:**
- ❌ Agents can't personalize (no user_name)
- ❌ Variable substitution fails ({{data_room_path}} undefined)
- ❌ Don't know where to find data (`data_room_path`)
- ❌ Don't know where to save output (`output_location`)
- ❌ Can't configure behavior (`inconsistency_sensitivity`)

**What still works:**
- ✅ Agent system prompts (base intelligence)
- ✅ Workflow logic (instruction steps)
- ✅ Documentation

**Severity:** 🔴 **CRITICAL** - Module won't function

---

### If workflow.xml is Missing

**What breaks:**
- ❌ Can't execute workflows with XML tags properly
- ❌ No structured step-by-step flow
- ❌ No checkpoint/approval mechanism
- ❌ Template output won't save to files automatically
- ❌ Variable resolution in workflows broken

**What still works:**
- ✅ Agents can be used conversationally
- ✅ Manual workflow execution (user follows steps)
- ✅ Core agent intelligence

**Severity:** 🟡 **HIGH** - Workflows degraded to manual mode

---

### If Path Structure Changes

**What breaks:**
- ❌ All file references (can't find agents, workflows, config)
- ❌ Module loader can't find components
- ❌ Config loading fails
- ❌ Template loading fails

**What still works:**
- ✅ Individual agent prompts (if manually loaded)

**Severity:** 🔴 **CRITICAL** - Module structure broken

---

## Making Module Self-Contained

### Option 1: Copy Dependencies Into Manda

**Copy these files:**
```bash
# 1. Create config.yaml in manda/
bmad/manda/config.yaml (NEW)

# 2. Copy workflow engine
bmad/manda/workflows/workflow-engine.xml (from core/tasks/workflow.xml)

# 3. Update all paths to be relative
# Change: {project-root}/bmad/manda/...
# To: {module-root}/...
```

**Result:**
```
bmad/manda/                    ← Self-contained module
├── config.yaml                ← NEW: Module config
├── agents/
├── workflows/
│   └── workflow-engine.xml    ← NEW: Workflow execution engine
├── _module-installer/
└── docs/
```

**Pros:**
- ✅ Fully self-contained
- ✅ No external dependencies
- ✅ Can move module anywhere

**Cons:**
- ⚠️ Duplicate workflow engine (if multiple modules)
- ⚠️ Config separated from other modules

---

### Option 2: Define Module Root Pattern

**Change all paths from:**
```yaml
config_source: '{project-root}/bmad/manda/config.yaml'
```

**To:**
```yaml
config_source: '{module-root}/config.yaml'
```

**Create new variable:**
- `{module-root}` = wherever manda directory is
- No assumption about `bmad/` parent

**Result:**
```
anywhere/manda/               ← Can be anywhere!
├── config.yaml
├── agents/
├── workflows/
│   └── workflow-engine.xml
└── ...
```

**Pros:**
- ✅ Module portable to any location
- ✅ No hardcoded paths
- ✅ Works standalone or in BMAD

**Cons:**
- ⚠️ Need to implement {module-root} resolution

---

### Option 3: Embed Everything in Agents

**Remove config dependency:**
- Hardcode default values in agent prompts
- Remove `config_source` references
- Make agents ask user for paths at runtime

**Remove workflow.xml dependency:**
- Embed workflow execution rules in instructions.md
- Use simpler markdown format (no XML tags)
- Trust Claude to follow instructions conversationally

**Result:**
- Agents work with zero configuration
- Workflows are just instructions (no execution engine)

**Pros:**
- ✅ No external files needed
- ✅ Maximum portability
- ✅ Simplest architecture

**Cons:**
- ❌ Less structured execution
- ❌ No automatic file saving
- ❌ No variable substitution
- ❌ Harder to customize without editing agent files

---

## Recommended Approach

For a **standalone product foundation**, I recommend:

### **Option 1 + Option 2 Combined:**

1. **Copy dependencies into module:**
   ```bash
   bmad/manda/
   ├── config.yaml                     ← Create with defaults
   ├── workflows/workflow-engine.xml   ← Copy from core
   ```

2. **Change all path references to relative:**
   ```yaml
   # Before:
   config_source: '{project-root}/bmad/manda/config.yaml'

   # After:
   config_source: './config.yaml'  # Relative to agent file
   # Or:
   config_source: '{module-root}/config.yaml'  # Relative to module
   ```

3. **Update workflow.xml reference:**
   ```markdown
   # Before:
   {project_root}/bmad/core/tasks/workflow.xml

   # After:
   {module-root}/workflows/workflow-engine.xml
   ```

### Result:

```
manda/                              ← Fully self-contained!
├── config.yaml                     ← Module configuration
├── agents/                         ← All 5 agents
│   ├── deal-orchestrator.agent.yaml
│   ├── information-vault.agent.yaml
│   ├── company-analyst.agent.yaml
│   ├── finance-analyst.agent.yaml
│   └── story-architect.agent.yaml
├── workflows/
│   ├── workflow-engine.xml         ← Execution engine (copied)
│   ├── data-room-audit/
│   │   ├── workflow.yaml
│   │   ├── instructions.md
│   │   └── template.md
│   └── investment-storyline-workshop/
│       ├── workflow.yaml
│       ├── instructions.md
│       ├── template.md
│       └── teaser-template.md
├── _module-installer/
├── docs/
├── cim-templates/
├── tasks/
└── data/
```

**This module can:**
- ✅ Work standalone (no bmad/core dependency)
- ✅ Be copied anywhere (no path assumptions)
- ✅ Function as product foundation
- ✅ Scale independently

---

## Next Steps

To make module self-contained:

1. **Create config.yaml**
2. **Copy workflow-engine.xml**
3. **Update all path references**
4. **Test independence**

Would you like me to proceed with these changes?
