#!/bin/bash

# M&A Deal Intelligence Platform - New Deal Setup Script
# Creates a fresh instance for a new deal with complete directory structure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (where manda module is)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MODULE_DIR="$SCRIPT_DIR"

echo ""
echo "======================================================================"
echo "  M&A Deal Intelligence Platform - New Deal Setup"
echo "======================================================================"
echo ""

# Get deal name from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter deal name (e.g., 'acme-acquisition'):${NC}"
    read -r DEAL_NAME
else
    DEAL_NAME="$1"
fi

# Sanitize deal name (remove spaces, special chars)
DEAL_NAME=$(echo "$DEAL_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

if [ -z "$DEAL_NAME" ]; then
    echo -e "${RED}Error: Deal name cannot be empty${NC}"
    exit 1
fi

# Get target directory from user (or use default)
if [ -z "$2" ]; then
    echo -e "${YELLOW}Enter target directory (default: ./deals/${DEAL_NAME}):${NC}"
    read -r TARGET_DIR
    if [ -z "$TARGET_DIR" ]; then
        TARGET_DIR="./deals/${DEAL_NAME}"
    fi
else
    TARGET_DIR="$2"
fi

# Convert to absolute path
TARGET_DIR=$(cd "$(dirname "$TARGET_DIR")" 2>/dev/null && pwd)/$(basename "$TARGET_DIR") || TARGET_DIR="$PWD/$TARGET_DIR"

echo ""
echo -e "${BLUE}Deal Name:${NC} $DEAL_NAME"
echo -e "${BLUE}Target Directory:${NC} $TARGET_DIR"
echo ""

# Check if directory already exists
if [ -d "$TARGET_DIR" ]; then
    echo -e "${RED}Warning: Directory already exists: $TARGET_DIR${NC}"
    echo -e "${YELLOW}Overwrite? (y/N):${NC}"
    read -r OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
    rm -rf "$TARGET_DIR"
fi

echo -e "${GREEN}Creating new deal environment...${NC}"
echo ""

# Create base directory
mkdir -p "$TARGET_DIR"

# Copy manda module
echo "📦 Copying M&A module..."
cp -r "$MODULE_DIR" "$TARGET_DIR/manda"

# Create data room structure
echo "📁 Creating data room structure..."
mkdir -p "$TARGET_DIR/data/deals/financials"
mkdir -p "$TARGET_DIR/data/deals/legal"
mkdir -p "$TARGET_DIR/data/deals/operational"
mkdir -p "$TARGET_DIR/data/deals/commercial"
mkdir -p "$TARGET_DIR/data/deals/strategic"

# Create knowledge base structure
echo "🧠 Creating knowledge base structure..."
mkdir -p "$TARGET_DIR/data/knowledge-base/vector-store"
mkdir -p "$TARGET_DIR/data/knowledge-base/structured-data"
mkdir -p "$TARGET_DIR/data/knowledge-base/metadata"

# Create output directories
echo "📄 Creating output directories..."
mkdir -p "$TARGET_DIR/output/reports"
mkdir -p "$TARGET_DIR/output/storylines"
mkdir -p "$TARGET_DIR/output/cims"
mkdir -p "$TARGET_DIR/output/teasers"

# Create deal-specific config
echo "⚙️  Creating deal configuration..."
cat > "$TARGET_DIR/deal-config.yaml" << EOF
# Deal Configuration
# Generated: $(date)

deal:
  name: "$DEAL_NAME"
  type: "acquisition"  # Options: acquisition | sale | merger
  stage: "due-diligence"  # Options: initial | due-diligence | documentation | closing
  created: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

target_company:
  name: ""  # Fill in target company name
  industry: ""
  revenue: ""
  employees: ""

buyer_type: "strategic"  # Options: strategic | financial | international | competitor | mixed

team:
  lead: "$USER"
  members: []

paths:
  data_room: "./data/deals"
  output: "./output"
  knowledge_base: "./data/knowledge-base"
EOF

# Create README in data room
cat > "$TARGET_DIR/data/deals/README.md" << EOF
# Data Room - $DEAL_NAME

Upload your deal documents here, organized by category.

## Directory Structure

- **financials/** - Financial statements, models, projections, tax returns
- **legal/** - Contracts, agreements, corporate documents, compliance
- **operational/** - Org charts, employee data, process docs, KPIs
- **commercial/** - Customer contracts, pricing, sales data, market research
- **strategic/** - Business plans, presentations, board materials

## Document Upload Guidelines

1. **Use descriptive filenames**: \`2023-Audited-Financials.pdf\`
2. **Include dates when relevant**: \`Customer-List-As-Of-2024-01-31.xlsx\`
3. **Mark data quality**:
   - \`AUDITED-\` for audited financials
   - \`UNAUDITED-\` for management numbers
   - \`DRAFT-\` for preliminary versions
4. **Maintain original filenames** when possible for provenance

## Supported Formats

- PDF (with OCR support for scanned documents)
- Excel (.xlsx, .xls)
- Word (.docx, .doc)
- PowerPoint (.pptx, .ppt)
- Plain text (.txt, .md)

## Getting Started

1. Upload documents to appropriate category folders
2. Run data room audit: See instructions in \`../manda/docs/QUICKSTART.md\`
3. Begin analysis with M&A agents

---
**Deal:** $DEAL_NAME
**Created:** $(date)
EOF

# Create main README
cat > "$TARGET_DIR/README.md" << EOF
# $DEAL_NAME - M&A Deal Analysis

**Created:** $(date)
**Type:** Acquisition
**Stage:** Due Diligence

## Directory Structure

\`\`\`
$DEAL_NAME/
├── manda/                  # M&A Deal Intelligence Platform module
│   ├── agents/            # AI agents (Deal Orchestrator, analysts, etc.)
│   ├── workflows/         # Analysis workflows
│   └── config.yaml        # Module configuration
├── data/
│   ├── deals/             # Data room (upload documents here)
│   └── knowledge-base/    # Indexed knowledge (auto-managed)
├── output/                # Generated reports and documents
│   ├── reports/           # Audit reports, analysis
│   ├── storylines/        # Investment storylines
│   ├── cims/              # Confidential Information Memorandums
│   └── teasers/           # Investment teasers
├── deal-config.yaml       # Deal-specific configuration
└── README.md             # This file
\`\`\`

## Quick Start

### 1. Upload Documents

Add deal documents to \`data/deals/\`:
\`\`\`bash
cp ~/Documents/target-financials.pdf data/deals/financials/
cp ~/Documents/customer-contracts.pdf data/deals/legal/
\`\`\`

### 2. Configure Deal

Edit \`deal-config.yaml\` with deal details:
\`\`\`yaml
target_company:
  name: "Target Company Inc"
  industry: "SaaS"
  revenue: "\$50M"
\`\`\`

### 3. Run Analysis

Use the M&A agents (see \`manda/docs/QUICKSTART.md\` for complete guide):

**Option A: With BMAD Framework**
\`\`\`bash
# Activate Deal Orchestrator
/manda:deal-orchestrator

# Run data room audit
/manda:data-room-audit

# Develop investment storyline
/manda:investment-storyline-workshop
\`\`\`

**Option B: With Claude Projects**
1. Create Claude Project
2. Upload \`manda/agents/*.yaml\` files
3. Upload your documents from \`data/deals/\`
4. Start conversation: "Let's audit the data room"

## Documentation

- **Quick Start Guide**: \`manda/docs/QUICKSTART.md\`
- **Complete User Guide**: \`manda/docs/USER-GUIDE.md\`
- **Module Documentation**: \`manda/README.md\`

## Support

For module documentation and support, see \`manda/docs/\` directory.

---
**M&A Deal Intelligence Platform v1.0.0**
EOF

# Create .gitignore
cat > "$TARGET_DIR/.gitignore" << EOF
# Data and outputs (deal-specific, don't commit)
data/deals/*
!data/deals/README.md
data/knowledge-base/*
output/*

# Keep directory structure
!data/deals/.gitkeep
!data/knowledge-base/.gitkeep
!output/.gitkeep

# Temporary files
*.tmp
*.log
.DS_Store

# Sensitive
*.env
secrets/
EOF

# Create .gitkeep files to preserve directory structure
touch "$TARGET_DIR/data/deals/.gitkeep"
touch "$TARGET_DIR/data/knowledge-base/.gitkeep"
touch "$TARGET_DIR/output/.gitkeep"

# Create quick start script
cat > "$TARGET_DIR/start-analysis.sh" << 'EOF'
#!/bin/bash
# Quick start script for deal analysis

echo "======================================================================"
echo "  M&A Deal Analysis - Quick Start"
echo "======================================================================"
echo ""
echo "Choose your analysis approach:"
echo ""
echo "1. BMAD Framework (if installed)"
echo "   - Activate: /manda:deal-orchestrator"
echo "   - Run audit: /manda:data-room-audit"
echo ""
echo "2. Claude Projects"
echo "   - Upload agents from: manda/agents/*.yaml"
echo "   - Upload documents from: data/deals/"
echo "   - Start: 'Let's audit the data room'"
echo ""
echo "3. Manual"
echo "   - Review: manda/docs/QUICKSTART.md"
echo "   - Follow step-by-step instructions"
echo ""
echo "Documentation: manda/docs/"
echo "======================================================================"
EOF
chmod +x "$TARGET_DIR/start-analysis.sh"

echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Deal environment created successfully!${NC}"
echo "======================================================================"
echo ""
echo -e "${BLUE}Location:${NC} $TARGET_DIR"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Navigate to deal directory:"
echo "     ${GREEN}cd $TARGET_DIR${NC}"
echo ""
echo "  2. Upload documents to data room:"
echo "     ${GREEN}cp your-documents.pdf data/deals/financials/${NC}"
echo ""
echo "  3. Configure deal (optional):"
echo "     ${GREEN}nano deal-config.yaml${NC}"
echo ""
echo "  4. Start analysis:"
echo "     ${GREEN}./start-analysis.sh${NC}"
echo "     or see: ${GREEN}manda/docs/QUICKSTART.md${NC}"
echo ""
echo "======================================================================"
echo ""
echo -e "${YELLOW}Structure created:${NC}"
echo "  ✓ M&A module (manda/)"
echo "  ✓ Data room (data/deals/)"
echo "  ✓ Knowledge base (data/knowledge-base/)"
echo "  ✓ Output directories (output/)"
echo "  ✓ Deal configuration (deal-config.yaml)"
echo "  ✓ Documentation (README.md)"
echo ""
echo -e "${GREEN}Ready for deal analysis!${NC} 🎉"
echo ""
