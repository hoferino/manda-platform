# Setup New Deal - Quick Reference

## Quick Setup (One Command)

```bash
cd /path/to/bmad/manda
./setup-new-deal.sh acme-acquisition
```

This creates a **fresh, isolated environment** for a new deal in ~5 seconds.

---

## What Gets Created

```
deals/acme-acquisition/              ← Fresh deal environment
├── manda/                           ← Complete M&A module (copied)
│   ├── config.yaml
│   ├── agents/
│   ├── workflows/
│   ├── docs/
│   └── ...
├── data/
│   ├── deals/                       ← Data room for documents
│   │   ├── financials/
│   │   ├── legal/
│   │   ├── operational/
│   │   ├── commercial/
│   │   └── strategic/
│   └── knowledge-base/              ← Auto-managed knowledge base
│       ├── vector-store/
│       ├── structured-data/
│       └── metadata/
├── output/                          ← Generated reports
│   ├── reports/
│   ├── storylines/
│   ├── cims/
│   └── teasers/
├── deal-config.yaml                 ← Deal-specific settings
├── README.md                        ← Deal documentation
├── .gitignore                       ← Proper git ignore
└── start-analysis.sh                ← Quick start helper
```

---

## Usage

### Basic Usage

```bash
# From manda directory
./setup-new-deal.sh deal-name

# Example
./setup-new-deal.sh acme-acquisition
```

### Specify Target Directory

```bash
./setup-new-deal.sh deal-name /path/to/target

# Example
./setup-new-deal.sh acme-acquisition ~/deals/2024/acme
```

### Interactive Mode

```bash
# Run without arguments for prompts
./setup-new-deal.sh
# Prompts for: deal name, target directory
```

---

## Step-by-Step: Setting Up a New Deal

### 1. Run Setup Script

```bash
cd /path/to/bmad/manda
./setup-new-deal.sh my-new-deal
```

**Output:**
```
======================================================================
  M&A Deal Intelligence Platform - New Deal Setup
======================================================================

Deal Name: my-new-deal
Target Directory: ./deals/my-new-deal

✅ Deal environment created successfully!

Location: /path/to/deals/my-new-deal

Next Steps:
  1. Navigate to deal directory
  2. Upload documents to data room
  3. Configure deal (optional)
  4. Start analysis
```

### 2. Navigate to Deal Directory

```bash
cd ./deals/my-new-deal
```

### 3. Upload Documents

```bash
# Copy documents to appropriate folders
cp ~/path/to/financials.pdf data/deals/financials/
cp ~/path/to/contracts.pdf data/deals/legal/
cp ~/path/to/customer-list.xlsx data/deals/commercial/
```

### 4. Configure Deal (Optional)

Edit `deal-config.yaml`:
```yaml
deal:
  name: "my-new-deal"
  type: "acquisition"
  stage: "due-diligence"

target_company:
  name: "Target Company Inc"
  industry: "SaaS"
  revenue: "$50M"
  employees: "200"

buyer_type: "strategic"
```

### 5. Start Analysis

```bash
./start-analysis.sh
# Shows quick start options
```

Or directly:
```bash
# With Claude Projects:
# 1. Upload manda/agents/*.yaml to Claude Project
# 2. Start conversation: "Let's audit the data room"

# With BMAD:
# /manda:deal-orchestrator
```

---

## Multiple Deals

Create multiple isolated deal environments:

```bash
# Deal 1
./setup-new-deal.sh acme-acquisition ~/deals/acme

# Deal 2
./setup-new-deal.sh beta-merger ~/deals/beta

# Deal 3
./setup-new-deal.sh gamma-sale ~/deals/gamma
```

Each deal is **completely independent**:
- ✅ Separate data rooms
- ✅ Separate knowledge bases
- ✅ Separate outputs
- ✅ No cross-contamination

---

## What the Script Does

### 1. Creates Deal Directory

```bash
mkdir -p ~/deals/my-deal
```

### 2. Copies Manda Module

```bash
cp -r manda/ ~/deals/my-deal/manda/
```

Complete module with:
- All 5 agents
- Both workflows
- Workflow engine
- Configuration
- Documentation

### 3. Creates Data Room Structure

```bash
mkdir -p data/deals/{financials,legal,operational,commercial,strategic}
```

Organized folders for document upload.

### 4. Creates Knowledge Base

```bash
mkdir -p data/knowledge-base/{vector-store,structured-data,metadata}
```

For RAG system (when implemented).

### 5. Creates Output Directories

```bash
mkdir -p output/{reports,storylines,cims,teasers}
```

Where generated documents are saved.

### 6. Generates Deal Config

```yaml
# deal-config.yaml
deal:
  name: "my-deal"
  created: "2024-11-10T16:30:00Z"

target_company:
  name: ""  # Fill in
  industry: ""

paths:
  data_room: "./data/deals"
  output: "./output"
```

### 7. Creates Documentation

- `README.md` - Deal-specific guide
- `data/deals/README.md` - Data room instructions
- `.gitignore` - Proper git ignore rules

### 8. Creates Helper Scripts

- `start-analysis.sh` - Quick start guide

---

## Directory Size

Fresh setup:
- **Module:** ~2MB (agents, workflows, docs)
- **Structure:** ~1KB (empty directories)
- **Total:** ~2MB per deal

After analysis:
- **Data room:** Depends on uploaded documents
- **Knowledge base:** Grows with indexed documents
- **Output:** Generated reports/CIMs

---

## Cleanup

To remove a deal environment:

```bash
rm -rf ~/deals/my-deal
```

All data for that deal is removed. Other deals unaffected.

---

## Git Integration

Each deal can be its own git repository:

```bash
cd ~/deals/my-deal
git init
git add .
git commit -m "Initial deal setup: My Deal"
```

The `.gitignore` is pre-configured to:
- ✅ Track module and config
- ✅ Track README and structure
- ❌ Ignore uploaded documents (data/deals/*)
- ❌ Ignore knowledge base (data/knowledge-base/*)
- ❌ Ignore outputs (output/*)

---

## Advanced: Custom Template

Create your own template directory:

```bash
# 1. Create template deal
./setup-new-deal.sh template-deal ~/templates/manda-template

# 2. Customize it
cd ~/templates/manda-template
# Edit configs, add standard documents, etc.

# 3. Use template for new deals
cp -r ~/templates/manda-template ~/deals/new-deal
```

---

## Automation Examples

### Batch Setup

```bash
# Create multiple deals at once
for deal in acme beta gamma delta; do
  ./setup-new-deal.sh "${deal}-acquisition" ~/deals/${deal}
done
```

### API Integration

```javascript
// Node.js example
const { exec } = require('child_process');

async function setupNewDeal(dealName, targetDir) {
  return new Promise((resolve, reject) => {
    exec(`./setup-new-deal.sh ${dealName} ${targetDir}`, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// Usage
await setupNewDeal('new-deal', './deals/new-deal');
```

---

## Troubleshooting

### Script Not Executable

```bash
chmod +x setup-new-deal.sh
```

### Directory Already Exists

Script will prompt:
```
Warning: Directory already exists
Overwrite? (y/N):
```

Type `y` to overwrite or `N` to cancel.

### Module Not Found

Ensure you run the script from the manda directory:
```bash
cd /path/to/bmad/manda
./setup-new-deal.sh
```

---

## Production Deployment

For production use, you could:

### Option 1: Web Service

```python
# Flask example
@app.post('/api/deals/setup')
def setup_deal():
    deal_name = request.json['name']
    subprocess.run(['./setup-new-deal.sh', deal_name, f'/deals/{deal_name}'])
    return {'status': 'success', 'path': f'/deals/{deal_name}'}
```

### Option 2: Desktop App

```javascript
// Electron example
ipcMain.handle('setup-deal', async (event, dealName) => {
  const { spawn } = require('child_process');
  const process = spawn('./setup-new-deal.sh', [dealName]);
  // Handle output...
});
```

### Option 3: CLI Tool

Package as standalone executable:
```bash
# Package script
npm install -g pkg
pkg setup-new-deal.sh -t node16-macos-x64
```

---

## Summary

**Quick Setup:**
```bash
./setup-new-deal.sh my-deal
cd deals/my-deal
# Upload documents
# Start analysis
```

**Result:**
- ✅ Fresh isolated environment
- ✅ Complete M&A module
- ✅ Organized structure
- ✅ Ready in seconds
- ✅ No cross-contamination between deals

**Perfect for:**
- Multiple concurrent deals
- Clean slate per deal
- Easy setup/teardown
- Isolated analysis environments

---

**Ready to analyze deals!** 🎉
