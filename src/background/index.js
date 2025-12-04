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
    console.error('Bug Recorder: Failed to load recording state:', e);
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
    console.error('Bug Recorder: Failed to save recording state:', e);
  }
}

// ==========================================
// Message Handling
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === MESSAGES.CAPTURE_SCREENSHOT) {
    const quality = message.quality || 25;
    console.log('Bug Recorder: Screenshot requested with quality:', quality);
    try {
      chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: quality }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Bug Recorder: Screenshot error:', chrome.runtime.lastError);
          sendResponse({ screenshot: null });
        } else {
          console.log('Bug Recorder: Screenshot captured, size:', dataUrl?.length || 0);
          sendResponse({ screenshot: dataUrl });
        }
      });
    } catch (error) {
      console.error('Bug Recorder: Screenshot exception:', error);
      sendResponse({ screenshot: null });
    }
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
        console.log('Bug Recorder: Joining existing session for domain', domain, 'session:', recordingState.recordingSessionId);
      } else {
        // Start a brand new session for this domain
        recordingState.isRecording = true;
        recordingState.activeSessionDomain = domain;
        recordingState.recordingSessionId = now;
        recordingState.steps = [];
        recordingState.settings = newSettings;
        console.log('Bug Recorder: Starting NEW session for domain', domain, 'session:', recordingState.recordingSessionId);
      }

      await saveRecordingState();
      sendResponse({
        success: true,
        sessionId: recordingState.recordingSessionId,
        isNewSession,
        domain: recordingState.activeSessionDomain
      });
    })().catch((e) => {
      console.error('Bug Recorder: startSession error:', e);
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  } else if (message.action === MESSAGES.STOP_SESSION) {
    (async () => {
      await ensureStateLoaded();
      console.log('Bug Recorder: Stopping recording session');
      recordingState.isRecording = false;
      recordingState.activeSessionDomain = null;
      recordingState.recordingSessionId = null;
      await saveRecordingState();
      sendResponse({ success: true });
    })().catch((e) => {
      console.error('Bug Recorder: stopSession error:', e);
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  } else if (message.action === MESSAGES.RECORD_STEP) {
    (async () => {
      await ensureStateLoaded();
      
      const { step, sessionId } = message;

      // Ignore if we're not recording
      if (!recordingState.isRecording) {
        console.log('Bug Recorder: Ignoring step - not recording');
        sendResponse({ success: false, reason: 'notRecording' });
        return;
      }

      // Ignore if the sessionId doesn't match the active session
      if (
        sessionId &&
        recordingState.recordingSessionId &&
        sessionId !== recordingState.recordingSessionId
      ) {
        console.log('Bug Recorder: Ignoring step - session mismatch');
        sendResponse({ success: false, reason: 'sessionMismatch' });
        return;
      }

      recordingState.steps.push(step);

      try {
        await chrome.storage.local.set({ steps: recordingState.steps });
        console.log('Bug Recorder: Step saved via background. Total steps:', recordingState.steps.length);
        sendResponse({ success: true, totalSteps: recordingState.steps.length });
      } catch (e) {
        console.error('Bug Recorder: Failed to persist step in storage:', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })().catch((e) => {
      console.error('Bug Recorder: recordStep error:', e);
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  }
});

// ==========================================
// Installation Handler
// ==========================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Bug Recorder: Extension installed/updated, reason:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Bug Recorder: Fresh install, initializing storage');
    await chrome.storage.local.set({
      isRecording: false,
      steps: [],
      settings: DEFAULT_SETTINGS,
      recordingSessionId: null,
      activeSessionDomain: null
    });
  } else if (details.reason === 'update') {
    console.log('Bug Recorder: Extension updated, preserving recording state');
    const existing = await chrome.storage.local.get(['settings', 'isRecording', 'steps']);
    
    const mergedSettings = { ...DEFAULT_SETTINGS, ...(existing.settings || {}) };
    
    await chrome.storage.local.set({
      settings: mergedSettings
    });
    
    if (existing.isRecording) {
      console.warn('Bug Recorder: Extension updated while recording was active. Recording state preserved with', existing.steps?.length || 0, 'steps');
    }
  }
});

// ==========================================
// Initialization
// ==========================================

stateLoadedPromise = loadRecordingState().then(() => {
  console.log('Bug Recorder: Background service worker started. Recording:', recordingState.isRecording, 'Steps:', recordingState.steps.length);
});


