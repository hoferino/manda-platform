/**
 * M&A Deal Intelligence Platform - Agent Compilation Check
 *
 * Verifies that all agent YAML files can be compiled to Markdown format correctly
 * and validates configuration variable substitution.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class AgentCompiler {
  constructor(moduleRoot) {
    this.moduleRoot = moduleRoot;
    this.errors = [];
    this.warnings = [];
    this.passed = [];
    this.compiledAgents = [];
  }

  /**
   * Main compilation entry point
   */
  async compile() {
    console.log('🔨 M&A Platform Agent Compilation Check\n');
    console.log('='.repeat(70));

    try {
      await this.loadConfigVariables();
      await this.compileAllAgents();
      await this.validateConfigSubstitution();
      await this.displayResults();

      return {
        success: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        compiledAgents: this.compiledAgents
      };
    } catch (error) {
      console.error('\n❌ Compilation failed with error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load configuration variables from install-config.yaml
   */
  async loadConfigVariables() {
    console.log('\n📋 Loading Configuration Variables...');

    const configPath = path.join(this.moduleRoot, '_module-installer', 'install-config.yaml');

    if (!fs.existsSync(configPath)) {
      this.errors.push('install-config.yaml not found');
      return;
    }

    try {
      this.config = yaml.load(fs.readFileSync(configPath, 'utf8'));
      this.passed.push('✓ Configuration loaded successfully');
    } catch (error) {
      this.errors.push(`Failed to load config: ${error.message}`);
    }
  }

  /**
   * Compile all agent YAML files
   */
  async compileAllAgents() {
    console.log('\n🤖 Compiling Agent Files...');

    const agentsDir = path.join(this.moduleRoot, 'agents');
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.yaml'));

    for (const agentFile of agentFiles) {
      await this.compileAgent(path.join(agentsDir, agentFile));
    }
  }

  /**
   * Compile a single agent file to Markdown
   */
  async compileAgent(agentPath) {
    const agentFile = path.basename(agentPath);

    try {
      const agent = yaml.load(fs.readFileSync(agentPath, 'utf8'));

      // Validate required fields
      const requiredFields = ['name', 'role', 'code', 'system_prompt', 'capabilities', 'type', 'version'];
      for (const field of requiredFields) {
        if (!agent[field]) {
          this.errors.push(`${agentFile}: Missing required field '${field}'`);
          return;
        }
      }

      // Generate Markdown
      const markdown = this.generateMarkdown(agent);

      // Validate markdown generation
      if (!markdown || markdown.length < 100) {
        this.errors.push(`${agentFile}: Generated markdown is too short or empty`);
        return;
      }

      // Check for config variable substitution needs
      const configVars = this.extractConfigVariables(markdown);
      if (configVars.length > 0) {
        this.passed.push(`✓ ${agentFile}: Uses ${configVars.length} config variable(s)`);
      }

      this.compiledAgents.push({
        file: agentFile,
        code: agent.code,
        name: agent.name,
        type: agent.type,
        markdownLength: markdown.length,
        configVariables: configVars
      });

      this.passed.push(`✓ ${agentFile} compiled successfully (${markdown.length} chars)`);

    } catch (error) {
      this.errors.push(`${agentFile}: Compilation error - ${error.message}`);
    }
  }

  /**
   * Generate Markdown from agent YAML
   */
  generateMarkdown(agent) {
    let md = [];

    // Header
    md.push(`# ${agent.name}`);
    md.push('');
    md.push(`**Role:** ${agent.role}`);
    md.push(`**Code:** ${agent.code}`);
    md.push(`**Type:** ${agent.type}`);
    md.push(`**Version:** ${agent.version}`);
    md.push('');

    // Persona (if exists)
    if (agent.persona) {
      md.push('## Persona');
      md.push('');
      if (agent.persona.expertise) {
        md.push('**Expertise:**');
        agent.persona.expertise.forEach(item => md.push(`- ${item}`));
        md.push('');
      }
      if (agent.persona.communication_style) {
        md.push('**Communication Style:**');
        agent.persona.communication_style.forEach(item => md.push(`- ${item}`));
        md.push('');
      }
      if (agent.persona.core_principles) {
        md.push('**Core Principles:**');
        agent.persona.core_principles.forEach(item => md.push(`- ${item}`));
        md.push('');
      }
    }

    // System Prompt
    md.push('## System Prompt');
    md.push('');
    md.push(agent.system_prompt);
    md.push('');

    // Capabilities
    if (agent.capabilities && agent.capabilities.length > 0) {
      md.push('## Capabilities');
      md.push('');
      agent.capabilities.forEach(cap => {
        md.push(`### ${cap.name}`);
        md.push('');
        md.push(`**Description:** ${cap.description}`);
        if (cap.input) md.push(`**Input:** ${cap.input}`);
        if (cap.output) md.push(`**Output:** ${cap.output}`);
        md.push('');
      });
    }

    // Tools (if exists)
    if (agent.tools && agent.tools.length > 0) {
      md.push('## Tools');
      md.push('');
      agent.tools.forEach(tool => {
        md.push(`### ${tool.name}`);
        md.push('');
        md.push(`**Description:** ${tool.description}`);
        if (tool.usage) md.push(`**Usage:** ${tool.usage}`);
        if (tool.implementation) md.push(`**Implementation:** ${tool.implementation}`);
        md.push('');
      });
    }

    // Menu (if exists - for module agents)
    if (agent.menu && agent.menu.length > 0) {
      md.push('## Menu');
      md.push('');
      agent.menu.forEach(item => {
        md.push(`### /${item.trigger}`);
        md.push('');
        md.push(`**Description:** ${item.description}`);
        md.push(`**Action:** ${item.action}`);
        if (item.prompt) {
          md.push('');
          md.push('**Prompt:**');
          md.push('```');
          md.push(item.prompt);
          md.push('```');
        }
        md.push('');
      });
    }

    // Behavior (if exists)
    if (agent.behavior) {
      md.push('## Behavior Flags');
      md.push('');
      Object.keys(agent.behavior).forEach(key => {
        md.push(`- **${key}:** ${agent.behavior[key]}`);
      });
      md.push('');
    }

    // Quality Standards (if exists)
    if (agent.quality_standards && agent.quality_standards.length > 0) {
      md.push('## Quality Standards');
      md.push('');
      agent.quality_standards.forEach(standard => {
        md.push(`- ${standard}`);
      });
      md.push('');
    }

    // Configuration Source
    if (agent.config_source) {
      md.push('## Configuration');
      md.push('');
      md.push(`**Source:** ${agent.config_source}`);
      md.push('');
    }

    return md.join('\n');
  }

  /**
   * Extract config variables from markdown ({{variable_name}})
   */
  extractConfigVariables(markdown) {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(markdown)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Validate configuration variable substitution
   */
  async validateConfigSubstitution() {
    console.log('\n🔧 Validating Configuration Substitution...');

    const allConfigVars = new Set();
    this.compiledAgents.forEach(agent => {
      agent.configVariables.forEach(v => allConfigVars.add(v));
    });

    if (allConfigVars.size === 0) {
      this.passed.push('✓ No config variables need substitution');
      return;
    }

    // Check that all config variables are defined
    for (const varName of allConfigVars) {
      if (!this.config || !this.config[varName]) {
        this.warnings.push(`Config variable '${varName}' used in agents but not defined in install-config.yaml`);
      } else {
        this.passed.push(`✓ Config variable '${varName}' is defined`);
      }
    }

    // Test substitution
    const testAgent = this.compiledAgents.find(a => a.configVariables.length > 0);
    if (testAgent) {
      let markdown = fs.readFileSync(
        path.join(this.moduleRoot, 'agents', testAgent.file),
        'utf8'
      );

      // Simulate substitution
      for (const varName of allConfigVars) {
        const testValue = this.config[varName]?.result || this.config[varName]?.default || `{{${varName}}}`;
        markdown = markdown.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), testValue);
      }

      // Check if substitution worked
      if (markdown.includes('{{')) {
        this.warnings.push('Some config variables may not have substituted correctly');
      } else {
        this.passed.push('✓ Config variable substitution test passed');
      }
    }
  }

  /**
   * Display compilation results
   */
  async displayResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPILATION RESULTS');
    console.log('='.repeat(70));

    if (this.compiledAgents.length > 0) {
      console.log('\n✅ COMPILED AGENTS:');
      this.compiledAgents.forEach(agent => {
        console.log(`  • ${agent.name} (${agent.type}) - ${agent.markdownLength} chars`);
        if (agent.configVariables.length > 0) {
          console.log(`    Variables: ${agent.configVariables.join(', ')}`);
        }
      });
    }

    if (this.passed.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.passed.forEach(msg => console.log(`  ${msg}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(msg => console.log(`  ⚠️  ${msg}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(msg => console.log(`  ❌ ${msg}`));
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Summary: ${this.compiledAgents.length} agents compiled, ${this.passed.length} checks passed, ${this.warnings.length} warnings, ${this.errors.length} errors`);
    console.log('='.repeat(70));

    if (this.errors.length === 0) {
      console.log('\n✅ Agent compilation PASSED!\n');
      console.log('All agents are ready for deployment.\n');
    } else {
      console.log('\n❌ Agent compilation FAILED!\n');
      console.log('Please fix the errors above and re-run compilation check.\n');
    }
  }
}

/**
 * Entry point for running compilation check
 */
async function compile() {
  const moduleRoot = path.join(__dirname, '..');
  const compiler = new AgentCompiler(moduleRoot);
  return await compiler.compile();
}

// Run compilation if called directly
if (require.main === module) {
  compile().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { compile, AgentCompiler };
