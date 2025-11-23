#!/bin/bash

# M&A Deal Intelligence Platform - Install from GitHub
# Sets up the module in a fresh directory or repository

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================================================"
echo "  M&A Deal Intelligence Platform - GitHub Installation"
echo "======================================================================"
echo ""

# GitHub repository URL
GITHUB_REPO="https://github.com/hoferino/Bmad-buolder-ma.git"
MODULE_PATH="bmad/manda"

# Get deal name
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter deal/project name:${NC}"
    read -r DEAL_NAME
else
    DEAL_NAME="$1"
fi

# Sanitize name
DEAL_NAME=$(echo "$DEAL_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

if [ -z "$DEAL_NAME" ]; then
    echo -e "${RED}Error: Name cannot be empty${NC}"
    exit 1
fi

# Get target directory
if [ -z "$2" ]; then
    echo -e "${YELLOW}Enter target directory (default: ./${DEAL_NAME}):${NC}"
    read -r TARGET_DIR
    if [ -z "$TARGET_DIR" ]; then
        TARGET_DIR="./${DEAL_NAME}"
    fi
else
    TARGET_DIR="$2"
fi

echo ""
echo -e "${BLUE}Project Name:${NC} $DEAL_NAME"
echo -e "${BLUE}Target Directory:${NC} $TARGET_DIR"
echo ""

# Check if directory exists
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}Directory already exists. Choose action:${NC}"
    echo "1. Install into existing directory"
    echo "2. Cancel and exit"
    read -r -p "Enter choice (1 or 2): " CHOICE

    if [ "$CHOICE" != "1" ]; then
        echo "Installation cancelled."
        exit 0
    fi
else
    mkdir -p "$TARGET_DIR"
fi

cd "$TARGET_DIR"
TARGET_DIR=$(pwd)

echo -e "${GREEN}Installing M&A Deal Intelligence Platform...${NC}"
echo ""

# Create temporary directory for clone
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📦 Cloning from GitHub..."
git clone --quiet --depth 1 "$GITHUB_REPO" "$TEMP_DIR" 2>&1 | grep -v "Cloning into" || true

if [ ! -d "$TEMP_DIR/$MODULE_PATH" ]; then
    echo -e "${RED}Error: Module not found in repository at $MODULE_PATH${NC}"
    exit 1
fi

echo "✓ Repository cloned"

# Copy manda module
echo "📋 Copying M&A module..."
cp -r "$TEMP_DIR/$MODULE_PATH" "$TARGET_DIR/manda"
echo "✓ Module copied"

# Create directory structure
echo "📁 Creating directory structure..."

# Data room
mkdir -p "$TARGET_DIR/data/deals/financials"
mkdir -p "$TARGET_DIR/data/deals/legal"
mkdir -p "$TARGET_DIR/data/deals/operational"
mkdir -p "$TARGET_DIR/data/deals/commercial"
mkdir -p "$TARGET_DIR/data/deals/strategic"

# Knowledge base
mkdir -p "$TARGET_DIR/data/knowledge-base/vector-store"
mkdir -p "$TARGET_DIR/data/knowledge-base/structured-data"
mkdir -p "$TARGET_DIR/data/knowledge-base/metadata"

# Output directories
mkdir -p "$TARGET_DIR/output/reports"
mkdir -p "$TARGET_DIR/output/storylines"
mkdir -p "$TARGET_DIR/output/cims"
mkdir -p "$TARGET_DIR/output/teasers"

echo "✓ Directories created"

# Create deal config
echo "⚙️  Creating configuration..."
cat > "$TARGET_DIR/deal-config.yaml" << EOF
# Deal Configuration
# Generated: $(date)

project:
  name: "$DEAL_NAME"
  type: "m&a-analysis"
  created: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  owner: "$USER"

deal:
  target_company: ""
  deal_type: "acquisition"  # acquisition | sale | merger
  stage: "initial"  # initial | due-diligence | documentation | closing
  buyer_type: "strategic"  # strategic | financial | international | competitor

paths:
  data_room: "./data/deals"
  output: "./output"
  knowledge_base: "./data/knowledge-base"
  module: "./manda"
EOF

# Create main README
cat > "$TARGET_DIR/README.md" << EOF
# $DEAL_NAME - M&A Deal Analysis

**Created:** $(date)
**M&A Deal Intelligence Platform v1.0.0**

## Project Structure

\`\`\`
$DEAL_NAME/
├── manda/                  # M&A Deal Intelligence Platform (AI agents & workflows)
├── data/
│   ├── deals/             # Data room - upload documents here
│   └── knowledge-base/    # Auto-managed knowledge indexing
├── output/                # Generated reports and documents
├── deal-config.yaml       # Project configuration
└── README.md             # This file
\`\`\`

## Quick Start

### 1. Upload Documents

Add your deal documents to \`data/deals/\`:

\`\`\`bash
cp ~/documents/financials.pdf data/deals/financials/
cp ~/documents/contracts.pdf data/deals/legal/
\`\`\`

### 2. Configure (Optional)

Edit \`deal-config.yaml\` with your deal details.

### 3. Start Analysis

**Option A: With Claude Projects (Recommended)**

1. Create new Claude Project at [claude.ai/projects](https://claude.ai/projects)
2. Upload agent files: \`manda/agents/*.yaml\`
3. Upload your documents from \`data/deals/\`
4. Start conversation: \`"Let's audit the data room"\`

See: \`manda/STANDALONE-SETUP.md\` for complete Claude Projects setup

**Option B: With BMAD Framework**

If you have BMAD installed:
\`\`\`bash
/manda:deal-orchestrator
/manda:data-room-audit
\`\`\`

## Documentation

- **Quick Start**: \`manda/docs/QUICKSTART.md\`
- **User Guide**: \`manda/docs/USER-GUIDE.md\`
- **Claude Projects Setup**: \`manda/STANDALONE-SETUP.md\`
- **Module Info**: \`manda/README.md\`

## Available AI Agents

1. **Deal Orchestrator** - Primary interface, coordinates all specialists
2. **Information Vault** - High-speed data retrieval with RAG architecture
3. **Company Analyst** - Business intelligence (products, customers, operations)
4. **Finance Analyst** - Financial analysis, valuation, inconsistency detection
5. **Story Architect** - Narrative development for CIMs and marketing materials

## Available Workflows

1. **Data Room Audit** - Comprehensive document analysis with gap identification
2. **Investment Storyline Workshop** - Interactive storyline development for CIMs

## Support

All documentation is included in the \`manda/\` directory.

For the latest updates: https://github.com/hoferino/Bmad-buolder-ma

---
**M&A Deal Intelligence Platform** - AI-powered deal analysis and CIM creation
EOF

# Create data room README
cat > "$TARGET_DIR/data/deals/README.md" << EOF
# Data Room - $DEAL_NAME

Upload your deal documents here, organized by category.

## Folder Structure

- **financials/** - Financial statements, models, projections, tax returns
- **legal/** - Contracts, agreements, corporate documents, compliance
- **operational/** - Org charts, employee data, process documentation
- **commercial/** - Customer data, pricing, sales information, market research
- **strategic/** - Business plans, presentations, board materials

## Best Practices

1. **Descriptive filenames**: \`2023-Audited-Financial-Statements.pdf\`
2. **Include dates**: \`Customer-List-As-Of-2024-01-31.xlsx\`
3. **Mark quality**:
   - \`AUDITED-\` for audited financials
   - \`UNAUDITED-\` for management numbers
   - \`DRAFT-\` for preliminary versions

## Supported Formats

PDF, Excel, Word, PowerPoint, Text files

## Getting Started

Upload documents → See \`../manda/docs/QUICKSTART.md\` for analysis instructions
EOF

# Create .gitignore
cat > "$TARGET_DIR/.gitignore" << EOF
# Data (deal-specific, sensitive)
data/deals/*
!data/deals/README.md
data/knowledge-base/*
output/*

# Preserve structure
!data/deals/.gitkeep
!data/knowledge-base/.gitkeep
!output/.gitkeep

# System files
.DS_Store
*.log
*.tmp

# Sensitive
.env
secrets/
EOF

# Create .gitkeep files
touch "$TARGET_DIR/data/deals/.gitkeep"
touch "$TARGET_DIR/data/knowledge-base/.gitkeep"
touch "$TARGET_DIR/output/.gitkeep"

# Create quick start script
cat > "$TARGET_DIR/start.sh" << 'EOF'
#!/bin/bash
echo "======================================================================"
echo "  M&A Deal Intelligence Platform"
echo "======================================================================"
echo ""
echo "📚 Documentation:"
echo "   Quick Start: manda/docs/QUICKSTART.md"
echo "   User Guide:  manda/docs/USER-GUIDE.md"
echo ""
echo "🚀 Analysis Options:"
echo ""
echo "   1. Claude Projects (Recommended)"
echo "      - Upload: manda/agents/*.yaml"
echo "      - Guide: manda/STANDALONE-SETUP.md"
echo ""
echo "   2. BMAD Framework"
echo "      - Command: /manda:deal-orchestrator"
echo ""
echo "📂 Data Room: data/deals/"
echo "📄 Output:    output/"
echo ""
echo "======================================================================"
EOF
chmod +x "$TARGET_DIR/start.sh"

echo "✓ Configuration created"

# Initialize git if requested
if [ ! -d "$TARGET_DIR/.git" ]; then
    echo ""
    echo -e "${YELLOW}Initialize git repository? (y/N):${NC}"
    read -r INIT_GIT
    if [ "$INIT_GIT" = "y" ] || [ "$INIT_GIT" = "Y" ]; then
        git init "$TARGET_DIR" > /dev/null 2>&1
        echo "✓ Git repository initialized"
    fi
fi

echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo "======================================================================"
echo ""
echo -e "${BLUE}Location:${NC} $TARGET_DIR"
echo ""
echo -e "${BLUE}What was installed:${NC}"
echo "  ✓ M&A Deal Intelligence Platform (manda/)"
echo "  ✓ 5 AI agents (deal orchestration, analysis, narrative)"
echo "  ✓ 2 workflows (data room audit, storyline workshop)"
echo "  ✓ Complete documentation"
echo "  ✓ Directory structure (data/, output/)"
echo "  ✓ Configuration files"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Navigate to project:"
echo "     ${GREEN}cd $TARGET_DIR${NC}"
echo ""
echo "  2. Upload documents:"
echo "     ${GREEN}cp your-documents.pdf data/deals/financials/${NC}"
echo ""
echo "  3. View quick start:"
echo "     ${GREEN}./start.sh${NC}"
echo "     ${GREEN}cat manda/docs/QUICKSTART.md${NC}"
echo ""
echo "  4. Start analysis with Claude Projects:"
echo "     ${GREEN}cat manda/STANDALONE-SETUP.md${NC}"
echo ""
echo "======================================================================"
echo ""
echo -e "${GREEN}Ready to analyze deals!${NC} 🎉"
echo ""
