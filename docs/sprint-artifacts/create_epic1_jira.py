#!/usr/bin/env python3
"""
Script to create Epic 1 and all stories in Jira
Requires: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN environment variables
Usage: python create_epic1_jira.py [PROJECT_KEY]
"""

import os
import sys
import json
import requests
from typing import Dict, Any, Optional

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'


class JiraClient:
    """Simple Jira API client for creating issues"""

    def __init__(self, url: str, email: str, api_token: str):
        self.url = url.rstrip('/')
        self.auth = (email, api_token)
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def create_issue(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Create a Jira issue"""
        payload = {"fields": fields}
        response = requests.post(
            f"{self.url}/rest/api/3/issue",
            auth=self.auth,
            headers=self.headers,
            json=payload
        )

        if response.status_code not in (200, 201):
            print(f"{RED}Error creating issue:{RESET}")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            response.raise_for_status()

        return response.json()


def create_description_adf(text: str) -> Dict[str, Any]:
    """Convert plain text to Atlassian Document Format (ADF)"""
    paragraphs = text.split('\n\n')
    content = []

    for para in paragraphs:
        if not para.strip():
            continue

        # Check if it's a heading
        if para.startswith('###'):
            heading_text = para.replace('###', '').strip()
            content.append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": heading_text}]
            })
        # Check if it's a bullet list
        elif para.startswith('- ') or para.startswith('* '):
            items = [line.lstrip('- *').strip() for line in para.split('\n') if line.strip()]
            list_items = [
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": item}]
                        }
                    ]
                }
                for item in items
            ]
            content.append({
                "type": "bulletList",
                "content": list_items
            })
        # Regular paragraph
        else:
            # Handle bold text (wrapped in **)
            if '**' in para:
                parts = para.split('**')
                text_content = []
                for i, part in enumerate(parts):
                    if part:
                        if i % 2 == 1:  # Odd index = bold text
                            text_content.append({
                                "type": "text",
                                "text": part,
                                "marks": [{"type": "strong"}]
                            })
                        else:
                            text_content.append({
                                "type": "text",
                                "text": part
                            })
                content.append({
                    "type": "paragraph",
                    "content": text_content
                })
            else:
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": para}]
                })

    return {
        "type": "doc",
        "version": 1,
        "content": content
    }


def create_epic(client: JiraClient, project_key: str) -> Dict[str, str]:
    """Create Epic 1: Project Foundation"""
    print(f"{YELLOW}Creating Epic 1: Project Foundation...{RESET}")

    description_text = """**User Value:** Users can create and manage isolated project instances with clear navigation

**Description:** Implements the core project management infrastructure, allowing analysts to create projects, switch between them, and work within isolated project workspaces. Each project is a completely isolated instance with its own data room, knowledge base, and deliverables.

### Functional Requirements Covered
- FR-ARCH-001: Platform-Agent Separation
- FR-ARCH-002: Tool-Based Agent Integration
- FR-ARCH-003: Scalable Service Architecture

### UX Screens
- Projects Overview (Landing)
- Project Workspace Shell
- Top Navigation Bar
- Sidebar Navigation

### Technical Foundation
- Next.js 15 app structure (React 19.2, Turbopack beta)
- Supabase Auth setup
- PostgreSQL 18 schema (deals table)
- RLS policies for data isolation
- Docker Compose development environment

### Acceptance Criteria (Epic Level)
- User can create new project with basic metadata
- User can see all their projects in overview
- User can switch between projects
- Each project workspace shows project-specific data only
- Data is completely isolated per project (RLS enforced)"""

    fields = {
        "project": {"key": project_key},
        "summary": "Epic 1: Project Foundation",
        "description": create_description_adf(description_text),
        "issuetype": {"name": "Epic"},
        "priority": {"name": "High"},
        "labels": ["project-foundation", "mvp", "epic-1"]
    }

    response = client.create_issue(fields)
    epic_key = response['key']
    print(f"{GREEN}Created Epic: {epic_key}{RESET}")

    return {"key": epic_key, "id": response['id']}


def create_story(client: JiraClient, project_key: str, epic_key: str,
                 story_id: str, summary: str, user_story: str,
                 description: str, criteria: list, labels: list) -> str:
    """Create a story linked to the epic"""
    print(f"{YELLOW}Creating Story {story_id}...{RESET}")

    # Format the description
    description_text = f"""**{user_story.split('I want')[0].strip()}**

I want {user_story.split('I want')[1].split('So that')[0].strip()}

*So that {user_story.split('So that')[1].strip()}*

### Description
{description}

### Key Acceptance Criteria
{chr(10).join(['- ' + c for c in criteria])}"""

    fields = {
        "project": {"key": project_key},
        "summary": summary,
        "description": create_description_adf(description_text),
        "issuetype": {"name": "Story"},
        "priority": {"name": "High"},
        "labels": labels,
        "parent": {"key": epic_key}
    }

    response = client.create_issue(fields)
    story_key = response['key']
    print(f"{GREEN}Created Story: {story_key}{RESET}")

    return story_key


def main():
    """Main execution function"""
    # Check environment variables
    jira_url = os.getenv('JIRA_URL')
    jira_email = os.getenv('JIRA_EMAIL')
    jira_token = os.getenv('JIRA_API_TOKEN')

    if not all([jira_url, jira_email, jira_token]):
        print(f"{RED}Error: Required environment variables not set{RESET}")
        print("Please set: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN")
        sys.exit(1)

    # Get project key from command line or use default
    project_key = sys.argv[1] if len(sys.argv) > 1 else "MANDA"
    print(f"Creating Epic 1 and stories in project: {project_key}\n")

    # Initialize Jira client
    client = JiraClient(jira_url, jira_email, jira_token)

    try:
        # Create Epic
        epic = create_epic(client, project_key)
        epic_key = epic['key']

        # Create Stories
        stories = {}

        # Story E1.1
        stories['E1.1'] = create_story(
            client, project_key, epic_key,
            "E1.1",
            "E1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4",
            "As a developer I want a properly configured Next.js 15 project with shadcn/ui and Tailwind CSS 4 So that I have the foundation for building the frontend",
            "Initialize the Next.js 15 project with App Router, configure Tailwind CSS 4, install and configure shadcn/ui components, and set up the base project structure.",
            [
                "Next.js 15 project initialized with App Router",
                "Tailwind CSS 4 configured and working",
                "shadcn/ui installed with 5+ base components (Button, Input, Card, Badge, Label)",
                "TypeScript configured with strict mode",
                "Dev server runs without errors"
            ],
            ["nextjs", "frontend", "setup", "e1-1"]
        )

        # Story E1.2
        stories['E1.2'] = create_story(
            client, project_key, epic_key,
            "E1.2",
            "E1.2: Configure Supabase Auth and Database Connection",
            "As a developer I want Supabase authentication and database configured So that users can securely authenticate and access project data",
            "Set up Supabase project, configure authentication providers (email/password, magic links), establish database connection, and implement Row-Level Security (RLS) policies for multi-tenant data isolation.",
            [
                "Supabase project created and configured",
                "Email/password authentication working",
                "Magic link authentication working",
                "Auth middleware protects routes",
                "RLS policies tested and enforced (8 acceptance criteria total)"
            ],
            ["supabase", "auth", "security", "e1-2"]
        )

        # Story E1.3
        stories['E1.3'] = create_story(
            client, project_key, epic_key,
            "E1.3",
            "E1.3: Create PostgreSQL Schema with RLS Policies",
            "As a developer I want the complete PostgreSQL schema with RLS policies So that project data is structured and secured",
            "Create all PostgreSQL tables (deals, documents, findings, insights, conversations, messages, irls, qa_lists, cims) with proper indexes, foreign keys, and Row-Level Security policies to ensure complete data isolation per user.",
            [
                "All tables created via migration",
                "Foreign keys and constraints working",
                "Indexes created on key columns",
                "pgvector extension enabled",
                "RLS policies enforce user isolation (8 acceptance criteria total)"
            ],
            ["database", "postgresql", "schema", "rls", "e1-3"]
        )

        # Story E1.4
        stories['E1.4'] = create_story(
            client, project_key, epic_key,
            "E1.4",
            "E1.4: Build Projects Overview Screen (Landing)",
            "As an M&A analyst I want to see all my projects in a clear overview So that I can quickly access the project I'm working on",
            "Implement the Projects Overview landing screen with card grid and table views, showing project metadata, status, progress indicators, and quick actions. This is the first screen users see after login.",
            [
                "/projects route renders correctly",
                "Card grid view displays all user's projects",
                "Table view available with toggle",
                "Empty state implemented",
                "RLS verified (only user's projects shown) (8 acceptance criteria total)"
            ],
            ["ui", "projects", "landing", "e1-4"]
        )

        # Story E1.5
        stories['E1.5'] = create_story(
            client, project_key, epic_key,
            "E1.5",
            "E1.5: Implement Project Creation Wizard",
            "As an M&A analyst I want to create a new project through a guided wizard So that I can quickly set up a project with the right configuration",
            "Build a 3-step project creation wizard that guides users through project setup: basics (name, company, industry), project type selection, and IRL template selection. Upon completion, redirect to the new project's dashboard.",
            [
                "Wizard modal/page implemented with 3 steps",
                "Progress indicator shows current step",
                "Form validation on each step",
                "Deal created in database on completion",
                "Redirect to project dashboard works (9 acceptance criteria total)"
            ],
            ["ui", "wizard", "project-creation", "e1-5"]
        )

        # Story E1.6
        stories['E1.6'] = create_story(
            client, project_key, epic_key,
            "E1.6",
            "E1.6: Build Project Workspace Shell with Navigation",
            "As an M&A analyst I want a consistent workspace layout when I enter a project So that I can easily navigate between project areas",
            "Create the Project Workspace shell with top navigation bar (showing project name, status, notifications) and sidebar navigation (Dashboard, Data Room, Knowledge Explorer, Chat, Deliverables). This provides the container for all project-specific screens.",
            [
                "Project workspace layout component created",
                "Top navigation bar implemented",
                "Sidebar navigation with 5 sections",
                "Active state highlights current section",
                "Sidebar collapse/expand works (10 acceptance criteria total)"
            ],
            ["ui", "navigation", "workspace", "e1-6"]
        )

        # Story E1.7
        stories['E1.7'] = create_story(
            client, project_key, epic_key,
            "E1.7",
            "E1.7: Configure Neo4j Graph Database",
            "As a developer I want Neo4j graph database configured and connected So that the system can store knowledge graph relationships for cross-domain analysis",
            "Set up Neo4j graph database instance (local for dev, cloud for production), define node and relationship schemas for knowledge graph, configure connection from backend, and implement basic health checks.",
            [
                "Neo4j instance running (Docker Compose or AuraDB)",
                "Backend can connect to Neo4j",
                "Connection health check implemented",
                "Node schemas documented (Deal, Document, Finding, Insight)",
                "Relationship schemas documented (8 acceptance criteria total)"
            ],
            ["neo4j", "database", "graph", "e1-7"]
        )

        # Story E1.8
        stories['E1.8'] = create_story(
            client, project_key, epic_key,
            "E1.8",
            "E1.8: Configure pg-boss Job Queue",
            "As a developer I want pg-boss job queue configured So that the system can process documents asynchronously in the background",
            "Set up pg-boss (PostgreSQL-based job queue) for background processing of document parsing, analysis, and knowledge base updates. Configure job types, workers, and monitoring.",
            [
                "pg-boss installed and configured",
                "Job types defined (4 types minimum)",
                "Workers start automatically with backend",
                "Retry policies configured",
                "Job status API endpoint implemented (9 acceptance criteria total)"
            ],
            ["pg-boss", "job-queue", "background-processing", "e1-8"]
        )

        # Story E1.9
        stories['E1.9'] = create_story(
            client, project_key, epic_key,
            "E1.9",
            "E1.9: Implement Audit Logging for Security Events",
            "As a security administrator I want all security-relevant events logged So that I can track access, changes, and potential security incidents",
            "Implement comprehensive audit logging for authentication, authorization, data access, and modifications. Store audit logs in dedicated table with tamper-proof design.",
            [
                "audit_logs table created (append-only)",
                "Logging middleware implemented",
                "All auth events logged",
                "All document events logged",
                "API to query audit logs (admin only) (10 acceptance criteria total)"
            ],
            ["security", "audit-logging", "compliance", "e1-9"]
        )

        # Print summary
        print("\n" + "=" * 50)
        print(f"{GREEN}Epic 1 and Stories Created Successfully!{RESET}")
        print("=" * 50 + "\n")
        print(f"Epic Key: {epic_key}\n")
        print("Story Keys:")
        for story_id, story_key in stories.items():
            print(f"  {story_id}: {story_key}")
        print("\n" + "=" * 50)
        print("Update sprint-status.yaml with these Jira IDs")
        print("=" * 50 + "\n")

        # Save to file for easy reference
        output = {
            "epic_key": epic_key,
            "story_keys": stories,
            "project_key": project_key
        }

        with open('epic1-jira-keys.json', 'w') as f:
            json.dump(output, f, indent=2)

        print(f"{GREEN}Saved keys to: epic1-jira-keys.json{RESET}\n")

    except Exception as e:
        print(f"\n{RED}Error: {str(e)}{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
