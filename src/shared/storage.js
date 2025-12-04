/**
 * Chrome storage wrapper for consistent state management
 */

import { DEFAULT_SETTINGS } from './constants.js';

const STORAGE_DEFAULTS = {
  isRecording: false,
  steps: [],
  settings: DEFAULT_SETTINGS,
  recordingSessionId: null,
  activeSessionDomain: null
};

/**
 * Get state from chrome.storage.local with defaults
 * @param {string[]|null} keys - Keys to fetch, or null for all
 * @returns {Promise<Object>} State object with defaults applied
 */
export async function getState(keys = null) {
  const keysToFetch = keys || Object.keys(STORAGE_DEFAULTS);
  const stored = await chrome.storage.local.get(keysToFetch);
  
  return keysToFetch.reduce((acc, key) => {
    acc[key] = stored[key] ?? STORAGE_DEFAULTS[key];
    return acc;
  }, {});
}

/**
 * Set state in chrome.storage.local
 * @param {Object} updates - Key-value pairs to update
 * @returns {Promise<void>}
 */
export async function setState(updates) {
  await chrome.storage.local.set(updates);
}

/**
 * Add a step to storage
 * @param {Object} step - Step to add
 * @returns {Promise<number>} New step count
 */
export async function addStep(step) {
  const { steps } = await getState(['steps']);
  steps.push(step);
  await setState({ steps });
  return steps.length;
}

/**
 * Clear all recorded steps
 * @returns {Promise<void>}
 */
export async function clearSteps() {
  await setState({ steps: [] });
}

/**
 * Listen for storage changes
 * @param {Function} callback - Callback with changes object
 * @returns {Function} Unsubscribe function
 */
export function onStateChange(callback) {
  const listener = (changes) => {
    const updates = {};
    for (const [key, { newValue }] of Object.entries(changes)) {
      updates[key] = newValue;
    }
    callback(updates);
  };
  
  chrome.storage.onChanged.addListener(listener);
  
  return () => chrome.storage.onChanged.removeListener(listener);
}


