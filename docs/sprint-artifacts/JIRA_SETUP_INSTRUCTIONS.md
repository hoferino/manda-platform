# Creating Epic 1 in Jira - Setup Instructions

## Overview
This document explains how to create Epic 1 and all its stories in Jira for the Manda M&A Intelligence Platform.

## Prerequisites

### 1. Jira Instance
- You need access to a Jira instance (Cloud or Server)
- You need permissions to create Epics and Stories
- You need to have a project set up in Jira (e.g., project key "MANDA")

### 2. Jira API Token
Generate an API token from Atlassian:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "Manda Platform CLI")
4. Copy the token (you won't see it again)

### 3. Environment Variables
Set these environment variables before running the script:

```bash
export JIRA_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

## Option 1: Using the Shell Script (Recommended)

### Step 1: Make the script executable
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/docs/sprint-artifacts
chmod +x create-epic1-jira.sh
```

### Step 2: Run the script
```bash
# Use default project key "MANDA"
./create-epic1-jira.sh

# Or specify a different project key
./create-epic1-jira.sh YOUR_PROJECT_KEY
```

### Step 3: Verify the output
The script will output:
- Epic key (e.g., MANDA-123)
- All 9 story keys (e.g., MANDA-124 through MANDA-132)

### Step 4: Update sprint-status.yaml
After successful creation, update the sprint-status.yaml file with the Jira issue keys.

## Option 2: Using Atlassian MCP Server

### Step 1: Install the Atlassian MCP Server
```bash
npm install -g @modelcontextprotocol/server-atlassian
```

### Step 2: Configure MCP Settings
Add to your MCP settings file (usually `~/.mcp/settings.json`):

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-atlassian"],
      "env": {
        "JIRA_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Step 3: Use Claude with MCP
Once configured, you can ask Claude to create the issues using the MCP server:

```
Create Epic 1 and all stories in Jira using the Atlassian MCP server
```

## Option 3: Manual Creation via Jira Web UI

If automation isn't working, you can create issues manually:

### Epic 1: Project Foundation
- **Summary**: Epic 1: Project Foundation
- **Issue Type**: Epic
- **Priority**: High
- **Labels**: project-foundation, mvp, epic-1
- **Description**: See `/docs/epics.md` lines 72-102

### Stories E1.1 through E1.9
For each story, create a new issue:
- **Issue Type**: Story
- **Epic Link**: Link to the epic you just created
- **Priority**: High
- **Summary**: Copy from the script or epics.md file
- **Description**: Format as "As a [role] / I want [goal] / So that [benefit]" plus key acceptance criteria
- **Labels**: Add relevant tags from the script

## Jira Issue Structure

### Epic 1: Project Foundation
```
Summary: Epic 1: Project Foundation
Description:
  User Value: Users can create and manage isolated project instances with clear navigation

  Functional Requirements Covered:
  - FR-ARCH-001: Platform-Agent Separation
  - FR-ARCH-002: Tool-Based Agent Integration
  - FR-ARCH-003: Scalable Service Architecture

  Technical Foundation:
  - Next.js 15 app structure (React 19.2, Turbopack beta)
  - Supabase Auth setup
  - PostgreSQL 18 schema (deals table)
  - RLS policies for data isolation
  - Docker Compose development environment
```

### Story Format (Example: E1.1)
```
Summary: E1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4

Description:
As a developer
I want a properly configured Next.js 15 project with shadcn/ui and Tailwind CSS 4
So that I have the foundation for building the frontend

Key Acceptance Criteria:
- Next.js 15 project initialized with App Router
- Tailwind CSS 4 configured and working
- shadcn/ui installed with 5+ base components
- TypeScript configured with strict mode
- Dev server runs without errors
```

## Troubleshooting

### Script fails with "permission denied"
Make sure the script is executable:
```bash
chmod +x create-epic1-jira.sh
```

### API returns 401 Unauthorized
- Check that your API token is correct
- Verify your email address matches your Atlassian account
- Ensure the token hasn't expired

### API returns 404 Not Found
- Verify your JIRA_URL is correct
- Check that the project key exists in your Jira instance
- Ensure you're using the right API version (v3 for Cloud)

### Issue type "Epic" not available
Some Jira configurations don't have Epic as a default issue type:
- Check your project settings
- You may need to use "Initiative" or create a custom issue type
- Update the script to use the correct issue type name

### Missing fields error
Different Jira configurations have different required fields:
- Check your project's create issue screen
- Add any additional required fields to the script
- Remove optional fields that don't exist in your configuration

## Post-Creation Steps

### 1. Update sprint-status.yaml
Add the Jira issue keys to the sprint status file:

```yaml
development_status:
  epic-1: contexted
  epic-1-jira-id: MANDA-123
  e1-1-set-up-nextjs-15-project-with-shadcnui: ready-for-dev
  e1-1-jira-id: MANDA-124
  # ... and so on for all stories
```

### 2. Verify in Jira
1. Go to your Jira project
2. Open the epic (e.g., MANDA-123)
3. Verify all 9 stories are linked to the epic
4. Check that priorities and labels are correct

### 3. Set Up Workflow
1. Ensure stories are in "To Do" status
2. Create a sprint if using Scrum
3. Add stories to the sprint
4. Assign stories to team members

## Story List Reference

Epic 1 contains these 9 stories:

1. **E1.1**: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4
2. **E1.2**: Configure Supabase Auth and Database Connection
3. **E1.3**: Create PostgreSQL Schema with RLS Policies
4. **E1.4**: Build Projects Overview Screen (Landing)
5. **E1.5**: Implement Project Creation Wizard
6. **E1.6**: Build Project Workspace Shell with Navigation
7. **E1.7**: Configure Neo4j Graph Database
8. **E1.8**: Configure pg-boss Job Queue
9. **E1.9**: Implement Audit Logging for Security Events

All stories are marked as "ready-for-dev" in the local sprint status and should be set to "To Do" in Jira.

## Additional Resources

- Jira REST API Documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Atlassian API Tokens: https://id.atlassian.com/manage-profile/security/api-tokens
- MCP Server Documentation: https://modelcontextprotocol.io/
- Epic details: `/docs/epics.md` (lines 72-650)
- Sprint status: `/docs/sprint-artifacts/sprint-status.yaml`
