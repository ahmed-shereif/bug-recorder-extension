/**
 * Input and change event listeners for recording form interactions
 */

import { getLabel } from '../utils/labelDetector.js';
import { getSelector, getDomBreadcrumb } from '../utils/selectorBuilder.js';
import { TIMEOUTS } from '../../shared/constants.js';

/**
 * Create an input listener with debouncing
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {Function} Input event handler
 */
export function createInputListener(recordStep, state) {
  const debounceTimers = {};
  const lastInputValues = {};
  
  return function handleInput(e) {
    if (!state.isRecording) return;
    
    const target = e.target;
    
    // Mark field as touched when user types
    state.markFieldAsTouched(target);
    
    const selector = getSelector(target);
    const value = target.value;
    const label = getLabel(target);
    const inputName = target.getAttribute('name') || target.id || '';
    const inputType = target.getAttribute('type') || target.tagName.toLowerCase();
    const placeholder = target.getAttribute('placeholder') || '';
    const fieldKey = inputName || selector;
    const domPath = getDomBreadcrumb(target);
    
    // Clear existing timer for this field
    if (debounceTimers[fieldKey]) {
      clearTimeout(debounceTimers[fieldKey]);
    }
    
    // Set new timer - only record after 1 second of no typing
    debounceTimers[fieldKey] = setTimeout(() => {
      // Only record if value actually changed
      if (lastInputValues[fieldKey] !== value) {
        lastInputValues[fieldKey] = value;
        
        // Track input for API correlation
        state.trackRecentInput(fieldKey, label, inputName, value);
        
        // Build better description
        let description;
        if (label) {
          description = `Entered "${value}" in "${label}"`;
        } else if (placeholder) {
          description = `Entered "${value}" in "${placeholder}"`;
        } else if (inputName && !inputName.startsWith('mat-')) {
          description = `Entered "${value}" in "${inputName.replace(/[-_]/g, ' ')}"`;
        } else {
          description = `Entered "${value}" in ${inputType} field`;
        }
        
        recordStep({
          type: 'input',
          description,
          details: { 
            fieldName: inputName,
            fieldLabel: label,
            fieldType: inputType,
            value: value,
            placeholder: placeholder,
            selector: selector,
            path: domPath
          }
        });
      }
    }, TIMEOUTS.INPUT_DEBOUNCE);
  };
}

/**
 * Create a change listener for select, checkbox, and other change events
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {Function} Change event handler
 */
export function createChangeListener(recordStep, state) {
  const lastInputValues = {};
  const debounceTimers = {};
  
  return function handleChange(e) {
    if (!state.isRecording) return;
    
    const target = e.target;
    
    // Mark field as touched when user changes it
    state.markFieldAsTouched(target);
    
    const selector = getSelector(target);
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const label = getLabel(target);
    const inputName = target.getAttribute('name') || target.id || '';
    const inputType = target.getAttribute('type') || target.tagName.toLowerCase();
    const fieldKey = inputName || selector;
    const domPath = getDomBreadcrumb(target);
    
    // Clear any pending input timer for this field
    if (debounceTimers[fieldKey]) {
      clearTimeout(debounceTimers[fieldKey]);
      delete debounceTimers[fieldKey];
    }
    
    // Only record if value changed
    if (lastInputValues[fieldKey] === value) return;
    lastInputValues[fieldKey] = value;
    
    // Track input for API correlation
    state.trackRecentInput(fieldKey, label, inputName, value);
    
    let description;
    if (target.type === 'checkbox') {
      const fieldName = label || inputName.replace(/[-_]/g, ' ') || 'checkbox';
      description = `${value ? 'Checked' : 'Unchecked'} "${fieldName}"`;
    } else if (target.tagName.toLowerCase() === 'select') {
      const selectedText = target.options[target.selectedIndex]?.text || value;
      const fieldName = label || inputName.replace(/[-_]/g, ' ') || 'dropdown';
      description = `Selected "${selectedText}" in "${fieldName}"`;
    } else {
      const fieldName = label || inputName.replace(/[-_]/g, ' ') || 'field';
      description = `Entered "${value}" in "${fieldName}"`;
    }
    
    recordStep({
      type: 'input',
      description,
      details: { 
        fieldName: inputName,
        fieldLabel: label,
        fieldType: inputType,
        value: value,
        selector: selector,
        path: domPath
      }
    });
  };
}

/**
 * Create focus and blur listeners for field tracking
 * @param {Object} state - Shared state object
 * @returns {Object} Object containing focusListener and blurListener
 */
export function createFocusListeners(state) {
  function handleFocus(e) {
    if (!state.isRecording) return;
    const target = e.target;
    if (isFormField(target)) {
      state.markFieldAsTouched(target);
    }
  }
  
  function handleBlur(e) {
    if (!state.isRecording) return;
    const target = e.target;
    if (isFormField(target)) {
      state.markFieldAsTouched(target);
      // Enable validation capture briefly after blur
      if (state.settings.captureValidation) {
        state.enableValidationCapture();
      }
    }
  }
  
  return { focusListener: handleFocus, blurListener: handleBlur };
}

/**
 * Check if element is a form field
 * @param {Element} element - DOM element
 * @returns {boolean} True if form field
 */
function isFormField(element) {
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea' || 
         element.hasAttribute('contenteditable') ||
         element.closest('mat-select, mat-input, mat-form-field');
}


