/**
 * Error event listeners for console errors and unhandled rejections
 */

/**
 * Create error listeners
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {Object} Object containing errorListener and rejectionListener
 */
export function createErrorListeners(recordStep, state) {
  function errorListener(e) {
    if (!state.isRecording) return;
    recordStep({
      type: 'error',
      description: `Console Error: ${e.message}`,
      details: { error: e.message, file: e.filename, line: e.lineno }
    });
  }
  
  function rejectionListener(e) {
    if (!state.isRecording) return;
    recordStep({
      type: 'error',
      description: `Unhandled Promise Rejection: ${e.reason}`,
      details: { error: String(e.reason) }
    });
  }
  
  return { errorListener, rejectionListener };
}


