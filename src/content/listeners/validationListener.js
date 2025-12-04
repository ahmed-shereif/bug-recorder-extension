/**
 * Validation error listener using MutationObserver
 */

import { getSelector } from '../utils/selectorBuilder.js';

/**
 * Create a validation listener
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {MutationObserver} Validation observer
 */
export function createValidationListener(recordStep, state) {
  // Track seen validations to avoid duplicates
  const seenValidations = new Set();
  
  const observer = new MutationObserver((mutations) => {
    if (!state.isRecording || !state.shouldCaptureValidation) return;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const errorElements = node.querySelectorAll?.('[class*="error"], [class*="invalid"], mat-error, .mat-error');
          errorElements?.forEach((el) => {
            const message = el.textContent.trim();
            if (!message) return;
            
            // Find associated field
            const formField = el.closest('mat-form-field, .form-field, .input-group, form');
            let fieldLabel = '';
            let fieldName = '';
            let inputEl = null;
            
            if (formField) {
              const labelEl = formField.querySelector('mat-label, label, .label');
              fieldLabel = labelEl?.textContent.trim() || '';
              
              inputEl = formField.querySelector('input, select, textarea');
              fieldName = inputEl?.getAttribute('name') || inputEl?.id || '';
            }
            
            // Only capture validation if the field was touched by user
            if (!state.isFieldTouched(inputEl, fieldName, fieldLabel)) {
              return;
            }
            
            // Create unique key to avoid duplicates
            const validationKey = `${fieldName || fieldLabel}-${message}`;
            if (seenValidations.has(validationKey)) return;
            seenValidations.add(validationKey);
            
            // Clear after 5 seconds to allow re-recording if error appears again
            const currentSession = state.recordingSessionId;
            setTimeout(() => {
              if (state.recordingSessionId === currentSession) {
                seenValidations.delete(validationKey);
              }
            }, 5000);
            
            let description = `❌ Validation: ${message}`;
            if (fieldLabel) description = `❌ "${fieldLabel}" - ${message}`;
            
            recordStep({
              type: 'validation',
              description,
              details: { 
                validationMessage: message,
                fieldLabel: fieldLabel,
                fieldName: fieldName,
                status: 'failed'
              }
            });
          });
        }
      });
    });
  });
  
  return observer;
}

/**
 * Start observing for validation errors
 * @param {MutationObserver} observer - Validation observer
 */
export function startValidationObserver(observer) {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Stop observing for validation errors
 * @param {MutationObserver} observer - Validation observer
 */
export function stopValidationObserver(observer) {
  if (observer) {
    observer.disconnect();
  }
}


