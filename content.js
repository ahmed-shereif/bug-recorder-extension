let isRecording = false;
let settings = {};
let steps = [];
let clickListener = null;
let inputListener = null;
let changeListener = null;
let scrollListener = null;
let focusListener = null;
let blurListener = null; // Store blur listener reference for proper cleanup
let mutationObserver = null;
let navigationObserver = null; // Store navigation observer reference for cleanup
let errorListener = null; // Store error listener reference for cleanup
let rejectionListener = null; // Store rejection listener reference for cleanup
let inputDebounceTimers = {};
let lastInputValues = {};
let lastUserAction = null;
let lastClickTarget = null;
let lastClickTime = 0;
let shouldCaptureValidation = false;
let validationCaptureTimeout = null;
let networkListenerAttached = false;
let injectedScriptReady = false;
let touchedFields = new Set(); // Track fields user has interacted with
let recentInputs = new Map(); // Track recent input values for API correlation: key -> { fieldLabel, fieldName, value, timestamp }
let recordingSessionId = null; // Track current recording session to detect stale state
let recentClicks = []; // Track recent clicks for API correlation: { stepIndex, timestamp }

// Initialize on load
(async function init() {
  try {
    const result = await chrome.storage.local.get([
      'isRecording',
      'settings',
      'steps',
      'recordingSessionId',
      'activeSessionDomain'
    ]);
    const currentDomain = location.hostname;

    // Only auto-resume recording if the active session is for this domain
    if (result.isRecording && result.activeSessionDomain === currentDomain) {
      isRecording = true;
      settings = result.settings || {};
      steps = result.steps || [];
      // Restore or create session ID for continuity tracking
      recordingSessionId = result.recordingSessionId || Date.now();
      console.log(
        'Bug Recorder: Resuming recording with',
        steps.length,
        'steps (session:',
        recordingSessionId,
        ', domain:',
        currentDomain,
        ')'
      );
      initRecording();
    } else if (result.isRecording) {
      console.log(
        'Bug Recorder: Active recording exists for different domain',
        result.activeSessionDomain,
        '- not auto-resuming on',
        currentDomain
      );
    }
  } catch (e) {
    console.log('Bug Recorder: Extension not ready yet');
  }
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'startRecording') {
      // Reset ALL state for this tab when (re)starting recording
      resetAllState();
      
      isRecording = true;
      settings = message.settings;
      // Use shared sessionId provided by popup/background so multiple tabs on the same
      // domain participate in a single logical recording session
      recordingSessionId = message.sessionId || Date.now();
      
      console.log(
        'Bug Recorder: Started recording (session:',
        recordingSessionId,
        ', isNewSession:',
        !!message.isNewSession,
        ')'
      );
      console.log('Bug Recorder: Settings:', settings);
      initRecording();
      sendResponse({ success: true });
    } else if (message.action === 'stopRecording') {
      isRecording = false;
      console.log('Bug Recorder: Stopped recording with', steps.length, 'steps');
      removeListeners();
      sendResponse({ success: true });
    } else if (message.action === 'getStatus') {
      // Allow popup to query current recording status
      sendResponse({ 
        isRecording: isRecording, 
        stepCount: steps.length,
        sessionId: recordingSessionId 
      });
    }
  } catch (e) {
    console.error('Bug Recorder: Message handler error:', e);
    sendResponse({ success: false, error: e.message });
  }
  return true;
});

// Reset all state variables for a fresh recording
function resetAllState() {
  steps = [];
  stepQueue = Promise.resolve(); // Reset the async step queue
  touchedFields.clear();
  recentInputs.clear();
  recentClicks = []; // Reset click tracking for API correlation
  lastInputValues = {};
  lastUserAction = null;
  lastClickTarget = null;
  lastClickTime = 0;
  shouldCaptureValidation = false;
  
  // Clear all pending debounce timers
  Object.values(inputDebounceTimers).forEach(timer => clearTimeout(timer));
  inputDebounceTimers = {};
  
  // Clear validation timeout
  if (validationCaptureTimeout) {
    clearTimeout(validationCaptureTimeout);
    validationCaptureTimeout = null;
  }
  
  // Reset network state for fresh injection
  networkListenerAttached = false;
  injectedScriptReady = false;
}

function initRecording() {
  removeListeners();
  
  console.log('Bug Recorder: Initializing with settings:', settings);
  
  if (settings.captureClicks) {
    attachClickListener();
    console.log('Bug Recorder: Click listener attached');
  }
  if (settings.captureInputs) {
    attachInputListeners();
    console.log('Bug Recorder: Input listeners attached');
  }
  if (settings.captureNavigation) {
    attachNavigationListener();
    console.log('Bug Recorder: Navigation listener attached');
  }
  if (settings.captureScroll) {
    attachScrollListener();
    console.log('Bug Recorder: Scroll listener attached');
  }
  if (settings.captureErrors) {
    attachErrorListener();
    console.log('Bug Recorder: Error listener attached');
  }
  if (settings.captureValidation) {
    attachValidationListener();
    console.log('Bug Recorder: Validation listener attached');
  }
  if (settings.captureNetwork) {
    attachNetworkListener();
    console.log('Bug Recorder: Network listener attached');
  }
  
  // Record initial page load
  recordStep({
    type: 'navigation',
    description: `Recording started on ${location.pathname}`,
    url: location.href
  });
}

function attachClickListener() {
  clickListener = (e) => handleClick(e);
  document.addEventListener('click', clickListener, true);
}

function attachInputListeners() {
  inputListener = (e) => handleInput(e);
  changeListener = (e) => handleChange(e);
  focusListener = (e) => handleFocus(e);
  blurListener = (e) => handleBlur(e); // Store reference for proper cleanup
  document.addEventListener('input', inputListener, true);
  document.addEventListener('change', changeListener, true);
  document.addEventListener('focus', focusListener, true);
  document.addEventListener('blur', blurListener, true);
}

function handleFocus(e) {
  if (!isRecording) return;
  const target = e.target;
  if (isFormField(target)) {
    markFieldAsTouched(target);
  }
}

function handleBlur(e) {
  if (!isRecording) return;
  const target = e.target;
  if (isFormField(target)) {
    markFieldAsTouched(target);
    // Enable validation capture briefly after blur (user left the field)
    if (settings.captureValidation) {
      enableValidationCapture();
    }
  }
}

function isFormField(element) {
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea' || 
         element.hasAttribute('contenteditable') ||
         element.closest('mat-select, mat-input, mat-form-field');
}

function markFieldAsTouched(element) {
  // Use multiple identifiers to track the field
  const fieldId = element.id;
  const fieldName = element.getAttribute('name');
  const selector = getSelector(element);
  
  // Find parent form field for Angular Material
  const formField = element.closest('mat-form-field, .form-field, .input-group');
  const formFieldSelector = formField ? getSelector(formField) : null;
  
  if (fieldId) touchedFields.add(`id:${fieldId}`);
  if (fieldName) touchedFields.add(`name:${fieldName}`);
  if (selector) touchedFields.add(`selector:${selector}`);
  if (formFieldSelector) touchedFields.add(`formField:${formFieldSelector}`);
  
  // Also add by label if found
  const label = getLabel(element);
  if (label) touchedFields.add(`label:${label.toLowerCase()}`);
}

function isFieldTouched(element, fieldName, fieldLabel) {
  // Check if the field or its container was touched
  if (fieldName && touchedFields.has(`name:${fieldName}`)) return true;
  if (fieldLabel && touchedFields.has(`label:${fieldLabel.toLowerCase()}`)) return true;
  
  if (element) {
    const fieldId = element.id;
    if (fieldId && touchedFields.has(`id:${fieldId}`)) return true;
    
    const selector = getSelector(element);
    if (selector && touchedFields.has(`selector:${selector}`)) return true;
  }
  
  return false;
}

function attachNavigationListener() {
  // Disconnect existing observer if any
  if (navigationObserver) {
    navigationObserver.disconnect();
  }
  
  let lastUrl = location.href;
  navigationObserver = new MutationObserver(() => {
    if (!isRecording) return; // Don't process if not recording
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      recordStep({
        type: 'navigation',
        description: `Navigated to ${location.pathname}`,
        url: location.href
      });
    }
  });
  navigationObserver.observe(document, { subtree: true, childList: true });
}

function attachScrollListener() {
  let scrollTimeout;
  scrollListener = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      recordStep({
        type: 'scroll',
        description: `Scrolled to position (${window.scrollX}, ${window.scrollY})`,
        details: { x: window.scrollX, y: window.scrollY }
      });
    }, 500);
  };
  document.addEventListener('scroll', scrollListener, true);
}

function attachErrorListener() {
  // Remove existing listeners if any
  if (errorListener) {
    window.removeEventListener('error', errorListener);
  }
  if (rejectionListener) {
    window.removeEventListener('unhandledrejection', rejectionListener);
  }
  
  errorListener = (e) => {
    if (!isRecording) return;
    recordStep({
      type: 'error',
      description: `Console Error: ${e.message}`,
      details: { error: e.message, file: e.filename, line: e.lineno }
    });
  };
  
  rejectionListener = (e) => {
    if (!isRecording) return;
    recordStep({
      type: 'error',
      description: `Unhandled Promise Rejection: ${e.reason}`,
      details: { error: String(e.reason) }
    });
  };
  
  window.addEventListener('error', errorListener);
  window.addEventListener('unhandledrejection', rejectionListener);
}

let seenValidations = new Set(); // Track seen validations to avoid duplicates

function attachValidationListener() {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
  
  // Reset seen validations for new recording
  seenValidations = new Set();
  
  mutationObserver = new MutationObserver((mutations) => {
    if (!isRecording || !shouldCaptureValidation) return;
    
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
            if (!isFieldTouched(inputEl, fieldName, fieldLabel)) {
              console.log('Bug Recorder: Skipping validation for untouched field:', fieldName || fieldLabel);
              return;
            }
            
            // Create unique key to avoid duplicates
            const validationKey = `${fieldName || fieldLabel}-${message}`;
            if (seenValidations.has(validationKey)) return;
            seenValidations.add(validationKey);
            
            // Clear after 5 seconds to allow re-recording if error appears again
            // Only if still recording
            const currentSession = recordingSessionId;
            setTimeout(() => {
              if (recordingSessionId === currentSession) {
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
  
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function handleClick(e) {
  if (!isRecording) return;
  
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
  if (lastClickTarget === clickKey && (currentTime - lastClickTime) < 1000) {
    console.log('Bug Recorder: Duplicate click ignored');
    return;
  }
  
  lastClickTarget = clickKey;
  lastClickTime = currentTime;
  
  // Enable validation capture for submit buttons or action buttons
  if (isActionButton(target, text, buttonType)) {
    enableValidationCapture();
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
  lastUserAction = {
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
}

function handleInput(e) {
  if (!isRecording) return;
  
  const target = e.target;
  
  // Mark field as touched when user types
  markFieldAsTouched(target);
  
  const selector = getSelector(target);
  const value = target.value;
  const label = getLabel(target);
  const inputName = target.getAttribute('name') || target.id || '';
  const inputType = target.getAttribute('type') || target.tagName.toLowerCase();
  const placeholder = target.getAttribute('placeholder') || '';
  const fieldKey = inputName || selector;
  const domPath = getDomBreadcrumb(target); // Capture path immediately before timeout
  
  // Clear existing timer for this field
  if (inputDebounceTimers[fieldKey]) {
    clearTimeout(inputDebounceTimers[fieldKey]);
  }
  
  // Set new timer - only record after 1 second of no typing
  inputDebounceTimers[fieldKey] = setTimeout(() => {
    // Only record if value actually changed
    if (lastInputValues[fieldKey] !== value) {
      lastInputValues[fieldKey] = value;
      
      // Track input for API correlation
      trackRecentInput(fieldKey, label, inputName, value);
      
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
  }, 1000);
}

function handleChange(e) {
  if (!isRecording) return;
  
  const target = e.target;
  
  // Mark field as touched when user changes it
  markFieldAsTouched(target);
  
  const selector = getSelector(target);
  const value = target.type === 'checkbox' ? target.checked : target.value;
  const label = getLabel(target);
  const inputName = target.getAttribute('name') || target.id || '';
  const inputType = target.getAttribute('type') || target.tagName.toLowerCase();
  const fieldKey = inputName || selector;
  const domPath = getDomBreadcrumb(target);
  
  // Clear any pending input timer for this field
  if (inputDebounceTimers[fieldKey]) {
    clearTimeout(inputDebounceTimers[fieldKey]);
    delete inputDebounceTimers[fieldKey];
  }
  
  // Only record if value changed
  if (lastInputValues[fieldKey] === value) return;
  lastInputValues[fieldKey] = value;
  
  // Track input for API correlation
  trackRecentInput(fieldKey, label, inputName, value);
  
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
}

// Track recent input values for API request correlation
function trackRecentInput(fieldKey, fieldLabel, fieldName, value) {
  // Store with timestamp for cleanup
  recentInputs.set(fieldKey, {
    fieldLabel: fieldLabel || fieldName || fieldKey,
    fieldName: fieldName,
    value: value,
    timestamp: Date.now()
  });
  
  // Clean up old entries (older than 30 seconds)
  cleanupOldInputs();
}

// Remove input entries older than 30 seconds
function cleanupOldInputs() {
  const now = Date.now();
  const maxAge = 30000; // 30 seconds
  
  for (const [key, entry] of recentInputs.entries()) {
    if (now - entry.timestamp > maxAge) {
      recentInputs.delete(key);
    }
  }
}

// Calculate priority for a step based on type and details
function calculatePriority(step) {
  const type = step.type;
  const details = step.details || {};
  
  // Critical: errors, validation, failed network
  if (type === 'error' || type === 'validation') return 'critical';
  if (type === 'network' && details.isFailed) return 'critical';
  
  // High: all inputs, button clicks, navigation, slow network
  if (type === 'input') return 'high';
  if (type === 'click') return 'high';
  if (type === 'navigation') return 'high';
  if (type === 'network' && details.isSlow) return 'high';
  
  // Medium: regular network
  if (type === 'network') return 'medium';
  
  // Low: scroll
  return 'low';
}

// Track a click for potential API correlation
function trackClickForAPICorrelation(stepIndex, timestamp) {
  recentClicks.push({ stepIndex, timestamp });
  
  // Clean up old clicks (older than 5 seconds)
  const now = Date.now();
  recentClicks = recentClicks.filter(click => now - click.timestamp < 5000);
}

// Upgrade click priority when API request is detected
function upgradeClickPriorityForAPI() {
  const now = Date.now();
  const apiCorrelationWindow = 2000; // 2 seconds
  
  // Find clicks within the correlation window
  for (const click of recentClicks) {
    if (now - click.timestamp < apiCorrelationWindow) {
      const step = steps[click.stepIndex];
      if (step && step.type === 'click' && step.priority !== 'high' && step.priority !== 'critical') {
        console.log('Bug Recorder: Upgrading click priority to high (triggered API):', step.description);
        step.priority = 'high';
        step.triggeredAPI = true;
      }
    }
  }
}

function getSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c && !c.startsWith('ng-') && !c.startsWith('mat-'));
    if (classes.length) return `.${classes[0]}`;
  }
  
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }
    path.unshift(selector);
    current = current.parentElement;
    if (path.length > 3) break;
  }
  return path.join(' > ');
}

// Generate a DOM breadcrumb path up to 10 levels - only actual text values
function getDomBreadcrumb(element) {
  const breadcrumb = [];
  let current = element;
  let level = 0;
  
  while (current && current !== document.body && current !== document.documentElement && level < 10) {
    const text = getActualText(current);
    
    // Only add if there's actual text, skip empty elements
    if (text) {
      // Avoid duplicates
      if (breadcrumb.length === 0 || breadcrumb[0] !== text) {
        breadcrumb.unshift(text);
      }
    }
    
    current = current.parentElement;
    level++;
  }
  
  return breadcrumb.join(' > ');
}

// Get actual visible text from an element - no fallbacks to element names
function getActualText(element) {
  // 1. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length >= 2 && ariaLabel.length <= 50) {
    return ariaLabel.trim();
  }
  
  // 2. placeholder (for inputs)
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.trim().length >= 2 && placeholder.length <= 50) {
    return placeholder.trim();
  }
  
  // 3. Associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      const labelText = label.textContent?.trim();
      if (labelText && labelText.length >= 2 && labelText.length <= 50) {
        return labelText;
      }
    }
  }
  
  // 4. Direct text content only (not from child elements)
  let directText = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent;
    }
  }
  directText = directText.trim();
  if (directText.length >= 2 && directText.length <= 50) {
    return directText;
  }
  
  return null;
}

function getLabel(element) {
  // 1. Try aria-label first (most explicit)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && !ariaLabel.startsWith('mat-') && isUsefulLabel(ariaLabel)) return ariaLabel;
  
  // 2. Try label[for] (standard HTML)
  if (element.id && !element.id.startsWith('mat-')) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      const text = cleanText(label.textContent);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 3. Try aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl) {
      const text = cleanText(labelEl.textContent);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 4. For buttons, check buttonText attribute or text content
  if (element.tagName === 'BUTTON' || element.closest('button')) {
    const btn = element.tagName === 'BUTTON' ? element : element.closest('button');
    const btnText = btn.querySelector('.btn-text')?.textContent || btn.textContent;
    if (btnText && !btnText.startsWith('mat-')) {
      const text = cleanText(btnText);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 5. Check element's own data attributes
  const dataLabel = element.getAttribute('data-label') || 
                    element.getAttribute('data-field') || 
                    element.getAttribute('data-name') ||
                    element.getAttribute('data-testid') ||
                    element.getAttribute('formcontrolname');
  if (dataLabel && isUsefulLabel(dataLabel)) {
    return formatAttributeName(dataLabel);
  }
  
  // 6. Search up DOM extensively for labels (up to 15 levels)
  let current = element;
  let depth = 0;
  const maxDepth = 15;
  
  while (current && depth < maxDepth) {
    // Check for .label div (ICOS custom pattern)
    const labelDiv = current.querySelector('.label > .input-label, .label > mat-label, .field-label, .form-label');
    if (labelDiv && !labelDiv.contains(element)) {
      const text = cleanText(labelDiv.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for mat-label in parent
    const matLabel = current.querySelector('mat-label:not(.date-container__lbl_month):not(.date-container__lbl_day)');
    if (matLabel && !matLabel.contains(element)) {
      const text = cleanText(matLabel.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for label elements
    const labels = current.querySelectorAll('label.input-label, label.checkbox__label, label:not([for])');
    for (const label of labels) {
      if (!label.contains(element) && label.textContent.trim()) {
        const text = cleanText(label.textContent);
        if (isUsefulLabel(text)) return text;
      }
    }
    
    // Check for legend (in fieldset)
    const legend = current.querySelector('legend');
    if (legend && !legend.contains(element)) {
      const text = cleanText(legend.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for heading elements that might be section titles
    const heading = current.querySelector('h1, h2, h3, h4, h5, h6, .section-title, .card-title, .panel-title, .header-title');
    if (heading && !heading.contains(element)) {
      const text = cleanText(heading.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for span/div with label-like classes
    const labelLike = current.querySelector('.label, .field-name, .input-title, .control-label, [class*="label"]:not(input):not(select):not(textarea)');
    if (labelLike && !labelLike.contains(element) && labelLike.tagName !== 'INPUT') {
      const text = cleanText(labelLike.textContent);
      if (isUsefulLabel(text) && text.length < 50) return text;
    }
    
    // Check for data attributes on parent containers
    const parentDataLabel = current.getAttribute('data-label') || 
                            current.getAttribute('data-field') ||
                            current.getAttribute('data-name') ||
                            current.getAttribute('aria-label');
    if (parentDataLabel && isUsefulLabel(parentDataLabel)) {
      return formatAttributeName(parentDataLabel);
    }
    
    // Check for title attribute
    const title = current.getAttribute('title');
    if (title && isUsefulLabel(title)) return title;
    
    // Check previous sibling for label text
    const prevSibling = current.previousElementSibling;
    if (prevSibling) {
      const siblingTag = prevSibling.tagName?.toLowerCase();
      if (siblingTag === 'label' || siblingTag === 'span' || siblingTag === 'div') {
        const text = cleanText(prevSibling.textContent);
        if (isUsefulLabel(text) && text.length < 50) return text;
      }
    }
    
    current = current.parentElement;
    depth++;
  }
  
  // 7. Try placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && isUsefulLabel(placeholder)) return placeholder;
  
  // 8. Try name attribute (clean it up)
  const name = element.getAttribute('name');
  if (name && !name.startsWith('mat-') && isUsefulLabel(name)) {
    return formatAttributeName(name);
  }
  
  // 9. Try id attribute as last resort
  const id = element.getAttribute('id');
  if (id && !id.startsWith('mat-') && isUsefulLabel(id)) {
    return formatAttributeName(id);
  }
  
  // 10. Try formControlName (Angular)
  const formControlName = element.getAttribute('formcontrolname') || element.getAttribute('ng-model');
  if (formControlName && isUsefulLabel(formControlName)) {
    return formatAttributeName(formControlName);
  }
  
  return null;
}

// Check if a label text is useful (not just noise)
function isUsefulLabel(text) {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 2 || cleaned.length > 100) return false;
  
  // Skip generic/noise labels
  const noisePatterns = [
    /^(day|month|year|type|number|dd|mm|yyyy|select|choose|enter|input)$/i,
    /^mat-/i,
    /^ng-/i,
    /^input\d*$/i,
    /^field\d*$/i,
    /^\d+$/,
    /^[a-z]$/i,
    /^(true|false|null|undefined)$/i
  ];
  
  for (const pattern of noisePatterns) {
    if (pattern.test(cleaned)) return false;
  }
  
  return true;
}

// Format attribute names (camelCase, snake_case, kebab-case) to readable text
function formatAttributeName(name) {
  if (!name) return null;
  return name
    .replace(/[-_]/g, ' ')           // Replace dashes and underscores with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space before capitals (camelCase)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // Handle consecutive capitals
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim();
}

function cleanText(text) {
  if (!text) return null;
  return text.trim().replace(/\s+/g, ' ').replace(/[*:()]/g, '').replace(/\s+optional\s*/gi, '').trim();
}

function getStepperLabel(element) {
  const stepper = element.closest('mat-step, .mat-step');
  if (stepper) {
    const label = stepper.querySelector('mat-step-label, .mat-step-label');
    if (label) return label.textContent.trim();
  }
  return null;
}

function isActionButton(element, text, buttonType) {
  const textLower = text.toLowerCase();
  const buttonTypeLower = buttonType.toLowerCase();
  
  // Check button type
  if (buttonTypeLower === 'submit') return true;
  
  // Check button text for common action words
  const actionWords = ['submit', 'save', 'next', 'continue', 'confirm', 'send', 'create', 'update', 'delete', 'release', 'approve', 'reject'];
  if (actionWords.some(word => textLower.includes(word))) return true;
  
  // Check if it's a form submit button
  const form = element.closest('form');
  if (form && element.tagName.toLowerCase() === 'button') return true;
  
  return false;
}

function enableValidationCapture() {
  shouldCaptureValidation = true;
  
  // Clear existing timeout
  if (validationCaptureTimeout) {
    clearTimeout(validationCaptureTimeout);
  }
  
  // Disable validation capture after 2 seconds
  validationCaptureTimeout = setTimeout(() => {
    shouldCaptureValidation = false;
  }, 2000);
}

// Queue to ensure steps are recorded in order even with async operations
let stepQueue = Promise.resolve();

async function recordStep(step) {
  if (!isRecording) {
    console.log('Bug Recorder: Not recording, skipping step');
    return;
  }
  
  // Capture session ID to detect if recording was restarted during async operations
  const currentSessionId = recordingSessionId;
  
  step.timestamp = Date.now();
  step.url = location.href;
  step.priority = calculatePriority(step);
  
  const stepIndex = steps.length;
  console.log('Bug Recorder: Recording step', stepIndex + 1, ':', step.description, '(priority:', step.priority + ')');
  
  // Add step to array immediately to preserve order
  const stepRef = step;
  steps.push(stepRef);
  
  // Track clicks for API correlation
  if (step.type === 'click') {
    trackClickForAPICorrelation(stepIndex, step.timestamp);
  }
  
  // Queue the async operations to ensure ordering
  stepQueue = stepQueue.then(async () => {
    // Check if recording was stopped or restarted
    if (!isRecording || recordingSessionId !== currentSessionId) {
      console.log('Bug Recorder: Session changed, skipping async operations for step', stepIndex);
      return;
    }
    
    // Capture screenshots based on settings (non-blocking)
    if (settings.includeScreenshots) {
      try {
        stepRef.screenshot = await captureScreenshot();
      } catch (e) {
        console.warn('Bug Recorder: Screenshot failed, continuing without it');
        stepRef.screenshot = null;
      }
    }
    
    // Persist step via background script so all tabs on the same domain
    // contribute to a single shared steps list without races
    try {
      // Verify we're still in the same session before saving
      if (!isRecording || recordingSessionId !== currentSessionId) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'recordStep',
        step: stepRef,
        sessionId: currentSessionId
      });

      if (!response || !response.success) {
        console.warn('Bug Recorder: Background rejected step persist:', response);
      }
    } catch (error) {
      // If extension context is invalidated, stop recording gracefully
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('Bug Recorder: Extension reloaded. Please restart recording.');
        isRecording = false;
      } else {
        console.error('Bug Recorder: Error saving step:', error.message);
      }
    }
  }).catch(err => {
    console.error('Bug Recorder: Step queue error:', err);
  });
}

async function captureScreenshot() {
  console.log('Bug Recorder: Requesting screenshot (waiting 300ms for UI to settle)...');
  try {
    // Wait 150ms for UI to settle before capturing (optimal for Angular Material)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Bug Recorder: Screenshot timeout after 3s');
        resolve(null);
      }, 3000);
      
      chrome.runtime.sendMessage({ action: 'captureScreenshot', quality: settings.screenshotQuality || 25 }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          console.warn('Bug Recorder: Screenshot error:', chrome.runtime.lastError.message);
          resolve(null);
        } else if (response?.screenshot) {
          console.log('Bug Recorder: Screenshot received, size:', response.screenshot.length);
          resolve(response.screenshot);
        } else {
          console.warn('Bug Recorder: No screenshot in response');
          resolve(null);
        }
      });
    });
  } catch (e) {
    console.warn('Bug Recorder: Screenshot exception:', e.message);
    return null;
  }
}

function attachNetworkListener() {
  console.log('Bug Recorder: Attaching network listener');
  
  // Only inject once
  if (networkListenerAttached) {
    console.log('Bug Recorder: Network listener already attached, sending start signal');
    sendMessageToInjectedScript('startRecording', settings);
    return;
  }
  
  // Listen for network events from injected script
  window.addEventListener('__bugRecorder_network', handleNetworkEvent);
  
  // Inject the script into the page context
  injectPageScript();
  
  networkListenerAttached = true;
}

function injectPageScript() {
  if (injectedScriptReady) {
    sendMessageToInjectedScript('startRecording', settings);
    return;
  }
  
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      console.log('Bug Recorder: Injected script loaded');
      injectedScriptReady = true;
      // Give the script a moment to initialize, then send start signal
      setTimeout(() => {
        sendMessageToInjectedScript('startRecording', settings);
      }, 50);
      this.remove(); // Clean up the script tag
    };
    script.onerror = function(e) {
      console.error('Bug Recorder: Failed to inject script', e);
    };
    
    // Insert as early as possible
    (document.head || document.documentElement).appendChild(script);
    console.log('Bug Recorder: Script injection initiated');
  } catch (e) {
    console.error('Bug Recorder: Error injecting script:', e);
  }
}

function sendMessageToInjectedScript(action, settings) {
  window.dispatchEvent(new CustomEvent('__bugRecorder_control', {
    detail: { action, settings, sessionId: recordingSessionId }
  }));
  console.log('Bug Recorder: Sent', action, 'to injected script (session:', recordingSessionId, ')');
}

function handleNetworkEvent(e) {
  if (!isRecording) return;
  
  const data = e.detail;
  if (!data) return;
  
  console.log('Bug Recorder: Received network event:', data.method, data.path);
  
  recordNetworkStep({
    url: data.url,
    method: data.method,
    status: data.status,
    statusText: data.statusText,
    responseData: data.responseBody,
    requestBody: data.requestBody,
    duration: data.duration,
    success: data.success,
    errorMessage: data.errorMessage
  });
}


function recordNetworkStep(data) {
  if (!isRecording) return;
  
  console.log('Bug Recorder: Recording network request:', data.method, data.url);
  
  // Upgrade recent clicks that triggered this API request
  upgradeClickPriorityForAPI();
  
  const isFailed = !data.success;
  const isSlow = data.duration > 2000;
  
  let description = `${data.method} ${getPathFromURL(data.url)}`;
  if (isFailed) description += ` ❌ ${data.status} ${data.statusText}`;
  else if (isSlow) description += ` ⚠️ Slow (${(data.duration/1000).toFixed(1)}s)`;
  
  // Use provided error message or extract from response
  let errorMessage = data.errorMessage;
  if (!errorMessage && isFailed && data.responseData) {
    errorMessage = extractErrorMessage(data.responseData);
  }
  
  // Correlate request body properties with input fields
  const fieldMappings = correlateRequestWithInputs(data.requestBody);
  
  recordStep({
    type: 'network',
    description,
    details: {
      method: data.method,
      url: data.url,
      status: data.status,
      statusText: data.statusText,
      duration: data.duration,
      requestBody: data.requestBody || formatData(data.body),
      responseBody: data.responseData,
      errorMessage: errorMessage,
      isFailed: isFailed,
      isSlow: isSlow,
      triggeredBy: lastUserAction?.description,
      fieldMappings: fieldMappings
    }
  });
}

// Correlate request body properties with recent input field values
function correlateRequestWithInputs(requestBody) {
  if (!requestBody) return [];
  
  const mappings = [];
  let bodyObj;
  
  // Parse request body if it's a string
  try {
    bodyObj = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
  } catch (e) {
    console.log('Bug Recorder: Could not parse request body for correlation');
    return [];
  }
  
  // Get all recent input values
  const inputValues = Array.from(recentInputs.values());
  
  // Recursively search for matching values in the request body
  function searchObject(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (value !== null && typeof value === 'object') {
        // Recursively search nested objects and arrays
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              searchObject(item, `${currentPath}[${index}]`);
            } else {
              // Check array primitive values
              const match = findMatchingInput(item, inputValues);
              if (match) {
                mappings.push({
                  propPath: `${currentPath}[${index}]`,
                  value: item,
                  sourceField: match.fieldLabel
                });
              }
            }
          });
        } else {
          searchObject(value, currentPath);
        }
      } else {
        // Check primitive values (string, number, boolean)
        const match = findMatchingInput(value, inputValues);
        if (match) {
          mappings.push({
            propPath: currentPath,
            value: value,
            sourceField: match.fieldLabel
          });
        }
      }
    }
  }
  
  searchObject(bodyObj);
  
  console.log('Bug Recorder: Found', mappings.length, 'field mappings in request');
  return mappings;
}

// Find a matching input entry for a given value
function findMatchingInput(value, inputValues) {
  if (value === null || value === undefined || value === '') return null;
  
  const valueStr = String(value).toLowerCase().trim();
  if (!valueStr) return null;
  
  // Find input with matching value
  for (const input of inputValues) {
    const inputValueStr = String(input.value).toLowerCase().trim();
    
    // Exact match
    if (inputValueStr === valueStr) {
      return input;
    }
    
    // Check if value contains the input value (for cases where values are transformed)
    if (valueStr.includes(inputValueStr) && inputValueStr.length > 2) {
      return input;
    }
  }
  
  return null;
}

function getPathFromURL(url) {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.pathname;
  } catch (e) {
    return url;
  }
}

function extractErrorMessage(data) {
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (data.errors) return JSON.stringify(data.errors);
  if (data.detail) return data.detail;
  return null;
}

// Format data as JSON string (no truncation - full data for debugging)
function formatData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    // Try to parse and re-stringify for consistent formatting
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return data;
    }
  }
  return JSON.stringify(data, null, 2);
}

function removeListeners() {
  if (clickListener) {
    document.removeEventListener('click', clickListener, true);
    clickListener = null;
  }
  if (inputListener) {
    document.removeEventListener('input', inputListener, true);
    inputListener = null;
  }
  if (changeListener) {
    document.removeEventListener('change', changeListener, true);
    changeListener = null;
  }
  if (focusListener) {
    document.removeEventListener('focus', focusListener, true);
    focusListener = null;
  }
  if (blurListener) {
    document.removeEventListener('blur', blurListener, true);
    blurListener = null;
  }
  if (scrollListener) {
    document.removeEventListener('scroll', scrollListener, true);
    scrollListener = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (navigationObserver) {
    navigationObserver.disconnect();
    navigationObserver = null;
  }
  if (errorListener) {
    window.removeEventListener('error', errorListener);
    errorListener = null;
  }
  if (rejectionListener) {
    window.removeEventListener('unhandledrejection', rejectionListener);
    rejectionListener = null;
  }
  
  // Stop network capture in injected script and reset flag
  if (networkListenerAttached) {
    sendMessageToInjectedScript('stopRecording', {});
    // Note: We don't reset networkListenerAttached here because the event listener
    // in the window is still attached. It will be reset in resetAllState() for new recordings.
  }
  
  // Clear all pending debounce timers
  Object.values(inputDebounceTimers).forEach(timer => clearTimeout(timer));
  inputDebounceTimers = {};
  
  // Clear validation timeout
  if (validationCaptureTimeout) {
    clearTimeout(validationCaptureTimeout);
    validationCaptureTimeout = null;
  }
  
  // Clear touched fields tracking
  touchedFields.clear();
  
  // Clear recent inputs tracking
  recentInputs.clear();
  
  console.log('Bug Recorder: All listeners removed');
}
