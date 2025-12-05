/**
 * Popup main entry point
 * Handles UI interactions and communication with background/content scripts
 */

import { getState, setState, onStateChange } from '../shared/storage.js';
import { MESSAGES } from '../shared/constants.js';
import { updateUI, updateStepCount, loadSettings, getSettings, initSettingsListeners } from './ui.js';
import { generateReport, downloadHTML } from '../report/htmlGenerator.js';
import { generateTextReport } from '../report/textGenerator.js';
import { mergeSteps } from '../report/stepProcessor.js';

let isRecording = false;
let currentSessionId = null;

/**
 * Initialize popup on DOM load
 */
document.addEventListener('DOMContentLoaded', async () => {
  const state = await getState([
    'isRecording',
    'steps',
    'settings',
    'recordingSessionId',
    'activeSessionDomain'
  ]);
  
  isRecording = state.isRecording || false;
  currentSessionId = state.recordingSessionId || null;
  
  updateUI(isRecording);
  updateStepCount(state.steps?.length || 0);
  loadSettings(state.settings);
  initSettingsListeners();
});

/**
 * Start recording button handler
 */
document.getElementById('startBtn').addEventListener('click', async () => {
  const settings = getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url) {
    alert('Unable to determine current tab URL. Please try again.');
    return;
  }

  let domain;
  try {
    const url = new URL(tab.url);
    domain = url.hostname;
  } catch (e) {
    alert('Unable to start recording on this page.');
    return;
  }

  // Ask background to start or join a domain-scoped session
  let sessionId;
  let isNewSession = true;
  try {
    const response = await chrome.runtime.sendMessage({
      action: MESSAGES.START_SESSION,
      domain,
      settings
    });
    if (!response || !response.success) {
      alert('Could not start recording. Please try again.');
      return;
    }
    sessionId = response.sessionId;
    isNewSession = !!response.isNewSession;
  } catch (e) {
    alert('Could not start recording. Please try again.');
    return;
  }
  
  currentSessionId = sessionId;
  if (isNewSession) {
    updateStepCount(0);
  }
  
  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    await chrome.tabs.sendMessage(tab.id, { 
      action: MESSAGES.START_RECORDING, 
      settings, 
      sessionId, 
      isNewSession 
    });
    isRecording = true;
    updateUI(isRecording);
  } catch (error) {
    alert('Cannot record on this page. Try a regular webpage.');
  }
});

/**
 * Stop recording button handler
 */
document.getElementById('stopBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Send stop message to content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: MESSAGES.STOP_RECORDING });
  } catch (error) {
    // Error sending stop message
  }
  
  // Wait for pending steps to be saved
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Notify background to stop the session
  try {
    await chrome.runtime.sendMessage({ action: MESSAGES.STOP_SESSION });
  } catch (e) {
    // Error notifying background
  }
  
  isRecording = false;
  currentSessionId = null;
  updateUI(isRecording);
  
  // Show step count
  const { steps } = await getState(['steps']);
  updateStepCount(steps?.length || 0);
});

/**
 * Export button handler - download HTML report
 */
document.getElementById('exportBtn').addEventListener('click', async () => {
  const { steps, settings } = await getState(['steps', 'settings']);
  
  if (!steps || steps.length === 0) {
    alert('No steps recorded yet. Start recording and perform some actions first.');
    return;
  }
  
  const mergedSteps = mergeSteps(steps);
  const html = generateReport(mergedSteps, settings || {});
  downloadHTML(html);
});

/**
 * Copy button handler - copy text report to clipboard
 */
document.getElementById('copyBtn').addEventListener('click', async () => {
  const { steps, settings } = await getState(['steps', 'settings']);
  
  if (!steps || steps.length === 0) {
    alert('No steps recorded yet. Start recording and perform some actions first.');
    return;
  }
  
  const mergedSteps = mergeSteps(steps);
  const text = generateTextReport(mergedSteps, settings || {});
  await navigator.clipboard.writeText(text);
  alert('Report copied to clipboard!');
});

/**
 * Clear button handler - clear all recorded steps
 */
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (confirm('Clear all recorded steps?')) {
    await setState({ steps: [] });
    updateStepCount(0);
  }
});

/**
 * Listen for storage changes to update step count
 */
onStateChange((changes) => {
  if (changes.steps) {
    updateStepCount(changes.steps.length);
  }
});

