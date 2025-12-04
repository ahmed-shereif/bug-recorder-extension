/**
 * Click event listener for recording user clicks
 */

import { getLabel, getStepperLabel, isActionButton } from '../utils/labelDetector.js';
import { getSelector, getDomBreadcrumb } from '../utils/selectorBuilder.js';
import { TIMEOUTS } from '../../shared/constants.js';

/**
 * Create a click listener with closure for state tracking
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {Function} Click event handler
 */
export function createClickListener(recordStep, state) {
  let lastClickTarget = null;
  let lastClickTime = 0;
  
  return function handleClick(e) {
    if (!state.isRecording) return;
    
    const target = e.target;
    const selector = getSelector(target);
    const text = target.textContent?.trim().substring(0, 100) || '';
    const tagName = target.tagName.toLowerCase();
    const buttonName = target.getAttribute('name') || target.id || '';
    const buttonType = target.getAttribute('type') || '';
    const ariaLabel = target.getAttribute('aria-label') || '';
    const currentTime = Date.now();
    
    // Check if this is a duplicate click (same element within 1 second)
    const clickKey = `${selector}-${text}-${buttonName}`;
    if (lastClickTarget === clickKey && (currentTime - lastClickTime) < TIMEOUTS.DUPLICATE_CLICK) {
      return;
    }
    
    lastClickTarget = clickKey;
    lastClickTime = currentTime;
    
    // Enable validation capture for submit buttons or action buttons
    if (isActionButton(target, text, buttonType)) {
      state.enableValidationCapture();
    }
    
    const label = getLabel(target);
    const stepperLabel = getStepperLabel(target);
    
    // Build better description
    let description;
    if (label) {
      description = `Clicked "${label}"`;
    } else if (text && !text.startsWith('mat-')) {
      description = `Clicked "${text}"`;
    } else if (ariaLabel) {
      description = `Clicked "${ariaLabel}"`;
    } else if (stepperLabel) {
      description = `Clicked in "${stepperLabel}" step`;
    } else {
      description = `Clicked ${tagName} button`;
    }
    
    // Track last user action for network correlation
    state.lastUserAction = {
      type: 'click',
      description: description,
      timestamp: currentTime
    };
    
    const domPath = getDomBreadcrumb(target);
    
    recordStep({
      type: 'click',
      description,
      details: { 
        element: tagName,
        name: buttonName,
        buttonType: buttonType,
        text: text,
        label: label,
        stepper: stepperLabel,
        selector: selector,
        path: domPath
      }
    });
  };
}


