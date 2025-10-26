#!/usr/bin/env node

/**
 * Fab Process Generator CLI
 * Generates fabrication process flows from GDS-II layout files
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const gdsParser = require('../src/gds_parser');
const processPlanner = require('../src/process_planner');

const program = new Command();

program
  .name('fab-gen')
  .description('Generate nanofabrication process flows from GDS-II mask layouts')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate process flow from GDS-II file')
  .argument('<gds-file>', 'Path to GDS-II file')
  .option('-p, --process <type>', 'Process type (cmos_standard, mems_cantilever, mems_pressure_sensor, photonics_waveguide)', 'cmos_standard')
  .option('-o, --output <file>', 'Output file path', 'process_flow.txt')
  .option('-f, --format <format>', 'Output format (text, json, markdown)', 'text')
  .action((gdsFile, options) => {
    console.log(chalk.blue.bold('\n=== Fab Process Generator ===\n'));
    
    try {
      // Parse GDS-II file
      console.log(chalk.yellow('Parsing GDS-II file...'));
      const layout = gdsParser.parseGDS(gdsFile);
      console.log(chalk.green(`✓ Found ${layout.layers.length} layers`));
      
      // Generate process flow
      console.log(chalk.yellow('\nGenerating process flow...'));
      const processFlow = processPlanner.generateFlow(layout, options.process);
      console.log(chalk.green(`✓ Generated ${processFlow.steps.length} process steps`));
      
      // Format output
      let output;
      switch (options.format) {
        case 'json':
          output = JSON.stringify(processFlow, null, 2);
          break;
        case 'markdown':
          output = processPlanner.formatMarkdown(processFlow);
          break;
        default:
          output = processPlanner.formatText(processFlow);
      }
      
      // Write output
      fs.writeFileSync(options.output, output);
      console.log(chalk.green(`\n✓ Process flow saved to ${options.output}\n`));
      
      // Print summary
      console.log(chalk.cyan('Process Summary:'));
      console.log(`  Process: ${processFlow.name}`);
      console.log(`  Total Steps: ${processFlow.steps.length}`);
      console.log(`  Lithography Masks: ${layout.layers.length}`);
      console.log(`  Estimated Duration: ${processFlow.estimated_duration_hours} hours\n`);
      
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('list-recipes')
  .description('List available process recipes')
  .action(() => {
    console.log(chalk.blue.bold('\n=== Available Process Recipes ===\n'));
    
    const recipePath = path.join(__dirname, '../src/recipe_db.json');
    const recipes = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
    
    Object.entries(recipes).forEach(([id, recipe]) => {
      console.log(chalk.yellow.bold(id));
      console.log(`  Name: ${recipe.name}`);
      console.log(`  Steps: ${recipe.steps.length}`);
      if (recipe.technology_node) {
        console.log(`  Technology: ${recipe.technology_node}`);
      }
      if (recipe.application) {
        console.log(`  Application: ${recipe.application}`);
      }
      console.log();
    });
  });

program
  .command('analyze')
  .description('Analyze GDS-II layout and suggest process')
  .argument('<gds-file>', 'Path to GDS-II file')
  .action((gdsFile) => {
    console.log(chalk.blue.bold('\n=== Layout Analysis ===\n'));
    
    try {
      const layout = gdsParser.parseGDS(gdsFile);
      const analysis = processPlanner.analyzeLayout(layout);
      
      console.log(chalk.cyan('Layout Information:'));
      console.log(`  Layers: ${layout.layers.length}`);
      console.log(`  Features: ${layout.feature_count}`);
      console.log(`  Min Feature Size: ${analysis.min_feature_size} µm`);
      console.log(`  Complexity: ${analysis.complexity}`);
      
      console.log(chalk.cyan('\nSuggested Process:'));
      console.log(`  Type: ${chalk.green.bold(analysis.suggested_process)}`);
      console.log(`  Reason: ${analysis.reason}`);
      console.log();
      
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();
