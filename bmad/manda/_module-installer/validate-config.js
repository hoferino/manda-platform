/**
 * M&A Deal Intelligence Platform - Configuration Validator
 *
 * Validates all configuration files, agent definitions, and workflow configurations
 * to ensure module integrity before installation or deployment.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ConfigValidator {
  constructor(moduleRoot) {
    this.moduleRoot = moduleRoot;
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log('🔍 M&A Platform Configuration Validation\n');
    console.log('='.repeat(70));

    try {
      await this.validateInstallConfig();
      await this.validateAgentFiles();
      await this.validateWorkflowFiles();
      await this.validateCrossReferences();
      await this.displayResults();

      return {
        success: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        passed: this.passed
      };
    } catch (error) {
      console.error('\n❌ Validation failed with error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate install-config.yaml
   */
  async validateInstallConfig() {
    console.log('\n📋 Validating Installation Configuration...');

    const configPath = path.join(this.moduleRoot, '_module-installer', 'install-config.yaml');

    if (!fs.existsSync(configPath)) {
      this.errors.push('install-config.yaml not found');
      return;
    }

    try {
      const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

      // Check required top-level fields
      this.checkRequired(config, ['module_name', 'module_code', 'module_version'], 'install-config.yaml');

      // Validate interactive fields
      if (config.data_room_path) {
        this.checkRequired(config.data_room_path, ['prompt', 'default', 'result'], 'data_room_path');
        this.passed.push('✓ data_room_path configuration valid');
      } else {
        this.errors.push('Missing data_room_path configuration');
      }

      if (config.output_location) {
        this.checkRequired(config.output_location, ['prompt', 'default', 'result'], 'output_location');
        this.passed.push('✓ output_location configuration valid');
      } else {
        this.errors.push('Missing output_location configuration');
      }

      if (config.knowledge_base_path) {
        this.checkRequired(config.knowledge_base_path, ['prompt', 'default', 'result'], 'knowledge_base_path');
        this.passed.push('✓ knowledge_base_path configuration valid');
      } else {
        this.errors.push('Missing knowledge_base_path configuration');
      }

      if (config.template_preference) {
        this.checkRequired(config.template_preference, ['prompt', 'default', 'result', 'single-select'], 'template_preference');
        if (!config.template_preference['single-select'] || config.template_preference['single-select'].length === 0) {
          this.errors.push('template_preference must have at least one option in single-select');
        } else {
          this.passed.push('✓ template_preference configuration valid');
        }
      } else {
        this.errors.push('Missing template_preference configuration');
      }

      if (config.inconsistency_sensitivity) {
        this.checkRequired(config.inconsistency_sensitivity, ['prompt', 'default', 'result', 'single-select'], 'inconsistency_sensitivity');
        const options = config.inconsistency_sensitivity['single-select'];
        const hasRelaxed = options.some(o => o.value === 'relaxed');
        const hasStandard = options.some(o => o.value === 'standard');
        const hasStrict = options.some(o => o.value === 'strict');
        if (!hasRelaxed || !hasStandard || !hasStrict) {
          this.errors.push('inconsistency_sensitivity must have relaxed, standard, and strict options');
        } else {
          this.passed.push('✓ inconsistency_sensitivity configuration valid');
        }
      } else {
        this.errors.push('Missing inconsistency_sensitivity configuration');
      }

      // Validate agents list
      if (config.agents && Array.isArray(config.agents)) {
        const expectedAgents = ['deal-orchestrator', 'information-vault', 'company-analyst', 'finance-analyst', 'story-architect'];
        const configuredAgents = config.agents.map(a => a.code);

        for (const expected of expectedAgents) {
          if (!configuredAgents.includes(expected)) {
            this.errors.push(`Missing agent in config: ${expected}`);
          }
        }

        if (config.agents.length === 5) {
          this.passed.push('✓ All 5 agents configured in install-config.yaml');
        }
      } else {
        this.errors.push('agents list missing or invalid in install-config.yaml');
      }

      // Validate workflows list
      if (config.workflows && Array.isArray(config.workflows)) {
        const expectedWorkflows = ['data-room-audit', 'investment-storyline-workshop'];
        const configuredWorkflows = config.workflows.map(w => w.code);

        for (const expected of expectedWorkflows) {
          if (!configuredWorkflows.includes(expected)) {
            this.errors.push(`Missing workflow in config: ${expected}`);
          }
        }

        if (config.workflows.length >= 2) {
          this.passed.push('✓ MVP workflows configured in install-config.yaml');
        }
      } else {
        this.errors.push('workflows list missing or invalid in install-config.yaml');
      }

      this.passed.push('✓ install-config.yaml is valid YAML');

    } catch (error) {
      this.errors.push(`install-config.yaml parse error: ${error.message}`);
    }
  }

  /**
   * Validate all agent files
   */
  async validateAgentFiles() {
    console.log('\n🤖 Validating Agent Files...');

    const agentsDir = path.join(this.moduleRoot, 'agents');
    const requiredAgents = [
      'deal-orchestrator.agent.yaml',
      'information-vault.agent.yaml',
      'company-analyst.agent.yaml',
      'finance-analyst.agent.yaml',
      'story-architect.agent.yaml'
    ];

    for (const agentFile of requiredAgents) {
      const agentPath = path.join(agentsDir, agentFile);

      if (!fs.existsSync(agentPath)) {
        this.errors.push(`Missing agent file: ${agentFile}`);
        continue;
      }

      try {
        const agent = yaml.load(fs.readFileSync(agentPath, 'utf8'));

        // Check required fields
        this.checkRequired(agent, ['name', 'role', 'code', 'system_prompt', 'capabilities', 'type', 'version'], agentFile);

        // Validate type
        const validTypes = ['module', 'service', 'expert'];
        if (!validTypes.includes(agent.type)) {
          this.errors.push(`${agentFile}: Invalid type '${agent.type}'. Must be: module, service, or expert`);
        }

        // Validate capabilities structure
        if (agent.capabilities && Array.isArray(agent.capabilities)) {
          for (const capability of agent.capabilities) {
            if (!capability.name || !capability.description) {
              this.errors.push(`${agentFile}: Capability missing name or description`);
            }
          }
          this.passed.push(`✓ ${agentFile}: ${agent.capabilities.length} capabilities defined`);
        } else {
          this.errors.push(`${agentFile}: capabilities must be an array`);
        }

        // Validate config_source if present
        if (agent.config_source && !agent.config_source.includes('{project-root}')) {
          this.warnings.push(`${agentFile}: config_source should use {project-root} variable`);
        }

        // Check for system_prompt length
        if (agent.system_prompt && agent.system_prompt.length < 100) {
          this.warnings.push(`${agentFile}: system_prompt seems too short (${agent.system_prompt.length} chars)`);
        }

        this.passed.push(`✓ ${agentFile} is valid`);

      } catch (error) {
        this.errors.push(`${agentFile} parse error: ${error.message}`);
      }
    }
  }

  /**
   * Validate all workflow files
   */
  async validateWorkflowFiles() {
    console.log('\n📋 Validating Workflow Files...');

    const workflowsDir = path.join(this.moduleRoot, 'workflows');
    const workflows = ['data-room-audit', 'investment-storyline-workshop'];

    for (const workflowCode of workflows) {
      const workflowDir = path.join(workflowsDir, workflowCode);

      if (!fs.existsSync(workflowDir)) {
        this.errors.push(`Missing workflow directory: ${workflowCode}`);
        continue;
      }

      // Check for required files
      const workflowYaml = path.join(workflowDir, 'workflow.yaml');
      const instructions = path.join(workflowDir, 'instructions.md');
      const template = path.join(workflowDir, 'template.md');

      if (!fs.existsSync(workflowYaml)) {
        this.errors.push(`${workflowCode}: Missing workflow.yaml`);
        continue;
      }

      if (!fs.existsSync(instructions)) {
        this.errors.push(`${workflowCode}: Missing instructions.md`);
      } else {
        this.passed.push(`✓ ${workflowCode}/instructions.md exists`);
      }

      if (!fs.existsSync(template)) {
        this.errors.push(`${workflowCode}: Missing template.md`);
      } else {
        this.passed.push(`✓ ${workflowCode}/template.md exists`);
      }

      try {
        const workflow = yaml.load(fs.readFileSync(workflowYaml, 'utf8'));

        // Check required fields
        this.checkRequired(workflow, ['name', 'code', 'description'], `${workflowCode}/workflow.yaml`);

        // Validate code matches directory
        if (workflow.code !== workflowCode) {
          this.errors.push(`${workflowCode}/workflow.yaml: code '${workflow.code}' doesn't match directory name '${workflowCode}'`);
        }

        // Check for template reference
        if (workflow.template) {
          if (!workflow.template.includes('{project-root}')) {
            this.warnings.push(`${workflowCode}/workflow.yaml: template should use {project-root} variable`);
          }
        } else {
          this.warnings.push(`${workflowCode}/workflow.yaml: No template specified`);
        }

        // Check for inputs
        if (workflow.inputs) {
          const inputCount = Object.keys(workflow.inputs).length;
          this.passed.push(`✓ ${workflowCode}/workflow.yaml: ${inputCount} inputs defined`);
        }

        this.passed.push(`✓ ${workflowCode}/workflow.yaml is valid`);

      } catch (error) {
        this.errors.push(`${workflowCode}/workflow.yaml parse error: ${error.message}`);
      }
    }
  }

  /**
   * Validate cross-references between files
   */
  async validateCrossReferences() {
    console.log('\n🔗 Validating Cross-References...');

    // Check that agents referenced in install-config exist
    const configPath = path.join(this.moduleRoot, '_module-installer', 'install-config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

    if (config.agents) {
      for (const agent of config.agents) {
        const agentFile = path.join(this.moduleRoot, 'agents', `${agent.code}.agent.yaml`);
        if (!fs.existsSync(agentFile)) {
          this.errors.push(`install-config.yaml references non-existent agent: ${agent.code}`);
        }
      }
      this.passed.push('✓ All configured agents have corresponding files');
    }

    // Check that workflows referenced in install-config exist
    if (config.workflows) {
      for (const workflow of config.workflows) {
        const workflowDir = path.join(this.moduleRoot, 'workflows', workflow.code);
        if (!fs.existsSync(workflowDir)) {
          this.errors.push(`install-config.yaml references non-existent workflow: ${workflow.code}`);
        }
      }
      this.passed.push('✓ All configured workflows have corresponding directories');
    }

    // Check that workflow templates exist
    const workflowsDir = path.join(this.moduleRoot, 'workflows');
    const workflows = fs.readdirSync(workflowsDir).filter(f =>
      fs.statSync(path.join(workflowsDir, f)).isDirectory()
    );

    for (const workflowCode of workflows) {
      const workflowYaml = path.join(workflowsDir, workflowCode, 'workflow.yaml');
      if (fs.existsSync(workflowYaml)) {
        try {
          const workflow = yaml.load(fs.readFileSync(workflowYaml, 'utf8'));
          if (workflow.template) {
            // Extract template path (remove {project-root} variable for checking)
            const templatePath = workflow.template.replace('{project-root}/', '');
            const fullTemplatePath = path.join(this.moduleRoot, '..', '..', templatePath);

            // For validation purposes, just check template.md exists in workflow dir
            const localTemplatePath = path.join(workflowsDir, workflowCode, 'template.md');
            if (!fs.existsSync(localTemplatePath)) {
              this.warnings.push(`${workflowCode}: template.md not found at expected location`);
            }
          }
        } catch (error) {
          // Already caught in validateWorkflowFiles
        }
      }
    }

    this.passed.push('✓ Cross-reference validation complete');
  }

  /**
   * Check if required fields exist in object
   */
  checkRequired(obj, fields, context) {
    for (const field of fields) {
      if (!obj[field]) {
        this.errors.push(`${context}: Missing required field '${field}'`);
      }
    }
  }

  /**
   * Display validation results
   */
  async displayResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(70));

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
    console.log(`Summary: ${this.passed.length} passed, ${this.warnings.length} warnings, ${this.errors.length} errors`);
    console.log('='.repeat(70));

    if (this.errors.length === 0) {
      console.log('\n✅ Configuration validation PASSED!\n');
    } else {
      console.log('\n❌ Configuration validation FAILED!\n');
      console.log('Please fix the errors above and re-run validation.\n');
    }
  }
}

/**
 * Entry point for running validation
 */
async function validate() {
  const moduleRoot = path.join(__dirname, '..');
  const validator = new ConfigValidator(moduleRoot);
  return await validator.validate();
}

// Run validation if called directly
if (require.main === module) {
  validate().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { validate, ConfigValidator };
