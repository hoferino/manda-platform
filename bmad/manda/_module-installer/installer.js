/**
 * M&A Deal Intelligence Platform - Module Installer
 *
 * Custom installation logic for setting up the M&A module with proper
 * directory structure, knowledge base initialization, and template configuration.
 */

const fs = require('fs');
const path = require('path');

class MandaModuleInstaller {
  constructor(config) {
    this.config = config;
    this.projectRoot = config.projectRoot;
    this.moduleRoot = path.join(this.projectRoot, 'bmad', 'manda');
  }

  /**
   * Main installation entry point
   */
  async install() {
    console.log('🚀 Installing M&A Deal Intelligence Platform...\n');

    try {
      await this.validatePrerequisites();
      await this.createDirectoryStructure();
      await this.initializeKnowledgeBase();
      await this.setupOutputDirectories();
      await this.validateAgentFiles();
      await this.displayPostInstallInstructions();

      console.log('\n✅ M&A Deal Intelligence Platform installed successfully!\n');
      return { success: true };
    } catch (error) {
      console.error('\n❌ Installation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate installation prerequisites
   */
  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 16) {
      throw new Error(`Node.js 16+ required. Current version: ${nodeVersion}`);
    }

    // Check project structure
    if (!fs.existsSync(this.projectRoot)) {
      throw new Error(`Project root not found: ${this.projectRoot}`);
    }

    console.log('  ✓ Prerequisites validated');
  }

  /**
   * Create module directory structure
   */
  async createDirectoryStructure() {
    console.log('\n📁 Creating directory structure...');

    const directories = [
      // Data room structure
      this.config.data_room_path,
      path.join(this.config.data_room_path, 'financials'),
      path.join(this.config.data_room_path, 'legal'),
      path.join(this.config.data_room_path, 'operational'),
      path.join(this.config.data_room_path, 'commercial'),
      path.join(this.config.data_room_path, 'strategic'),

      // Knowledge base structure
      this.config.knowledge_base_path,
      path.join(this.config.knowledge_base_path, 'vector-store'),
      path.join(this.config.knowledge_base_path, 'structured-data'),
      path.join(this.config.knowledge_base_path, 'metadata'),

      // Output directories
      this.config.output_location,
      path.join(this.config.output_location, 'reports'),
      path.join(this.config.output_location, 'storylines'),
      path.join(this.config.output_location, 'cims'),
      path.join(this.config.output_location, 'teasers'),
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✓ Created: ${path.relative(this.projectRoot, dir)}`);
      } else {
        console.log(`  • Exists: ${path.relative(this.projectRoot, dir)}`);
      }
    }
  }

  /**
   * Initialize knowledge base with README files
   */
  async initializeKnowledgeBase() {
    console.log('\n📚 Initializing knowledge base...');

    // Create data room README
    const dataRoomReadme = `# Data Room

This directory contains deal-related documents organized by category.

## Directory Structure

- **financials/** - Financial statements, models, projections, tax returns
- **legal/** - Contracts, agreements, corporate documents, compliance
- **operational/** - Org charts, employee data, process docs, KPIs
- **commercial/** - Customer contracts, pricing, sales data, market research
- **strategic/** - Business plans, presentations, board materials

## Document Upload

Upload documents to the appropriate category folder. The Information Vault will:
1. Automatically parse and index documents
2. Extract key data points
3. Generate embeddings for semantic search
4. Cross-reference with existing knowledge

## Supported Formats

- PDF (with OCR support for scanned documents)
- Excel (.xlsx, .xls)
- Word (.docx, .doc)
- PowerPoint (.pptx, .ppt)
- Plain text (.txt, .md)

## Best Practices

1. Use descriptive filenames: \`2023-Audited-Financials.pdf\`
2. Include dates in filenames when relevant
3. Separate audited from unaudited financials
4. Mark draft documents clearly
5. Maintain original file names from company when possible
`;

    const dataRoomReadmePath = path.join(this.config.data_room_path, 'README.md');
    if (!fs.existsSync(dataRoomReadmePath)) {
      fs.writeFileSync(dataRoomReadmePath, dataRoomReadme);
      console.log('  ✓ Created data room README');
    }

    // Create knowledge base README
    const kbReadme = `# Knowledge Base

This directory contains the indexed and processed knowledge base for the M&A Deal Intelligence Platform.

## Structure

- **vector-store/** - Vector embeddings for semantic search (managed by RAG system)
- **structured-data/** - Normalized financial data, contracts, org charts
- **metadata/** - Document catalog, entity relationships, provenance tracking

## Management

The knowledge base is automatically managed by the Information Vault agent:
- Documents are parsed and indexed on upload
- Embeddings are generated using domain-aware models
- Structured data is extracted and normalized
- Metadata tracks all sources and provenance

## Do Not Modify

This directory is managed automatically. Manual changes may break the knowledge base.
Use the Information Vault agent to query and manage data.
`;

    const kbReadmePath = path.join(this.config.knowledge_base_path, 'README.md');
    if (!fs.existsSync(kbReadmePath)) {
      fs.writeFileSync(kbReadmePath, kbReadme);
      console.log('  ✓ Created knowledge base README');
    }
  }

  /**
   * Setup output directories with templates
   */
  async setupOutputDirectories() {
    console.log('\n📄 Setting up output directories...');

    const outputReadme = `# M&A Deal Intelligence Platform - Output

This directory contains generated documents and analysis reports.

## Directory Structure

- **reports/** - Data room audits, analysis reports, due diligence findings
- **storylines/** - Investment storyline briefs, thesis statements
- **cims/** - Confidential Information Memorandums (narrative and slide versions)
- **teasers/** - One-page investment teasers

## File Naming Convention

Files are automatically named with timestamps:
- \`data-room-audit-2024-01-15.md\`
- \`storyline-brief-2024-01-15.md\`
- \`investment-teaser-2024-01-15.md\`

## Version Control

All generated documents are versioned. Previous versions are preserved in case you need to revert.
`;

    const outputReadmePath = path.join(this.config.output_location, 'README.md');
    if (!fs.existsSync(outputReadmePath)) {
      fs.writeFileSync(outputReadmePath, outputReadme);
      console.log('  ✓ Created output directory README');
    }
  }

  /**
   * Validate that all agent files exist and are properly formatted
   */
  async validateAgentFiles() {
    console.log('\n🤖 Validating agent files...');

    const requiredAgents = [
      'deal-orchestrator.agent.yaml',
      'information-vault.agent.yaml',
      'company-analyst.agent.yaml',
      'finance-analyst.agent.yaml',
      'story-architect.agent.yaml'
    ];

    const agentsDir = path.join(this.moduleRoot, 'agents');

    for (const agentFile of requiredAgents) {
      const agentPath = path.join(agentsDir, agentFile);
      if (!fs.existsSync(agentPath)) {
        throw new Error(`Missing agent file: ${agentFile}`);
      }
      console.log(`  ✓ ${agentFile}`);
    }
  }

  /**
   * Display post-installation instructions
   */
  async displayPostInstallInstructions() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 POST-INSTALLATION INSTRUCTIONS');
    console.log('='.repeat(70));
    console.log(`
Next Steps:

1. 📂 Upload Deal Documents
   → Add documents to: ${path.relative(this.projectRoot, this.config.data_room_path)}
   → Organize by category (financials, legal, operational, commercial, strategic)

2. 🚀 Activate the Module
   → Run: /manda:deal-orchestrator
   → This starts the Deal Orchestrator (primary interface)

3. 🔍 Run Initial Analysis
   → Data Room Audit: /manda:data-room-audit
   → This scans all documents and identifies gaps

4. 📖 Develop Investment Storyline
   → Storyline Workshop: /manda:investment-storyline-workshop
   → Interactive process to create compelling narrative

Configuration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data Room:              ${this.config.data_room_path}
Knowledge Base:         ${this.config.knowledge_base_path}
Output Location:        ${this.config.output_location}
Template Style:         ${this.config.template_preference}
Inconsistency Detection: ${this.config.inconsistency_sensitivity}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available Agents:
  • Deal Orchestrator     - Primary user interface and coordinator
  • Information Vault     - RAG-powered data retrieval engine
  • Company Analyst       - Business intelligence specialist
  • Finance Analyst       - Financial analysis and valuation
  • Story Architect       - Narrative development for CIMs

Available Workflows:
  • data-room-audit              - Comprehensive data room analysis
  • investment-storyline-workshop - Interactive storyline development

Documentation:
  • Module README: ${path.join(this.moduleRoot, 'README.md')}
  • RAG Implementation Guide: ${path.join(this.moduleRoot, 'agents', 'information-vault-rag-implementation.md')}

Need Help?
  • View agent capabilities: Check agent YAML files in ${path.join(this.moduleRoot, 'agents')}
  • Workflow documentation: Check instructions.md in workflow directories
`);
    console.log('='.repeat(70) + '\n');
  }
}

/**
 * Installation entry point called by BMAD installer
 */
async function install(config) {
  const installer = new MandaModuleInstaller(config);
  return await installer.install();
}

module.exports = { install };
