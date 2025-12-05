/**
 * Background service worker
 * Handles state management, screenshots, and cross-tab coordination
 */

import { MESSAGES, DEFAULT_SETTINGS } from '../shared/constants.js';

// ==========================================
// State Management
// ==========================================

let recordingState = {
  isRecording: false,
  activeSessionDomain: null,
  recordingSessionId: null,
  steps: [],
  settings: null
};

let stateLoadedPromise = null;
let stateLoaded = false;

async function loadRecordingState() {
  try {
    const stored = await chrome.storage.local.get([
      'isRecording',
      'steps',
      'settings',
      'recordingSessionId',
      'activeSessionDomain'
    ]);
    recordingState.isRecording = stored.isRecording || false;
    recordingState.steps = stored.steps || [];
    recordingState.settings = stored.settings || null;
    recordingState.recordingSessionId = stored.recordingSessionId || null;
    recordingState.activeSessionDomain = stored.activeSessionDomain || null;
    stateLoaded = true;
  } catch (e) {
    stateLoaded = true;
  }
}

async function ensureStateLoaded() {
  if (stateLoaded) return;
  if (stateLoadedPromise) {
    await stateLoadedPromise;
  }
}

async function saveRecordingState() {
  try {
    await chrome.storage.local.set({
      isRecording: recordingState.isRecording,
      steps: recordingState.steps,
      settings: recordingState.settings,
      recordingSessionId: recordingState.recordingSessionId,
      activeSessionDomain: recordingState.activeSessionDomain
    });
  } catch (e) {
    // Failed to save state
  }
}

// ==========================================
// Message Handling
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === MESSAGES.CAPTURE_SCREENSHOT) {
    const quality = message.quality || 25;
    chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: quality }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ screenshot: null });
      } else {
        sendResponse({ screenshot: dataUrl });
      }
    });
    return true;
  } else if (message.action === MESSAGES.START_SESSION) {
    (async () => {
      await ensureStateLoaded();
      
      const domain = message.domain;
      const newSettings = message.settings || {};
      const now = Date.now();

      let isNewSession = true;

      // If we're already recording on this domain, join the existing session
      if (recordingState.isRecording && recordingState.activeSessionDomain === domain) {
        isNewSession = false;
        recordingState.settings = { ...(recordingState.settings || {}), ...newSettings };
      } else {
        // Start a brand new session for this domain
        recordingState.isRecording = true;
        recordingState.activeSessionDomain = domain;
        recordingState.recordingSessionId = now;
        recordingState.steps = [];
        recordingState.settings = newSettings;
      }

      await saveRecordingState();
      sendResponse({
        success: true,
        sessionId: recordingState.recordingSessionId,
        isNewSession,
        domain: recordingState.activeSessionDomain
      });
    })().catch((e) => {
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  } else if (message.action === MESSAGES.STOP_SESSION) {
    (async () => {
      await ensureStateLoaded();
      recordingState.isRecording = false;
      recordingState.activeSessionDomain = null;
      recordingState.recordingSessionId = null;
      await saveRecordingState();
      sendResponse({ success: true });
    })().catch((e) => {
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  } else if (message.action === MESSAGES.RECORD_STEP) {
    (async () => {
      await ensureStateLoaded();
      
      const { step, sessionId } = message;

      // Ignore if we're not recording
      if (!recordingState.isRecording) {
        sendResponse({ success: false, reason: 'notRecording' });
        return;
      }

      // Ignore if the sessionId doesn't match the active session
      if (
        sessionId &&
        recordingState.recordingSessionId &&
        sessionId !== recordingState.recordingSessionId
      ) {
        sendResponse({ success: false, reason: 'sessionMismatch' });
        return;
      }

      recordingState.steps.push(step);

      try {
        await chrome.storage.local.set({ steps: recordingState.steps });
        sendResponse({ success: true, totalSteps: recordingState.steps.length });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })().catch((e) => {
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  }
});

// ==========================================
// Installation Handler
// ==========================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      isRecording: false,
      steps: [],
      settings: DEFAULT_SETTINGS,
      recordingSessionId: null,
      activeSessionDomain: null
    });
  } else if (details.reason === 'update') {
    const existing = await chrome.storage.local.get(['settings', 'isRecording', 'steps']);
    
    const mergedSettings = { ...DEFAULT_SETTINGS, ...(existing.settings || {}) };
    
    await chrome.storage.local.set({
      settings: mergedSettings
    });
  }
});

// ==========================================
// Initialization
// ==========================================

stateLoadedPromise = loadRecordingState();


