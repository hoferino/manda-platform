# Epic 1 - Jira Creation Guide

## Quick Start

### Prerequisites
```bash
export JIRA_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

Get your API token: https://id.atlassian.com/manage-profile/security/api-tokens

### Option 1: Bash Script (Recommended)
```bash
cd docs/sprint-artifacts
./create-epic1-jira.sh MANDA
```

### Option 2: Python Script
```bash
cd docs/sprint-artifacts
pip install requests  # if not already installed
python create_epic1_jira.py MANDA
```

### Option 3: MCP Server (Requires Setup)
1. Install: `npm install -g @modelcontextprotocol/server-atlassian`
2. Configure MCP settings (see JIRA_SETUP_INSTRUCTIONS.md)
3. Ask Claude: "Create Epic 1 and stories in Jira using the Atlassian MCP server"

## What Gets Created

**Epic 1: Project Foundation**
- Epic key will be something like: MANDA-123

**9 Stories:**
1. E1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4
2. E1.2: Configure Supabase Auth and Database Connection
3. E1.3: Create PostgreSQL Schema with RLS Policies
4. E1.4: Build Projects Overview Screen (Landing)
5. E1.5: Implement Project Creation Wizard
6. E1.6: Build Project Workspace Shell with Navigation
7. E1.7: Configure Neo4j Graph Database
8. E1.8: Configure pg-boss Job Queue
9. E1.9: Implement Audit Logging for Security Events

All stories:
- Linked to Epic 1
- Priority: High
- Status: To Do (ready-for-dev)
- Include full descriptions and acceptance criteria

## Output

The scripts will output:
```
Epic Key: MANDA-123

Story Keys:
  E1.1: MANDA-124
  E1.2: MANDA-125
  E1.3: MANDA-126
  ...
```

Python script also creates: `epic1-jira-keys.json` for easy reference

## Next Steps

1. Update `sprint-status.yaml` with Jira issue keys
2. Verify issues in Jira web interface
3. Create a sprint and add stories if using Scrum
4. Assign stories to team members

## Files Reference

- **create-epic1-jira.sh** - Bash script using curl
- **create_epic1_jira.py** - Python script with colored output
- **epic1-jira-payloads.json** - JSON data structure for all issues
- **JIRA_SETUP_INSTRUCTIONS.md** - Detailed setup guide
- **sprint-status.yaml** - Current sprint status (needs update after creation)

## Troubleshooting

**401 Unauthorized**
- Verify API token is correct
- Check email matches Atlassian account

**404 Not Found**
- Verify JIRA_URL is correct
- Check project key exists

**Epic issue type not found**
- Your Jira may not have "Epic" issue type
- Check project settings or use different issue type

For detailed troubleshooting: See JIRA_SETUP_INSTRUCTIONS.md

## Epic 1 Summary

**User Value:** Users can create and manage isolated project instances with clear navigation

**Tech Stack:**
- Next.js 15 with React 19.2
- Supabase Auth + PostgreSQL 18
- Neo4j for knowledge graph
- pg-boss for job queue
- shadcn/ui + Tailwind CSS 4

**Acceptance Criteria:**
- User can create/view/switch projects
- Complete data isolation per project (RLS)
- Full workspace navigation
- Background job processing ready
- Security audit logging in place

Total: 1 Epic + 9 Stories = ~5-7 sprint capacity (2-3 weeks)
