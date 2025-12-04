/**
 * Smart Step Compactor
 * Intelligently reduces steps to only the most important ones for bug recreation
 */

function compactSteps(steps) {
  if (!steps || steps.length === 0) return [];
  
  // Remove duplicates first
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

function calculatePriorities(steps) {
  const priorities = new Array(steps.length).fill('low');
  
  steps.forEach((step, index) => {
    let score = 0;
    
    // CRITICAL: Errors
    if (step.type === 'error') score = 100;
    
    // CRITICAL: Validation failures (only unique ones)
    if (step.type === 'validation') score = 95;
    
    // CRITICAL: Failed network requests
    if (step.type === 'network' && step.details?.isFailed) score = 90;
    
    // HIGH: Navigation
    if (step.type === 'navigation' && index > 0) score = 70;
    
    // HIGH: Submit buttons
    if (step.type === 'click' && step.details?.buttonType === 'submit') score = 75;
    
    // HIGH: Stepper navigation
    if (step.type === 'click' && step.details?.stepper) score = 70;
    
    // HIGH: Action buttons (save, next, continue, etc.)
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

function isActionButton(step) {
  const desc = step.description?.toLowerCase() || '';
  const actionWords = ['submit', 'save', 'next', 'continue', 'confirm', 'send', 'create', 'update', 'release', 'approve'];
  return actionWords.some(word => desc.includes(word));
}

function isBeforeSubmission(steps, currentIndex) {
  for (let i = currentIndex + 1; i < Math.min(currentIndex + 4, steps.length); i++) {
    if (steps[i].type === 'click' && 
        (steps[i].details?.buttonType === 'submit' || isActionButton(steps[i]))) {
      return true;
    }
  }
  return false;
}

function removeDuplicates(steps) {
  const seen = new Set();
  const result = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Remove duplicate validations (same field + message)
    if (step.type === 'validation') {
      const key = `${step.details?.fieldName || step.details?.fieldLabel}-${step.details?.validationMessage}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    
    // Remove duplicate consecutive inputs (same field within 100ms)
    if (step.type === 'input' && i > 0) {
      const prev = steps[i - 1];
      if (prev.type === 'input' && 
          prev.details?.fieldName === step.details?.fieldName &&
          step.timestamp - prev.timestamp < 100) {
        continue;
      }
    }
    
    // Remove duplicate navigation (same URL within 1s)
    if (step.type === 'navigation' && i > 0) {
      const prev = steps[i - 1];
      if (prev.type === 'navigation' && 
          prev.url === step.url &&
          step.timestamp - prev.timestamp < 1000) {
        continue;
      }
    }
    
    result.push(step);
  }
  
  return result;
}

function getCompactionSummary(originalSteps, compactedSteps) {
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

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compactSteps, getCompactionSummary };
}
