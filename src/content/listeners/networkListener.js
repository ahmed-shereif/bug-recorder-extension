/**
 * Network request listener using injected script
 */

import { getPathFromURL, formatData } from '../../shared/utils.js';

/**
 * Create a network listener
 * @param {Function} recordStep - Function to record network step
 * @param {Object} state - Shared state object
 * @returns {Function} Network event handler
 */
export function createNetworkListener(recordStep, state) {
  return function handleNetworkEvent(e) {
    if (!state.isRecording) return;
    
    const data = e.detail;
    if (!data) return;
    
    console.log('Bug Recorder: Received network event:', data.method, data.path);
    
    recordNetworkStep(recordStep, state, {
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
  };
}

/**
 * Record a network request step
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @param {Object} data - Network request data
 */
function recordNetworkStep(recordStep, state, data) {
  if (!state.isRecording) return;
  
  console.log('Bug Recorder: Recording network request:', data.method, data.url);
  
  // Upgrade recent clicks that triggered this API request
  state.upgradeClickPriorityForAPI();
  
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
  const fieldMappings = correlateRequestWithInputs(data.requestBody, state.recentInputs);
  
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
      triggeredBy: state.lastUserAction?.description,
      fieldMappings: fieldMappings
    }
  });
}

/**
 * Extract error message from response data
 * @param {*} data - Response data
 * @returns {string|null} Error message
 */
function extractErrorMessage(data) {
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (data.errors) return JSON.stringify(data.errors);
  if (data.detail) return data.detail;
  return null;
}

/**
 * Correlate request body properties with recent input field values
 * @param {*} requestBody - Request body
 * @param {Map} recentInputs - Map of recent input values
 * @returns {Array} Field mappings
 */
function correlateRequestWithInputs(requestBody, recentInputs) {
  if (!requestBody) return [];
  
  const mappings = [];
  let bodyObj;
  
  try {
    bodyObj = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
  } catch (e) {
    return [];
  }
  
  const inputValues = Array.from(recentInputs.values());
  
  function searchObject(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              searchObject(item, `${currentPath}[${index}]`);
            } else {
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
  return mappings;
}

/**
 * Find a matching input entry for a given value
 * @param {*} value - Value to match
 * @param {Array} inputValues - Array of input entries
 * @returns {Object|null} Matching input entry
 */
function findMatchingInput(value, inputValues) {
  if (value === null || value === undefined || value === '') return null;
  
  const valueStr = String(value).toLowerCase().trim();
  if (!valueStr) return null;
  
  for (const input of inputValues) {
    const inputValueStr = String(input.value).toLowerCase().trim();
    
    if (inputValueStr === valueStr) {
      return input;
    }
    
    if (valueStr.includes(inputValueStr) && inputValueStr.length > 2) {
      return input;
    }
  }
  
  return null;
}

/**
 * Inject the network interceptor script into the page
 * @param {Object} state - Shared state object
 */
export function injectNetworkScript(state) {
  if (state.injectedScriptReady) {
    sendMessageToInjectedScript('startRecording', state.settings, state.recordingSessionId);
    return;
  }
  
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      console.log('Bug Recorder: Injected script loaded');
      state.injectedScriptReady = true;
      setTimeout(() => {
        sendMessageToInjectedScript('startRecording', state.settings, state.recordingSessionId);
      }, 50);
      this.remove();
    };
    script.onerror = function(e) {
      console.error('Bug Recorder: Failed to inject script', e);
    };
    
    (document.head || document.documentElement).appendChild(script);
    console.log('Bug Recorder: Script injection initiated');
  } catch (e) {
    console.error('Bug Recorder: Error injecting script:', e);
  }
}

/**
 * Send a message to the injected script
 * @param {string} action - Action name
 * @param {Object} settings - Settings object
 * @param {number} sessionId - Recording session ID
 */
export function sendMessageToInjectedScript(action, settings, sessionId) {
  window.dispatchEvent(new CustomEvent('__bugRecorder_control', {
    detail: { action, settings, sessionId }
  }));
  console.log('Bug Recorder: Sent', action, 'to injected script (session:', sessionId, ')');
}


