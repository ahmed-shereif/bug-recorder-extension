/**
 * Step processing utilities for merging, deduplication, and compaction
 */

import { getPathFromURL } from '../shared/utils.js';
import { TIMEOUTS } from '../shared/constants.js';

/**
 * Merge and deduplicate steps for cleaner reports
 * @param {Array} steps - Array of recorded steps
 * @returns {Array} Merged and deduplicated steps
 */
export function mergeSteps(steps) {
  // First, remove duplicates from the data
  const deduplicated = removeDuplicates(steps);
  
  const merged = [];
  let i = 0;
  
  while (i < deduplicated.length) {
    const current = deduplicated[i];
    
    // Skip unnecessary clicks on containers/wrappers
    if (current.type === 'click' && isContainerClick(current)) {
      i++;
      continue;
    }
    
    // Merge dropdown selection (click to open + click option)
    if (current.type === 'click' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      // Check if this is opening a dropdown and next is selecting an option
      if (next.type === 'click' && 
          isDropdownOpen(current) && 
          isDropdownOption(next) &&
          next.timestamp - current.timestamp < 3000) {
        
        merged.push({
          type: 'input',
          description: `Selected "${next.details?.text || ''}" in ${current.details?.label || 'dropdown'}`,
          timestamp: current.timestamp,
          url: current.url,
          details: {
            fieldLabel: current.details?.label,
            fieldType: 'select',
            value: next.details?.text,
            selector: next.details?.selector
          }
        });
        i += 2;
        continue;
      }
    }
    
    // Merge duplicate input + change events
    if (current.type === 'input' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      if (next.type === 'input' && 
          current.details?.fieldName === next.details?.fieldName &&
          next.timestamp - current.timestamp < 100) {
        // Skip the duplicate, keep the first one
        merged.push(current);
        i += 2;
        continue;
      }
    }
    
    // Deduplicate consecutive navigation events
    if (current.type === 'navigation' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      if (next.type === 'navigation' && 
          current.url === next.url &&
          next.timestamp - current.timestamp < 1000) {
        merged.push(current);
        i += 2;
        continue;
      }
    }
    
    merged.push(current);
    i++;
  }
  
  return merged;
}

/**
 * Remove duplicate steps based on type, description, and key details
 * @param {Array} steps - Array of steps
 * @returns {Array} Deduplicated steps
 */
export function removeDuplicates(steps) {
  const seen = new Map();
  const result = [];
  
  for (const step of steps) {
    const key = generateStepKey(step);
    const existingEntry = seen.get(key);
    
    if (existingEntry) {
      const timeDiff = Math.abs(step.timestamp - existingEntry.timestamp);
      
      // If same step within 5 seconds, consider it a duplicate
      if (timeDiff < TIMEOUTS.DUPLICATE_STEP) {
        continue;
      }
      
      seen.set(key, { timestamp: step.timestamp, index: result.length });
    } else {
      seen.set(key, { timestamp: step.timestamp, index: result.length });
    }
    
    result.push(step);
  }
  
  return result;
}

/**
 * Generate a unique key for a step based on its type and key details
 * @param {Object} step - Step object
 * @returns {string} Unique key for the step
 */
export function generateStepKey(step) {
  const d = step.details || {};
  
  switch (step.type) {
    case 'click':
      return `click:${d.label || d.text || d.selector || ''}:${d.name || ''}`;
      
    case 'input':
      return `input:${d.fieldName || d.fieldLabel || d.selector || ''}:${d.value || ''}`;
      
    case 'navigation':
      return `navigation:${step.url || ''}`;
      
    case 'scroll':
      const x = Math.round((d.x || 0) / 100) * 100;
      const y = Math.round((d.y || 0) / 100) * 100;
      return `scroll:${x}:${y}`;
      
    case 'validation':
      return `validation:${d.fieldName || d.fieldLabel || ''}:${d.validationMessage || ''}`;
      
    case 'error':
      return `error:${d.error || step.description || ''}`;
      
    case 'network':
      const urlPath = getPathFromURL(d.url || '');
      return `network:${d.method || ''}:${urlPath}:${d.status || ''}`;
      
    default:
      return `${step.type}:${step.description || ''}`;
  }
}

/**
 * Check if a click is on a generic container (should be skipped)
 * @param {Object} step - Click step
 * @returns {boolean} True if container click
 */
export function isContainerClick(step) {
  const d = step.details || {};
  if (d.element === 'div' && !d.text && !d.label) return true;
  if (d.element === 'span' && !d.text && !d.label) return true;
  if (d.selector?.includes('mat-select-value') && !d.text) return true;
  return false;
}

/**
 * Check if a click is opening a dropdown
 * @param {Object} step - Click step
 * @returns {boolean} True if dropdown open click
 */
export function isDropdownOpen(step) {
  const d = step.details || {};
  return d.label || 
         d.selector?.includes('mat-select') ||
         d.selector?.includes('mat-form-field') ||
         d.text?.toLowerCase().includes('select');
}

/**
 * Check if a click is selecting a dropdown option
 * @param {Object} step - Click step
 * @returns {boolean} True if dropdown option click
 */
export function isDropdownOption(step) {
  const d = step.details || {};
  return d.selector?.includes('mat-option') || 
         d.name?.includes('mat-option');
}

/**
 * Compact steps to only important ones for bug recreation
 * @param {Array} steps - Array of steps
 * @returns {Array} Compacted steps with priorities
 */
export function compactSteps(steps) {
  if (!steps || steps.length === 0) return [];
  
  const deduplicated = removeDuplicates(steps);
  const important = [];
  const priorities = calculatePriorities(deduplicated);
  
  // Always keep first step
  if (deduplicated.length > 0) {
    important.push({ ...deduplicated[0], priority: 'high' });
  }
  
  for (let i = 1; i < deduplicated.length; i++) {
    const step = deduplicated[i];
    const priority = priorities[i];
    
    // Keep critical, high, and medium priority steps
    if (priority === 'critical' || priority === 'high' || priority === 'medium') {
      important.push({ ...step, priority });
    }
  }
  
  return important;
}

/**
 * Calculate priorities for steps
 * @param {Array} steps - Array of steps
 * @returns {Array} Array of priority strings
 */
export function calculatePriorities(steps) {
  const priorities = new Array(steps.length).fill('low');
  
  steps.forEach((step, index) => {
    let score = 0;
    
    // CRITICAL: Errors
    if (step.type === 'error') score = 100;
    
    // CRITICAL: Validation failures
    if (step.type === 'validation') score = 95;
    
    // CRITICAL: Failed network requests
    if (step.type === 'network' && step.details?.isFailed) score = 90;
    
    // HIGH: Navigation
    if (step.type === 'navigation' && index > 0) score = 70;
    
    // HIGH: Submit buttons
    if (step.type === 'click' && step.details?.buttonType === 'submit') score = 75;
    
    // HIGH: Stepper navigation
    if (step.type === 'click' && step.details?.stepper) score = 70;
    
    // HIGH: Action buttons
    if (step.type === 'click' && isActionButton(step)) score = 68;
    
    // MEDIUM: Form inputs before submission
    if (step.type === 'input' && isBeforeSubmission(steps, index)) score = 50;
    
    // MEDIUM: Regular clicks
    if (step.type === 'click' && score === 0) score = 40;
    
    // MEDIUM: Network requests
    if (step.type === 'network' && !step.details?.isFailed) {
      score = step.details?.isSlow ? 48 : 35;
    }
    
    // MEDIUM: Form inputs
    if (step.type === 'input' && score === 0) score = 45;
    
    // LOW: Scroll
    if (step.type === 'scroll') score = 10;
    
    // Assign priority
    if (score >= 80) priorities[index] = 'critical';
    else if (score >= 60) priorities[index] = 'high';
    else if (score >= 35) priorities[index] = 'medium';
    else priorities[index] = 'low';
  });
  
  return priorities;
}

/**
 * Check if step is an action button click
 * @param {Object} step - Step to check
 * @returns {boolean} True if action button
 */
function isActionButton(step) {
  const desc = step.description?.toLowerCase() || '';
  const actionWords = ['submit', 'save', 'next', 'continue', 'confirm', 'send', 'create', 'update', 'release', 'approve'];
  return actionWords.some(word => desc.includes(word));
}

/**
 * Check if input is before a submission action
 * @param {Array} steps - All steps
 * @param {number} currentIndex - Current step index
 * @returns {boolean} True if before submission
 */
function isBeforeSubmission(steps, currentIndex) {
  for (let i = currentIndex + 1; i < Math.min(currentIndex + 4, steps.length); i++) {
    if (steps[i].type === 'click' && 
        (steps[i].details?.buttonType === 'submit' || isActionButton(steps[i]))) {
      return true;
    }
  }
  return false;
}

/**
 * Get summary of compaction results
 * @param {Array} originalSteps - Original steps
 * @param {Array} compactedSteps - Compacted steps
 * @returns {Object} Summary object
 */
export function getCompactionSummary(originalSteps, compactedSteps) {
  const removed = originalSteps.length - compactedSteps.length;
  const percentage = Math.round((removed / originalSteps.length) * 100);
  
  const typeCounts = {
    critical: compactedSteps.filter(s => s.priority === 'critical').length,
    high: compactedSteps.filter(s => s.priority === 'high').length,
    medium: compactedSteps.filter(s => s.priority === 'medium').length
  };
  
  return {
    original: originalSteps.length,
    compacted: compactedSteps.length,
    removed: removed,
    percentage: percentage,
    kept: typeCounts
  };
}


