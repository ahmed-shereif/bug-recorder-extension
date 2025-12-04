/**
 * Content script main entry point
 * Orchestrates all recording functionality
 */

import { MESSAGES, TIMEOUTS, PRIORITY } from '../shared/constants.js';
import { getSelector } from './utils/selectorBuilder.js';
import { createClickListener } from './listeners/clickListener.js';
import { createInputListener, createChangeListener, createFocusListeners } from './listeners/inputListener.js';
import { createNavigationListener, startNavigationObserver, stopNavigationObserver } from './listeners/navigationListener.js';
import { createScrollListener } from './listeners/scrollListener.js';
import { createErrorListeners } from './listeners/errorListener.js';
import { createValidationListener, startValidationObserver, stopValidationObserver } from './listeners/validationListener.js';
import { createNetworkListener, injectNetworkScript, sendMessageToInjectedScript } from './listeners/networkListener.js';

// ==========================================
// State Management
// ==========================================

const state = {
  isRecording: false,
  settings: {},
  steps: [],
  recordingSessionId: null,
  
  // Listener references
  listeners: {
    click: null,
    input: null,
    change: null,
    focus: null,
    blur: null,
    scroll: null,
    error: null,
    rejection: null,
    network: null
  },
  observers: {
    navigation: null,
    validation: null
  },
  
  // Tracking
  touchedFields: new Set(),
  recentInputs: new Map(),
  recentClicks: [],
  lastUserAction: null,
  shouldCaptureValidation: false,
  validationCaptureTimeout: null,
  networkListenerAttached: false,
  injectedScriptReady: false,
  
  // Methods for listeners
  markFieldAsTouched(element) {
    const fieldId = element.id;
    const fieldName = element.getAttribute('name');
    const selector = getSelector(element);
    const formField = element.closest('mat-form-field, .form-field, .input-group');
    const formFieldSelector = formField ? getSelector(formField) : null;
    
    if (fieldId) this.touchedFields.add(`id:${fieldId}`);
    if (fieldName) this.touchedFields.add(`name:${fieldName}`);
    if (selector) this.touchedFields.add(`selector:${selector}`);
    if (formFieldSelector) this.touchedFields.add(`formField:${formFieldSelector}`);
    
    // Also add by label if found
    const label = element.closest('mat-form-field, .form-field')?.querySelector('mat-label, label')?.textContent?.trim();
    if (label) this.touchedFields.add(`label:${label.toLowerCase()}`);
  },
  
  isFieldTouched(element, fieldName, fieldLabel) {
    if (fieldName && this.touchedFields.has(`name:${fieldName}`)) return true;
    if (fieldLabel && this.touchedFields.has(`label:${fieldLabel.toLowerCase()}`)) return true;
    
    if (element) {
      const fieldId = element.id;
      if (fieldId && this.touchedFields.has(`id:${fieldId}`)) return true;
      
      const selector = getSelector(element);
      if (selector && this.touchedFields.has(`selector:${selector}`)) return true;
    }
    
    return false;
  },
  
  trackRecentInput(fieldKey, fieldLabel, fieldName, value) {
    this.recentInputs.set(fieldKey, {
      fieldLabel: fieldLabel || fieldName || fieldKey,
      fieldName: fieldName,
      value: value,
      timestamp: Date.now()
    });
    this.cleanupOldInputs();
  },
  
  cleanupOldInputs() {
    const now = Date.now();
    for (const [key, entry] of this.recentInputs.entries()) {
      if (now - entry.timestamp > TIMEOUTS.RECENT_INPUT_MAX_AGE) {
        this.recentInputs.delete(key);
      }
    }
  },
  
  enableValidationCapture() {
    this.shouldCaptureValidation = true;
    if (this.validationCaptureTimeout) {
      clearTimeout(this.validationCaptureTimeout);
    }
    this.validationCaptureTimeout = setTimeout(() => {
      this.shouldCaptureValidation = false;
    }, TIMEOUTS.VALIDATION_WINDOW);
  },
  
  trackClickForAPICorrelation(stepIndex, timestamp) {
    this.recentClicks.push({ stepIndex, timestamp });
    const now = Date.now();
    this.recentClicks = this.recentClicks.filter(click => now - click.timestamp < TIMEOUTS.CLICK_TRACKING_MAX_AGE);
  },
  
  upgradeClickPriorityForAPI() {
    const now = Date.now();
    for (const click of this.recentClicks) {
      if (now - click.timestamp < TIMEOUTS.API_CORRELATION_WINDOW) {
        const step = this.steps[click.stepIndex];
        if (step && step.type === 'click' && step.priority !== PRIORITY.HIGH && step.priority !== PRIORITY.CRITICAL) {
          console.log('Bug Recorder: Upgrading click priority to high (triggered API):', step.description);
          step.priority = PRIORITY.HIGH;
          step.triggeredAPI = true;
        }
      }
    }
  }
};

// Step queue to ensure ordering
let stepQueue = Promise.resolve();

// ==========================================
// Initialization
// ==========================================

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
      state.isRecording = true;
      state.settings = result.settings || {};
      state.steps = result.steps || [];
      state.recordingSessionId = result.recordingSessionId || Date.now();
      console.log('Bug Recorder: Resuming recording with', state.steps.length, 'steps (session:', state.recordingSessionId, ', domain:', currentDomain, ')');
      initRecording();
    } else if (result.isRecording) {
      console.log('Bug Recorder: Active recording exists for different domain', result.activeSessionDomain, '- not auto-resuming on', currentDomain);
    }
  } catch (e) {
    console.log('Bug Recorder: Extension not ready yet');
  }
})();

// ==========================================
// Message Handling
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === MESSAGES.START_RECORDING) {
      resetAllState();
      state.isRecording = true;
      state.settings = message.settings;
      state.recordingSessionId = message.sessionId || Date.now();
      
      console.log('Bug Recorder: Started recording (session:', state.recordingSessionId, ', isNewSession:', !!message.isNewSession, ')');
      console.log('Bug Recorder: Settings:', state.settings);
      initRecording();
      sendResponse({ success: true });
    } else if (message.action === MESSAGES.STOP_RECORDING) {
      state.isRecording = false;
      console.log('Bug Recorder: Stopped recording with', state.steps.length, 'steps');
      removeListeners();
      sendResponse({ success: true });
    } else if (message.action === MESSAGES.GET_STATUS) {
      sendResponse({ 
        isRecording: state.isRecording, 
        stepCount: state.steps.length,
        sessionId: state.recordingSessionId 
      });
    }
  } catch (e) {
    console.error('Bug Recorder: Message handler error:', e);
    sendResponse({ success: false, error: e.message });
  }
  return true;
});

// ==========================================
// Recording Functions
// ==========================================

function resetAllState() {
  state.steps = [];
  stepQueue = Promise.resolve();
  state.touchedFields.clear();
  state.recentInputs.clear();
  state.recentClicks = [];
  state.lastUserAction = null;
  state.shouldCaptureValidation = false;
  
  if (state.validationCaptureTimeout) {
    clearTimeout(state.validationCaptureTimeout);
    state.validationCaptureTimeout = null;
  }
  
  state.networkListenerAttached = false;
  state.injectedScriptReady = false;
}

function initRecording() {
  removeListeners();
  
  console.log('Bug Recorder: Initializing with settings:', state.settings);
  
  if (state.settings.captureClicks) {
    state.listeners.click = createClickListener(recordStep, state);
    document.addEventListener('click', state.listeners.click, true);
    console.log('Bug Recorder: Click listener attached');
  }
  
  if (state.settings.captureInputs) {
    state.listeners.input = createInputListener(recordStep, state);
    state.listeners.change = createChangeListener(recordStep, state);
    const focusListeners = createFocusListeners(state);
    state.listeners.focus = focusListeners.focusListener;
    state.listeners.blur = focusListeners.blurListener;
    
    document.addEventListener('input', state.listeners.input, true);
    document.addEventListener('change', state.listeners.change, true);
    document.addEventListener('focus', state.listeners.focus, true);
    document.addEventListener('blur', state.listeners.blur, true);
    console.log('Bug Recorder: Input listeners attached');
  }
  
  if (state.settings.captureNavigation) {
    state.observers.navigation = createNavigationListener(recordStep, state);
    startNavigationObserver(state.observers.navigation);
    console.log('Bug Recorder: Navigation listener attached');
  }
  
  if (state.settings.captureScroll) {
    state.listeners.scroll = createScrollListener(recordStep, state);
    document.addEventListener('scroll', state.listeners.scroll, true);
    console.log('Bug Recorder: Scroll listener attached');
  }
  
  if (state.settings.captureErrors) {
    const errorListeners = createErrorListeners(recordStep, state);
    state.listeners.error = errorListeners.errorListener;
    state.listeners.rejection = errorListeners.rejectionListener;
    window.addEventListener('error', state.listeners.error);
    window.addEventListener('unhandledrejection', state.listeners.rejection);
    console.log('Bug Recorder: Error listener attached');
  }
  
  if (state.settings.captureValidation) {
    state.observers.validation = createValidationListener(recordStep, state);
    startValidationObserver(state.observers.validation);
    console.log('Bug Recorder: Validation listener attached');
  }
  
  if (state.settings.captureNetwork) {
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

function attachNetworkListener() {
  if (state.networkListenerAttached) {
    sendMessageToInjectedScript('startRecording', state.settings, state.recordingSessionId);
    return;
  }
  
  state.listeners.network = createNetworkListener(recordStep, state);
  window.addEventListener('__bugRecorder_network', state.listeners.network);
  injectNetworkScript(state);
  state.networkListenerAttached = true;
}

function removeListeners() {
  if (state.listeners.click) {
    document.removeEventListener('click', state.listeners.click, true);
    state.listeners.click = null;
  }
  if (state.listeners.input) {
    document.removeEventListener('input', state.listeners.input, true);
    state.listeners.input = null;
  }
  if (state.listeners.change) {
    document.removeEventListener('change', state.listeners.change, true);
    state.listeners.change = null;
  }
  if (state.listeners.focus) {
    document.removeEventListener('focus', state.listeners.focus, true);
    state.listeners.focus = null;
  }
  if (state.listeners.blur) {
    document.removeEventListener('blur', state.listeners.blur, true);
    state.listeners.blur = null;
  }
  if (state.listeners.scroll) {
    document.removeEventListener('scroll', state.listeners.scroll, true);
    state.listeners.scroll = null;
  }
  if (state.listeners.error) {
    window.removeEventListener('error', state.listeners.error);
    state.listeners.error = null;
  }
  if (state.listeners.rejection) {
    window.removeEventListener('unhandledrejection', state.listeners.rejection);
    state.listeners.rejection = null;
  }
  
  stopNavigationObserver(state.observers.navigation);
  state.observers.navigation = null;
  
  stopValidationObserver(state.observers.validation);
  state.observers.validation = null;
  
  if (state.networkListenerAttached) {
    sendMessageToInjectedScript('stopRecording', {}, state.recordingSessionId);
  }
  
  state.touchedFields.clear();
  state.recentInputs.clear();
  
  if (state.validationCaptureTimeout) {
    clearTimeout(state.validationCaptureTimeout);
    state.validationCaptureTimeout = null;
  }
  
  console.log('Bug Recorder: All listeners removed');
}

// ==========================================
// Step Recording
// ==========================================

function calculatePriority(step) {
  const type = step.type;
  const details = step.details || {};
  
  if (type === 'error' || type === 'validation') return PRIORITY.CRITICAL;
  if (type === 'network' && details.isFailed) return PRIORITY.CRITICAL;
  
  if (type === 'input') return PRIORITY.HIGH;
  if (type === 'click') return PRIORITY.HIGH;
  if (type === 'navigation') return PRIORITY.HIGH;
  if (type === 'network' && details.isSlow) return PRIORITY.HIGH;
  
  if (type === 'network') return PRIORITY.MEDIUM;
  
  return PRIORITY.LOW;
}

async function recordStep(step) {
  if (!state.isRecording) {
    console.log('Bug Recorder: Not recording, skipping step');
    return;
  }
  
  const currentSessionId = state.recordingSessionId;
  
  step.timestamp = Date.now();
  step.url = location.href;
  step.priority = calculatePriority(step);
  
  const stepIndex = state.steps.length;
  console.log('Bug Recorder: Recording step', stepIndex + 1, ':', step.description, '(priority:', step.priority + ')');
  
  const stepRef = step;
  state.steps.push(stepRef);
  
  if (step.type === 'click') {
    state.trackClickForAPICorrelation(stepIndex, step.timestamp);
  }
  
  stepQueue = stepQueue.then(async () => {
    if (!state.isRecording || state.recordingSessionId !== currentSessionId) {
      console.log('Bug Recorder: Session changed, skipping async operations for step', stepIndex);
      return;
    }
    
    // Capture screenshots based on settings
    if (state.settings.includeScreenshots) {
      try {
        stepRef.screenshot = await captureScreenshot();
      } catch (e) {
        console.warn('Bug Recorder: Screenshot failed, continuing without it');
        stepRef.screenshot = null;
      }
    }
    
    // Persist step via background script
    try {
      if (!state.isRecording || state.recordingSessionId !== currentSessionId) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: MESSAGES.RECORD_STEP,
        step: stepRef,
        sessionId: currentSessionId
      });

      if (!response || !response.success) {
        console.warn('Bug Recorder: Background rejected step persist:', response);
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.error('Bug Recorder: Extension reloaded. Please restart recording.');
        state.isRecording = false;
      } else {
        console.error('Bug Recorder: Error saving step:', error.message);
      }
    }
  }).catch(err => {
    console.error('Bug Recorder: Step queue error:', err);
  });
}

async function captureScreenshot() {
  console.log('Bug Recorder: Requesting screenshot...');
  try {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Bug Recorder: Screenshot timeout after 3s');
        resolve(null);
      }, TIMEOUTS.SCREENSHOT);
      
      chrome.runtime.sendMessage({ 
        action: MESSAGES.CAPTURE_SCREENSHOT, 
        quality: state.settings.screenshotQuality || 25 
      }, (response) => {
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

