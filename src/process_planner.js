/**
 * Process Flow Planner
 * Generates fabrication process flows from layout and recipe database
 */

const fs = require('fs');
const path = require('path');

// Load recipe database
const recipePath = path.join(__dirname, 'recipe_db.json');
const recipes = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

/**
 * Generate process flow from layout and selected recipe
 */
function generateFlow(layout, processType = 'cmos_standard') {
  if (!recipes[processType]) {
    throw new Error(`Unknown process type: ${processType}`);
  }
  
  const recipe = recipes[processType];
  
  // Map layout layers to process steps
  const mappedSteps = mapLayersToSteps(layout, recipe);
  
  // Calculate durations
  const totalDuration = calculateDuration(mappedSteps);
  
  return {
    name: recipe.name,
    process_type: processType,
    technology_node: recipe.technology_node || 'N/A',
    application: recipe.application || 'General',
    layout_file: layout.filename,
    layers_used: layout.layers.length,
    steps: mappedSteps,
    total_steps: mappedSteps.length,
    estimated_duration_hours: totalDuration
  };
}

/**
 * Map layout layers to recipe steps
 */
function mapLayersToSteps(layout, recipe) {
  const steps = [];
  const layerMap = {};
  
  // Create layer name map
  layout.layers.forEach(layer => {
    layerMap[layer.name] = layer;
  });
  
  // Process each recipe step
  recipe.steps.forEach((step, index) => {
    const mappedStep = { ...step };
    
    // If step requires a layer, check if it exists in layout
    if (step.layer && layerMap[step.layer]) {
      mappedStep.layout_layer = layerMap[step.layer].number;
      mappedStep.feature_count = layerMap[step.layer].feature_count;
      mappedStep.status = 'matched';
    } else if (step.layer) {
      mappedStep.status = 'layer_missing';
      mappedStep.warning = `Layer ${step.layer} not found in layout`;
    } else {
      mappedStep.status = 'layer_independent';
    }
    
    steps.push(mappedStep);
  });
  
  return steps;
}

/**
 * Calculate total process duration
 */
function calculateDuration(steps) {
  let totalHours = 0;
  
  steps.forEach(step => {
    if (step.duration_min) {
      totalHours += step.duration_min / 60;
    } else {
      // Default durations by operation type
      const defaultDurations = {
        'lithography': 2,
        'etch': 1,
        'deposition': 3,
        'implantation': 2,
        'thermal_oxidation': 3,
        'cmp': 1.5,
        'metallization': 2,
        'strip': 0.5,
        'wet_etch': 0.5
      };
      
      totalHours += defaultDurations[step.operation] || 1;
    }
  });
  
  return Math.round(totalHours * 10) / 10;
}

/**
 * Analyze layout and suggest process type
 */
function analyzeLayout(layout) {
  const layerNames = layout.layers.map(l => l.name.toUpperCase());
  const featureCount = layout.feature_count;
  
  // Heuristics for process type suggestion
  let suggestedProcess = 'cmos_standard';
  let reason = 'Default CMOS process';
  let complexity = 'medium';
  
  // Check for MEMS indicators
  if (layerNames.some(name => name.includes('CANTILEVER') || name.includes('MEMBRANE'))) {
    if (layerNames.some(name => name.includes('ELECTRODE'))) {
      suggestedProcess = 'mems_cantilever';
      reason = 'Detected cantilever structures with electrodes';
    } else {
      suggestedProcess = 'mems_pressure_sensor';
      reason = 'Detected MEMS membrane structures';
    }
    complexity = 'high';
  }
  // Check for photonics indicators
  else if (layerNames.some(name => name.includes('WAVEGUIDE') || name.includes('GRATING'))) {
    suggestedProcess = 'photonics_waveguide';
    reason = 'Detected photonic waveguide patterns';
    complexity = 'high';
  }
  // Standard CMOS indicators
  else if (layerNames.includes('POLY') && layerNames.includes('ACTIVE')) {
    suggestedProcess = 'cmos_standard';
    reason = 'Standard CMOS layers detected (POLY, ACTIVE)';
    complexity = featureCount > 1000 ? 'high' : 'medium';
  }
  
  // Estimate minimum feature size
  const minFeatureSize = estimateMinFeatureSize(layout);
  
  return {
    suggested_process: suggestedProcess,
    reason: reason,
    complexity: complexity,
    min_feature_size: minFeatureSize,
    layer_count: layout.layers.length,
    feature_density: featureCount / (layout.bounding_box.max_x * layout.bounding_box.max_y)
  };
}

/**
 * Estimate minimum feature size from layout
 */
function estimateMinFeatureSize(layout) {
  // Simplified estimation
  // In real implementation, would analyze actual feature dimensions
  const area = layout.bounding_box.max_x * layout.bounding_box.max_y;
  const avgFeatureArea = area / layout.feature_count;
  return Math.round(Math.sqrt(avgFeatureArea) * 10) / 10;
}

/**
 * Format process flow as text
 */
function formatText(processFlow) {
  let output = '';
  
  output += '='.repeat(60) + '\n';
  output += `FABRICATION PROCESS FLOW\n`;
  output += '='.repeat(60) + '\n\n';
  
  output += `Process: ${processFlow.name}\n`;
  output += `Type: ${processFlow.process_type}\n`;
  output += `Technology: ${processFlow.technology_node}\n`;
  output += `Application: ${processFlow.application}\n`;
  output += `Layout File: ${processFlow.layout_file}\n`;
  output += `Total Steps: ${processFlow.total_steps}\n`;
  output += `Estimated Duration: ${processFlow.estimated_duration_hours} hours\n\n`;
  
  output += '-'.repeat(60) + '\n';
  output += 'PROCESS STEPS\n';
  output += '-'.repeat(60) + '\n\n';
  
  processFlow.steps.forEach(step => {
    output += `Step ${step.step}: ${step.operation.toUpperCase()}\n`;
    output += `  Description: ${step.description}\n`;
    
    if (step.material) {
      output += `  Material: ${step.material}\n`;
    }
    if (step.method) {
      output += `  Method: ${step.method}\n`;
    }
    if (step.thickness_nm) {
      output += `  Thickness: ${step.thickness_nm} nm\n`;
    }
    if (step.temperature_c) {
      output += `  Temperature: ${step.temperature_c}°C\n`;
    }
    if (step.layer) {
      output += `  Mask Layer: ${step.layer}\n`;
    }
    if (step.warning) {
      output += `  ⚠ WARNING: ${step.warning}\n`;
    }
    
    output += '\n';
  });
  
  return output;
}

/**
 * Format process flow as Markdown
 */
function formatMarkdown(processFlow) {
  let output = '';
  
  output += `# Fabrication Process Flow\n\n`;
  output += `## Process Information\n\n`;
  output += `- **Process**: ${processFlow.name}\n`;
  output += `- **Type**: ${processFlow.process_type}\n`;
  output += `- **Technology**: ${processFlow.technology_node}\n`;
  output += `- **Application**: ${processFlow.application}\n`;
  output += `- **Layout File**: ${processFlow.layout_file}\n`;
  output += `- **Total Steps**: ${processFlow.total_steps}\n`;
  output += `- **Estimated Duration**: ${processFlow.estimated_duration_hours} hours\n\n`;
  
  output += `## Process Steps\n\n`;
  
  processFlow.steps.forEach(step => {
    output += `### Step ${step.step}: ${step.operation}\n\n`;
    output += `${step.description}\n\n`;
    
    if (step.material || step.method || step.thickness_nm || step.temperature_c) {
      output += `**Parameters:**\n`;
      if (step.material) output += `- Material: ${step.material}\n`;
      if (step.method) output += `- Method: ${step.method}\n`;
      if (step.thickness_nm) output += `- Thickness: ${step.thickness_nm} nm\n`;
      if (step.temperature_c) output += `- Temperature: ${step.temperature_c}°C\n`;
      if (step.layer) output += `- Mask Layer: ${step.layer}\n`;
      output += '\n';
    }
    
    if (step.warning) {
      output += `> ⚠️ **Warning**: ${step.warning}\n\n`;
    }
  });
  
  return output;
}

module.exports = {
  generateFlow,
  analyzeLayout,
  formatText,
  formatMarkdown
};
