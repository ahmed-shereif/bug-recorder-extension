/**
 * Scroll event listener
 */

/**
 * Create a scroll listener with debouncing
 * @param {Function} recordStep - Function to record a step
 * @param {Object} state - Shared state object
 * @returns {Function} Scroll event handler
 */
export function createScrollListener(recordStep, state) {
  let scrollTimeout;
  
  return function handleScroll() {
    if (!state.isRecording) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      recordStep({
        type: 'scroll',
        description: `Scrolled to position (${window.scrollX}, ${window.scrollY})`,
        details: { x: window.scrollX, y: window.scrollY }
      });
    }, 500);
  };
}


