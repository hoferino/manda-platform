/**
 * M&A Deal Intelligence Platform - Complete Module Validation
 *
 * Runs all validation checks to ensure module is ready for deployment:
 * - Configuration validation
 * - Agent compilation check
 * - File structure verification
 * - Documentation completeness
 */

const { validate: validateConfig } = require('./validate-config');
const { compile: compileAgents } = require('./compile-agents');
const fs = require('fs');
const path = require('path');

class ModuleValidator {
  constructor(moduleRoot) {
    this.moduleRoot = moduleRoot;
    this.results = {
      configValidation: null,
      agentCompilation: null,
      fileStructure: null,
      documentation: null
    };
  }

  /**
   * Run complete module validation
   */
  async validate() {
    console.log('🎯 M&A Deal Intelligence Platform - Complete Module Validation\n');
    console.log('='.repeat(80));
    console.log('Running comprehensive validation checks...\n');

    try {
      // Step 1: Configuration Validation
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 1: Configuration Validation');
      console.log('━'.repeat(80));
      this.results.configValidation = await validateConfig();

      // Step 2: Agent Compilation
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 2: Agent Compilation Check');
      console.log('━'.repeat(80));
      this.results.agentCompilation = await compileAgents();

      // Step 3: File Structure
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 3: File Structure Verification');
      console.log('━'.repeat(80));
      this.results.fileStructure = await this.validateFileStructure();

      // Step 4: Documentation
      console.log('\n' + '━'.repeat(80));
      console.log('STEP 4: Documentation Completeness');
      console.log('━'.repeat(80));
      this.results.documentation = await this.validateDocumentation();

      // Display final summary
      await this.displayFinalSummary();

      const success = this.isValidationSuccessful();
      return {
        success,
        results: this.results
      };

    } catch (error) {
      console.error('\n❌ Module validation failed with error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate file structure
   */
  async validateFileStructure() {
    console.log('\n📁 Verifying Directory Structure...\n');

    const errors = [];
    const warnings = [];
    const passed = [];

    // Required directories
    const requiredDirs = [
      'agents',
      'workflows',
      'workflows/data-room-audit',
      'workflows/investment-storyline-workshop',
      'tasks',
      'cim-templates',
      'data',
      '_module-installer',
      'docs'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(this.moduleRoot, dir);
      if (fs.existsSync(dirPath)) {
        passed.push(`✓ Directory exists: ${dir}`);
      } else {
        errors.push(`Missing directory: ${dir}`);
      }
    }

    // Required files
    const requiredFiles = [
      'README.md',
      '_module-installer/install-config.yaml',
      '_module-installer/installer.js',
      '_module-installer/validate-config.js',
      '_module-installer/compile-agents.js',
      'docs/QUICKSTART.md',
      'docs/USER-GUIDE.md',
      'docs/COMPONENT-ROADMAP.md',
      'agents/deal-orchestrator.agent.yaml',
      'agents/information-vault.agent.yaml',
      'agents/company-analyst.agent.yaml',
      'agents/finance-analyst.agent.yaml',
      'agents/story-architect.agent.yaml',
      'agents/information-vault-rag-implementation.md',
      'workflows/data-room-audit/workflow.yaml',
      'workflows/data-room-audit/instructions.md',
      'workflows/data-room-audit/template.md',
      'workflows/investment-storyline-workshop/workflow.yaml',
      'workflows/investment-storyline-workshop/instructions.md',
      'workflows/investment-storyline-workshop/template.md',
      'workflows/investment-storyline-workshop/teaser-template.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.moduleRoot, file);
      if (fs.existsSync(filePath)) {
        passed.push(`✓ File exists: ${file}`);
      } else {
        errors.push(`Missing file: ${file}`);
      }
    }

    // Check for empty directories that should have content
    const tasksDirEmpty = fs.readdirSync(path.join(this.moduleRoot, 'tasks')).length === 0;
    if (tasksDirEmpty) {
      warnings.push('tasks/ directory is empty (optional for MVP)');
    }

    const templatesDirEmpty = fs.existsSync(path.join(this.moduleRoot, 'cim-templates')) &&
      fs.readdirSync(path.join(this.moduleRoot, 'cim-templates')).length === 0;
    if (templatesDirEmpty) {
      warnings.push('cim-templates/ directory is empty (workflow templates are sufficient for MVP)');
    }

    console.log(`  ${passed.length} files/directories verified`);
    if (errors.length > 0) {
      console.log(`  ${errors.length} missing files/directories`);
    }
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warnings`);
    }

    return {
      success: errors.length === 0,
      passed: passed.length,
      errors,
      warnings
    };
  }

  /**
   * Validate documentation completeness
   */
  async validateDocumentation() {
    console.log('\n📚 Verifying Documentation...\n');

    const errors = [];
    const warnings = [];
    const passed = [];

    // Check README
    const readmePath = path.join(this.moduleRoot, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf8');

      const requiredSections = [
        'Overview',
        'Architecture',
        'Agent System',
        'Workflows',
        'Installation',
        'Quick Start',
        'Development Status'
      ];

      for (const section of requiredSections) {
        if (readme.includes(section)) {
          passed.push(`✓ README contains '${section}' section`);
        } else {
          errors.push(`README missing '${section}' section`);
        }
      }

      if (readme.length > 3000) {
        passed.push(`✓ README is comprehensive (${readme.length} chars)`);
      } else {
        warnings.push(`README seems short (${readme.length} chars)`);
      }
    } else {
      errors.push('README.md not found');
    }

    // Check Quick Start Guide
    const quickstartPath = path.join(this.moduleRoot, 'docs', 'QUICKSTART.md');
    if (fs.existsSync(quickstartPath)) {
      const quickstart = fs.readFileSync(quickstartPath, 'utf8');

      if (quickstart.includes('Installation') && quickstart.includes('First-Time Setup')) {
        passed.push('✓ Quick Start Guide covers installation and setup');
      } else {
        errors.push('Quick Start Guide missing key sections');
      }

      if (quickstart.length > 5000) {
        passed.push(`✓ Quick Start Guide is detailed (${quickstart.length} chars)`);
      }
    } else {
      errors.push('QUICKSTART.md not found');
    }

    // Check User Guide
    const userGuidePath = path.join(this.moduleRoot, 'docs', 'USER-GUIDE.md');
    if (fs.existsSync(userGuidePath)) {
      const userGuide = fs.readFileSync(userGuidePath, 'utf8');

      const requiredTopics = [
        'Agent System',
        'Workflows',
        'Knowledge Base',
        'Data Room Management',
        'Inconsistency Detection',
        'Storyline Development'
      ];

      let topicCount = 0;
      for (const topic of requiredTopics) {
        if (userGuide.includes(topic)) {
          topicCount++;
        }
      }

      if (topicCount === requiredTopics.length) {
        passed.push(`✓ User Guide covers all ${requiredTopics.length} key topics`);
      } else {
        warnings.push(`User Guide missing some topics (${topicCount}/${requiredTopics.length})`);
      }

      if (userGuide.length > 20000) {
        passed.push(`✓ User Guide is comprehensive (${userGuide.length} chars)`);
      }
    } else {
      errors.push('USER-GUIDE.md not found');
    }

    // Check Component Roadmap
    const roadmapPath = path.join(this.moduleRoot, 'docs', 'COMPONENT-ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      const roadmap = fs.readFileSync(roadmapPath, 'utf8');

      if (roadmap.includes('Completed Components') && roadmap.includes('Remaining Work')) {
        passed.push('✓ Component Roadmap tracks progress');
      } else {
        warnings.push('Component Roadmap missing progress tracking');
      }
    } else {
      errors.push('COMPONENT-ROADMAP.md not found');
    }

    console.log(`  ${passed.length} documentation checks passed`);
    if (errors.length > 0) {
      console.log(`  ${errors.length} documentation issues`);
    }
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warnings`);
    }

    return {
      success: errors.length === 0,
      passed: passed.length,
      errors,
      warnings
    };
  }

  /**
   * Check if overall validation is successful
   */
  isValidationSuccessful() {
    return (
      this.results.configValidation?.success &&
      this.results.agentCompilation?.success &&
      this.results.fileStructure?.success &&
      this.results.documentation?.success
    );
  }

  /**
   * Display final validation summary
   */
  async displayFinalSummary() {
    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('🏁 FINAL VALIDATION SUMMARY');
    console.log('='.repeat(80));

    const checks = [
      {
        name: 'Configuration Validation',
        result: this.results.configValidation,
        icon: this.results.configValidation?.success ? '✅' : '❌'
      },
      {
        name: 'Agent Compilation',
        result: this.results.agentCompilation,
        icon: this.results.agentCompilation?.success ? '✅' : '❌'
      },
      {
        name: 'File Structure',
        result: this.results.fileStructure,
        icon: this.results.fileStructure?.success ? '✅' : '❌'
      },
      {
        name: 'Documentation',
        result: this.results.documentation,
        icon: this.results.documentation?.success ? '✅' : '❌'
      }
    ];

    console.log('\nValidation Checks:\n');
    checks.forEach(check => {
      console.log(`  ${check.icon} ${check.name}`);
      if (check.result?.errors && check.result.errors.length > 0) {
        console.log(`     Errors: ${check.result.errors.length}`);
      }
      if (check.result?.warnings && check.result.warnings.length > 0) {
        console.log(`     Warnings: ${check.result.warnings.length}`);
      }
    });

    console.log('\n' + '='.repeat(80));

    if (this.isValidationSuccessful()) {
      console.log('\n✅ MODULE VALIDATION PASSED!');
      console.log('\nThe M&A Deal Intelligence Platform is ready for deployment.');
      console.log('\nNext Steps:');
      console.log('  1. Review any warnings (if present)');
      console.log('  2. Run installation: bmad install manda');
      console.log('  3. Upload test documents to data room');
      console.log('  4. Test workflows end-to-end');
      console.log('  5. Deploy to production environment\n');
    } else {
      console.log('\n❌ MODULE VALIDATION FAILED!');
      console.log('\nPlease fix the errors identified above before deployment.');
      console.log('\nTo debug:');
      console.log('  - Review error messages in each validation step');
      console.log('  - Fix configuration or code issues');
      console.log('  - Re-run validation: node _module-installer/validate-module.js\n');
    }

    console.log('='.repeat(80));
  }
}

/**
 * Entry point for running complete module validation
 */
async function validateModule() {
  const moduleRoot = path.join(__dirname, '..');
  const validator = new ModuleValidator(moduleRoot);
  return await validator.validate();
}

// Run validation if called directly
if (require.main === module) {
  validateModule().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { validateModule, ModuleValidator };
