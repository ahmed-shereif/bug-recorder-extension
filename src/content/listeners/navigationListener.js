/**
 * Navigation listener for URL changes
 */

/**
 * Create a navigation listener using MutationObserver
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {MutationObserver} Navigation observer
 */
export function createNavigationListener(recordStep, state) {
  let lastUrl = location.href;
  
  const observer = new MutationObserver(() => {
    if (!state.isRecording) return;
    
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      recordStep({
        type: 'navigation',
        description: `Navigated to ${location.pathname}`,
        url: location.href
      });
    }
  });
  
  return observer;
}

/**
 * Start observing for navigation changes
 * @param {MutationObserver} observer - Navigation observer
 */
export function startNavigationObserver(observer) {
  observer.observe(document, { subtree: true, childList: true });
}

/**
 * Stop observing for navigation changes
 * @param {MutationObserver} observer - Navigation observer
 */
export function stopNavigationObserver(observer) {
  if (observer) {
    observer.disconnect();
  }
}


