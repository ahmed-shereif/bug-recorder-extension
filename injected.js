// This script runs in the PAGE context (not content script isolated world)
// It intercepts fetch and XMLHttpRequest and sends data back via custom events

(function() {
  'use strict';
  
  // Check if already injected - if so, just update the listener
  if (window.__bugRecorderInjected) {
    console.log('Bug Recorder [Page]: Already injected, skipping re-injection');
    return;
  }
  window.__bugRecorderInjected = true;
  
  let isRecording = false;
  let captureNetwork = false;
  let recordingSessionId = null;
  
  // Listen for messages from content script
  window.addEventListener('__bugRecorder_control', (e) => {
    const { action, settings, sessionId } = e.detail || {};
    if (action === 'startRecording') {
      isRecording = true;
      captureNetwork = settings?.captureNetwork ?? true;
      recordingSessionId = sessionId || Date.now();
      console.log('Bug Recorder [Page]: Network capture started (session:', recordingSessionId, ')');
    } else if (action === 'stopRecording') {
      isRecording = false;
      recordingSessionId = null;
      console.log('Bug Recorder [Page]: Network capture stopped');
    }
  });
  
  // Send network data to content script
  function sendNetworkEvent(data) {
    window.dispatchEvent(new CustomEvent('__bugRecorder_network', {
      detail: data
    }));
  }
  
  // Check if this looks like an API request
  function isAPIRequest(url, options) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    
    // Skip static assets
    if (urlStr.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|ico|map|html)(\?|$)/i)) {
      return false;
    }
    
    // Skip chrome/browser internal URLs
    if (urlStr.startsWith('chrome') || urlStr.startsWith('moz-extension') || urlStr.startsWith('about:')) {
      return false;
    }
    
    // Skip data URLs
    if (urlStr.startsWith('data:')) {
      return false;
    }
    
    // Check headers for JSON
    const headers = options?.headers || {};
    const contentType = headers['Content-Type'] || headers['content-type'] || '';
    const accept = headers['Accept'] || headers['accept'] || '';
    
    if (contentType.includes('application/json') || accept.includes('application/json')) {
      return true;
    }
    
    // Capture common API patterns
    if (urlStr.includes('/api/') || urlStr.includes('/graphql') || urlStr.includes('/rest/')) {
      return true;
    }
    
    // Capture non-GET methods (usually API calls)
    if (options?.method && options.method.toUpperCase() !== 'GET') {
      return true;
    }
    
    // Capture versioned endpoints
    if (urlStr.match(/\/(v\d+|data|service|endpoint|backend|services)/i)) {
      return true;
    }
    
    // Capture if URL ends without extension (likely API)
    const pathname = new URL(urlStr, window.location.origin).pathname;
    if (!pathname.match(/\.\w{2,5}$/)) {
      // No file extension - could be API
      // Additional check: has query params or path segments
      if (urlStr.includes('?') || pathname.split('/').length > 2) {
        return true;
      }
    }
    
    return false;
  }
  
  function tryParseJSON(str) {
    if (!str) return null;
    if (typeof str !== 'string') {
      try {
        return JSON.parse(JSON.stringify(str));
      } catch (e) {
        return String(str);
      }
    }
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }
  
  // Format data as JSON string (no truncation - full data for debugging)
  function formatData(data) {
    if (!data) return null;
    if (typeof data === 'string') {
      // Try to parse and re-stringify for consistent formatting
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }
  
  function getPathFromURL(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname + urlObj.search;
    } catch (e) {
      return url;
    }
  }
  
  // ========== INTERCEPT FETCH ==========
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    // Always call original if not recording
    if (!isRecording || !captureNetwork) {
      return originalFetch.apply(this, args);
    }
    
    const [input, options = {}] = args;
    const url = typeof input === 'string' ? input : (input.url || input.toString());
    const method = options.method || (input.method) || 'GET';
    
    // Skip non-API requests
    if (!isAPIRequest(url, options)) {
      return originalFetch.apply(this, args);
    }
    
    console.log('Bug Recorder [Page]: Intercepted fetch', method, url);
    
    const startTime = Date.now();
    let requestBody = null;
    
    try {
      requestBody = options.body ? tryParseJSON(options.body) : null;
    } catch (e) {
      requestBody = '[Unable to parse body]';
    }
    
    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Clone to read body without consuming
      const clonedResponse = response.clone();
      let responseData = null;
      
      try {
        const text = await clonedResponse.text();
        responseData = tryParseJSON(text);
      } catch (e) {
        responseData = '[Unable to read response]';
      }
      
      sendNetworkEvent({
        type: 'fetch',
        method: method.toUpperCase(),
        url: url,
        path: getPathFromURL(url),
        status: response.status,
        statusText: response.statusText,
        duration: duration,
        requestBody: formatData(requestBody),
        responseBody: formatData(responseData),
        success: response.ok,
        timestamp: Date.now()
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      sendNetworkEvent({
        type: 'fetch',
        method: method.toUpperCase(),
        url: url,
        path: getPathFromURL(url),
        status: 0,
        statusText: 'Network Error',
        duration: duration,
        requestBody: formatData(requestBody),
        responseBody: null,
        errorMessage: error.message,
        success: false,
        timestamp: Date.now()
      });
      
      throw error;
    }
  };
  
  // ========== INTERCEPT XMLHttpRequest ==========
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._bugRecorder = {
      method: method,
      url: url,
      headers: {},
      startTime: null
    };
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._bugRecorder) {
      this._bugRecorder.headers[name] = value;
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (!isRecording || !captureNetwork || !this._bugRecorder) {
      return originalXHRSend.apply(this, arguments);
    }
    
    const { method, url, headers } = this._bugRecorder;
    
    // Skip non-API requests
    if (!isAPIRequest(url, { method, headers })) {
      return originalXHRSend.apply(this, arguments);
    }
    
    console.log('Bug Recorder [Page]: Intercepted XHR', method, url);
    
    this._bugRecorder.startTime = Date.now();
    this._bugRecorder.requestBody = body ? tryParseJSON(body) : null;
    
    const xhr = this;
    
    this.addEventListener('load', function() {
      const duration = Date.now() - xhr._bugRecorder.startTime;
      let responseData = null;
      
      try {
        responseData = tryParseJSON(xhr.responseText);
      } catch (e) {
        responseData = '[Unable to read response]';
      }
      
      sendNetworkEvent({
        type: 'xhr',
        method: method.toUpperCase(),
        url: url,
        path: getPathFromURL(url),
        status: xhr.status,
        statusText: xhr.statusText,
        duration: duration,
        requestBody: formatData(xhr._bugRecorder.requestBody),
        responseBody: formatData(responseData),
        success: xhr.status >= 200 && xhr.status < 300,
        timestamp: Date.now()
      });
    });
    
    this.addEventListener('error', function() {
      const duration = Date.now() - xhr._bugRecorder.startTime;
      
      sendNetworkEvent({
        type: 'xhr',
        method: method.toUpperCase(),
        url: url,
        path: getPathFromURL(url),
        status: 0,
        statusText: 'Network Error',
        duration: duration,
        requestBody: formatData(xhr._bugRecorder.requestBody),
        responseBody: null,
        errorMessage: 'XHR request failed',
        success: false,
        timestamp: Date.now()
      });
    });
    
    this.addEventListener('timeout', function() {
      const duration = Date.now() - xhr._bugRecorder.startTime;
      
      sendNetworkEvent({
        type: 'xhr',
        method: method.toUpperCase(),
        url: url,
        path: getPathFromURL(url),
        status: 0,
        statusText: 'Timeout',
        duration: duration,
        requestBody: formatData(xhr._bugRecorder.requestBody),
        responseBody: null,
        errorMessage: 'Request timed out',
        success: false,
        timestamp: Date.now()
      });
    });
    
    return originalXHRSend.apply(this, arguments);
  };
  
  console.log('Bug Recorder [Page]: Network interceptors installed');
})();

