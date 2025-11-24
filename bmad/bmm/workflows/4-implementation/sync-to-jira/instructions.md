# Sync to Jira Workflow Instructions

## Overview
This workflow syncs BMAD sprint artifacts (epics and stories) to Jira in a **one-way push** model. BMAD remains the source of truth, and Jira is updated to reflect the current state of sprint artifacts.

## Workflow Execution Steps

### Step 1: Load Configuration and Verify Jira Connection

1. **Load workflow variables** from `workflow.yaml`
2. **Test Jira connection** using MCP atlassian tools:
   ```
   mcp__atlassian__getVisibleJiraProjects
   ```
3. **Verify project access** to `{jira_project_key}` project
4. **Confirm issue types** are available (Epic: {jira_epic_type_id}, Story: {jira_story_type_id})

### Step 2: Scan Sprint Artifacts

1. **Find all epic files** matching pattern: `{epics_location}/epic-*.md`
2. **Find all story files** matching pattern: `{stories_location}/story-*.md`
3. **Report to user:**
   - Total epics found
   - Total stories found
   - Ask for confirmation to proceed

### Step 3: Process Epics

For each epic file:

1. **Read epic file** and extract:
   - Epic number (e.g., E1, E2)
   - Epic title
   - Epic description/user value
   - Acceptance criteria
   - Check for existing Jira issue key in frontmatter or metadata

2. **Check if epic already synced:**
   - Look for `jira_issue_key` field in epic file
   - If found, verify it still exists in Jira

3. **Create or Update in Jira:**
   - **If no Jira key exists:** Create new Epic using `mcp__atlassian__createJiraIssue`
     - summary: "{epic_number}: {epic_title}"
     - description: Epic user value and acceptance criteria (in markdown)
     - issueTypeName: "Epic"
   - **If Jira key exists:** Update Epic using `mcp__atlassian__editJiraIssue`
     - Update summary and description if changed

4. **Store Jira key back in epic file:**
   - Add or update frontmatter section with:
     ```yaml
     jira_issue_key: SCRUM-123
     jira_synced_at: 2025-11-24T10:30:00Z
     ```

### Step 4: Process Stories

For each story file:

1. **Read story file** and extract:
   - Story ID (e.g., E1-S1)
   - Story title
   - Story description
   - Acceptance criteria
   - Parent epic reference
   - Check for existing Jira issue key

2. **Identify parent epic in Jira:**
   - Parse epic reference from story ID (e.g., E1-S1 → E1)
   - Find corresponding epic's Jira issue key
   - This will be used to link the story to its epic

3. **Check if story already synced:**
   - Look for `jira_issue_key` field in story file
   - If found, verify it still exists in Jira

4. **Create or Update in Jira:**
   - **If no Jira key exists:** Create new Story using `mcp__atlassian__createJiraIssue`
     - summary: "{story_id}: {story_title}"
     - description: Story description and acceptance criteria (in markdown)
     - issueTypeName: "Story"
     - parent: "{parent_epic_jira_key}" (link to epic)
   - **If Jira key exists:** Update Story using `mcp__atlassian__editJiraIssue`
     - Update summary, description, and parent link if changed

5. **Store Jira key back in story file:**
   - Add or update frontmatter section with:
     ```yaml
     jira_issue_key: SCRUM-456
     jira_parent_key: SCRUM-123
     jira_synced_at: 2025-11-24T10:32:00Z
     ```

### Step 5: Generate Sync Report

1. **Create sync log file** at `{sync_log}`
2. **Include:**
   - Sync timestamp
   - Epics processed (created vs updated)
   - Stories processed (created vs updated)
   - Any errors or warnings
   - Links to all Jira issues created/updated

3. **Display summary to user:**
   ```
   ✓ Sync Complete

   Epics: 5 created, 3 updated
   Stories: 20 created, 15 updated

   View sync log: {sync_log}
   Jira project: https://qedpartner.atlassian.net/browse/{jira_project_key}
   ```

## Error Handling

- **Epic file missing metadata:** Skip and log warning
- **Story missing parent epic:** Skip and log warning
- **Jira API error:** Log error, continue with next item
- **Jira issue key invalid:** Treat as new item, create fresh

## Important Notes

1. **BMAD is source of truth** - Never modify BMAD files based on Jira data in this workflow
2. **Idempotent operations** - Safe to re-run; will update existing issues
3. **Markdown preservation** - Store descriptions in Jira as markdown
4. **Epic-Story linking** - Ensure parent relationship is maintained in Jira hierarchy

## User Interaction

- **Confirmation required** before sync starts
- **Progress updates** during processing
- **Final summary** with links to Jira

## Future Enhancements (Not in v1)

- Sync story status changes (TODO → IN PROGRESS → DONE)
- Pull Jira comments back to BMAD
- Handle story priority and estimates
- Support for subtasks
