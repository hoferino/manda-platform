#!/bin/bash
# Script to create Epic 1 and all stories in Jira
# Requires: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN environment variables
# Usage: ./create-epic1-jira.sh <PROJECT_KEY>

set -e

# Check required environment variables
if [ -z "$JIRA_URL" ] || [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_API_TOKEN" ]; then
    echo "Error: Required environment variables not set"
    echo "Please set: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN"
    exit 1
fi

PROJECT_KEY="${1:-MANDA}"
echo "Creating Epic 1 and stories in project: $PROJECT_KEY"

# Function to create a Jira issue
create_issue() {
    local json_payload="$1"
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
        "$JIRA_URL/rest/api/3/issue" \
        -d "$json_payload"
}

# Create Epic 1: Project Foundation
echo "Creating Epic 1: Project Foundation..."
EPIC_RESPONSE=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "Epic 1: Project Foundation",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "User Value: Users can create and manage isolated project instances with clear navigation"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Description: Implements the core project management infrastructure, allowing analysts to create projects, switch between them, and work within isolated project workspaces. Each project is a completely isolated instance with its own data room, knowledge base, and deliverables."
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Functional Requirements Covered"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "FR-ARCH-001: Platform-Agent Separation"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "FR-ARCH-002: Tool-Based Agent Integration"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "FR-ARCH-003: Scalable Service Architecture"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Technical Foundation"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Next.js 15 app structure (React 19.2, Turbopack beta)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Supabase Auth setup"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "PostgreSQL 18 schema (deals table)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "RLS policies for data isolation"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Docker Compose development environment"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Acceptance Criteria (Epic Level)"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "User can create new project with basic metadata"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "User can see all their projects in overview"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "User can switch between projects"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Each project workspace shows project-specific data only"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Data is completely isolated per project (RLS enforced)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Epic"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["project-foundation", "mvp", "epic-1"]
  }
}')

EPIC_KEY=$(echo "$EPIC_RESPONSE" | jq -r '.key')
EPIC_ID=$(echo "$EPIC_RESPONSE" | jq -r '.id')

if [ -z "$EPIC_KEY" ] || [ "$EPIC_KEY" = "null" ]; then
    echo "Error creating epic: $EPIC_RESPONSE"
    exit 1
fi

echo "Created Epic: $EPIC_KEY (ID: $EPIC_ID)"

# Story E1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4
echo "Creating Story E1.1..."
STORY_E1_1=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a developer",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want a properly configured Next.js 15 project with shadcn/ui and Tailwind CSS 4"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that I have the foundation for building the frontend",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Description"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Initialize the Next.js 15 project with App Router, configure Tailwind CSS 4, install and configure shadcn/ui components, and set up the base project structure."
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Next.js 15 project initialized with App Router"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Tailwind CSS 4 configured and working"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "shadcn/ui installed with 5+ base components (Button, Input, Card, Badge, Label)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "TypeScript configured with strict mode"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Dev server runs without errors"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["nextjs", "frontend", "setup", "e1-1"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_1_KEY=$(echo "$STORY_E1_1" | jq -r '.key')
echo "Created Story: $STORY_E1_1_KEY"

# Story E1.2: Configure Supabase Auth and Database Connection
echo "Creating Story E1.2..."
STORY_E1_2=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.2: Configure Supabase Auth and Database Connection",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a developer",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want Supabase authentication and database configured"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that users can securely authenticate and access project data",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Supabase project created and configured"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Email/password authentication working"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Magic link authentication working"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Auth middleware protects routes"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "RLS policies tested and enforced (7 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["supabase", "auth", "security", "e1-2"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_2_KEY=$(echo "$STORY_E1_2" | jq -r '.key')
echo "Created Story: $STORY_E1_2_KEY"

# Story E1.3: Create PostgreSQL Schema with RLS Policies
echo "Creating Story E1.3..."
STORY_E1_3=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.3: Create PostgreSQL Schema with RLS Policies",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a developer",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want the complete PostgreSQL schema with RLS policies"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that project data is structured and secured",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "All tables created via migration"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Foreign keys and constraints working"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Indexes created on key columns"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "pgvector extension enabled"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "RLS policies enforce user isolation (8 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["database", "postgresql", "schema", "rls", "e1-3"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_3_KEY=$(echo "$STORY_E1_3" | jq -r '.key')
echo "Created Story: $STORY_E1_3_KEY"

# Story E1.4: Build Projects Overview Screen (Landing)
echo "Creating Story E1.4..."
STORY_E1_4=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.4: Build Projects Overview Screen (Landing)",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As an M&A analyst",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want to see all my projects in a clear overview"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that I can quickly access the project I am working on",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "/projects route renders correctly"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Card grid view displays all user projects"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Table view available with toggle"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Empty state implemented"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "RLS verified - only user projects shown (8 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["ui", "projects", "landing", "e1-4"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_4_KEY=$(echo "$STORY_E1_4" | jq -r '.key')
echo "Created Story: $STORY_E1_4_KEY"

# Story E1.5: Implement Project Creation Wizard
echo "Creating Story E1.5..."
STORY_E1_5=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.5: Implement Project Creation Wizard",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As an M&A analyst",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want to create a new project through a guided wizard"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that I can quickly set up a project with the right configuration",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Wizard modal/page implemented with 3 steps"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Progress indicator shows current step"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Form validation on each step"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Deal created in database on completion"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Redirect to project dashboard works (9 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["ui", "wizard", "project-creation", "e1-5"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_5_KEY=$(echo "$STORY_E1_5" | jq -r '.key')
echo "Created Story: $STORY_E1_5_KEY"

# Story E1.6: Build Project Workspace Shell with Navigation
echo "Creating Story E1.6..."
STORY_E1_6=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.6: Build Project Workspace Shell with Navigation",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As an M&A analyst",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want a consistent workspace layout when I enter a project"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that I can easily navigate between project areas",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Project workspace layout component created"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Top navigation bar implemented"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Sidebar navigation with 5 sections"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Active state highlights current section"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Sidebar collapse/expand works (10 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["ui", "navigation", "workspace", "e1-6"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_6_KEY=$(echo "$STORY_E1_6" | jq -r '.key')
echo "Created Story: $STORY_E1_6_KEY"

# Story E1.7: Configure Neo4j Graph Database
echo "Creating Story E1.7..."
STORY_E1_7=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.7: Configure Neo4j Graph Database",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a developer",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want Neo4j graph database configured and connected"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that the system can store knowledge graph relationships for cross-domain analysis",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Neo4j instance running (Docker Compose or AuraDB)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Backend can connect to Neo4j"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Connection health check implemented"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Node schemas documented (Deal, Document, Finding, Insight)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Relationship schemas documented (8 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["neo4j", "database", "graph", "e1-7"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_7_KEY=$(echo "$STORY_E1_7" | jq -r '.key')
echo "Created Story: $STORY_E1_7_KEY"

# Story E1.8: Configure pg-boss Job Queue
echo "Creating Story E1.8..."
STORY_E1_8=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.8: Configure pg-boss Job Queue",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a developer",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want pg-boss job queue configured"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that the system can process documents asynchronously in the background",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "pg-boss installed and configured"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Job types defined (4 types minimum)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Workers start automatically with backend"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Retry policies configured"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Job status API endpoint implemented (9 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["pg-boss", "job-queue", "background-processing", "e1-8"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_8_KEY=$(echo "$STORY_E1_8" | jq -r '.key')
echo "Created Story: $STORY_E1_8_KEY"

# Story E1.9: Implement Audit Logging for Security Events
echo "Creating Story E1.9..."
STORY_E1_9=$(create_issue '{
  "fields": {
    "project": {
      "key": "'$PROJECT_KEY'"
    },
    "summary": "E1.9: Implement Audit Logging for Security Events",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "As a security administrator",
              "marks": [{"type": "strong"}]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "I want all security-relevant events logged"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "So that I can track access, changes, and potential security incidents",
              "marks": [{"type": "em"}]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {"level": 3},
          "content": [
            {
              "type": "text",
              "text": "Key Acceptance Criteria"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "audit_logs table created (append-only)"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "Logging middleware implemented"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "All auth events logged"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "All document events logged"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": "API to query audit logs (admin only) (10 acceptance criteria total)"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Story"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["security", "audit-logging", "compliance", "e1-9"],
    "parent": {
      "key": "'$EPIC_KEY'"
    }
  }
}')

STORY_E1_9_KEY=$(echo "$STORY_E1_9" | jq -r '.key')
echo "Created Story: $STORY_E1_9_KEY"

# Output summary
echo ""
echo "=========================================="
echo "Epic 1 and Stories Created Successfully!"
echo "=========================================="
echo ""
echo "Epic Key: $EPIC_KEY"
echo ""
echo "Story Keys:"
echo "  E1.1: $STORY_E1_1_KEY"
echo "  E1.2: $STORY_E1_2_KEY"
echo "  E1.3: $STORY_E1_3_KEY"
echo "  E1.4: $STORY_E1_4_KEY"
echo "  E1.5: $STORY_E1_5_KEY"
echo "  E1.6: $STORY_E1_6_KEY"
echo "  E1.7: $STORY_E1_7_KEY"
echo "  E1.8: $STORY_E1_8_KEY"
echo "  E1.9: $STORY_E1_9_KEY"
echo ""
echo "Update sprint-status.yaml with these Jira IDs"
echo ""
