/**
 * UI helper functions for the popup
 */

import { setState } from '../shared/storage.js';

/**
 * Update the UI based on recording state
 * @param {boolean} isRecording - Whether recording is active
 */
export function updateUI(isRecording) {
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isRecording) {
    statusText.textContent = 'Recording';
    status.className = 'status recording';
    statusDot.style.display = 'block';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    statusText.textContent = 'Ready';
    status.className = 'status stopped';
    statusDot.style.display = 'none';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
}

/**
 * Update the step count display
 * @param {number} count - Number of steps recorded
 */
export function updateStepCount(count) {
  const text = count === 0 ? 'No steps recorded' : `${count} step${count === 1 ? '' : 's'} recorded`;
  document.getElementById('stepCount').textContent = text;
}

/**
 * Load settings from state into UI elements
 * @param {Object} settings - Settings object
 */
export function loadSettings(settings) {
  if (!settings) return;
  
  Object.keys(settings).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = settings[key];
      } else if (el.tagName === 'SELECT') {
        el.value = settings[key];
      }
    }
  });
}

/**
 * Get current settings from UI elements
 * @returns {Object} Settings object
 */
export function getSettings() {
  return {
    captureClicks: document.getElementById('captureClicks').checked,
    captureInputs: document.getElementById('captureInputs').checked,
    captureNavigation: document.getElementById('captureNavigation').checked,
    captureScroll: document.getElementById('captureScroll').checked,
    captureErrors: document.getElementById('captureErrors').checked,
    captureValidation: document.getElementById('captureValidation').checked,
    captureNetwork: document.getElementById('captureNetwork').checked,
    includeTimestamps: document.getElementById('includeTimestamps').checked,
    includeUrls: document.getElementById('includeUrls').checked,
    includeScreenshots: document.getElementById('includeScreenshots').checked,
    screenshotQuality: parseInt(document.getElementById('screenshotQuality').value, 10)
  };
}

/**
 * Initialize settings change listeners
 */
export function initSettingsListeners() {
  const settingIds = [
    'captureClicks', 'captureInputs', 'captureNavigation', 'captureScroll',
    'captureErrors', 'captureValidation', 'captureNetwork',
    'includeTimestamps', 'includeUrls', 'includeScreenshots', 'screenshotQuality'
  ];
  
  settingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        const settings = getSettings();
        await setState({ settings });
      });
    }
  });
}
