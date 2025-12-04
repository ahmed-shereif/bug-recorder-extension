/**
 * Shared constants for the Bug Recorder extension
 */

export const STEP_TYPES = {
  CLICK: 'click',
  INPUT: 'input',
  NAVIGATION: 'navigation',
  SCROLL: 'scroll',
  ERROR: 'error',
  VALIDATION: 'validation',
  NETWORK: 'network'
};

export const PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export const MESSAGES = {
  START_RECORDING: 'startRecording',
  STOP_RECORDING: 'stopRecording',
  START_SESSION: 'startSession',
  STOP_SESSION: 'stopSession',
  RECORD_STEP: 'recordStep',
  CAPTURE_SCREENSHOT: 'captureScreenshot',
  GET_STATUS: 'getStatus'
};

export const TIMEOUTS = {
  SCREENSHOT: 3000,
  INPUT_DEBOUNCE: 1000,
  VALIDATION_WINDOW: 2000,
  DUPLICATE_CLICK: 1000,
  DUPLICATE_STEP: 5000,
  NETWORK_SLOW: 2000,
  RECENT_INPUT_MAX_AGE: 30000,
  API_CORRELATION_WINDOW: 2000,
  CLICK_TRACKING_MAX_AGE: 5000
};

export const DEFAULT_SETTINGS = {
  captureClicks: true,
  captureInputs: true,
  captureNavigation: true,
  captureScroll: false,
  captureErrors: false,
  captureValidation: true,
  captureNetwork: false,
  includeTimestamps: true,
  includeUrls: true,
  includeScreenshots: true,
  screenshotQuality: 25
};


