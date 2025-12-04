/**
 * Shared utility functions for the Bug Recorder extension
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape JSON for embedding in HTML script tags
 * @param {*} data - Data to escape
 * @returns {string|null} Escaped JSON string
 */
export function escapeJsonForHtml(data) {
  if (!data) return null;
  let jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  return jsonStr
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Format data as JSON string with consistent formatting
 * @param {*} data - Data to format
 * @returns {string|null} Formatted JSON string
 */
export function formatData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return data;
    }
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Extract pathname from URL
 * @param {string} url - URL to parse
 * @param {string} origin - Origin for relative URLs
 * @returns {string} Path from URL
 */
export function getPathFromURL(url, origin = null) {
  try {
    const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const urlObj = new URL(url, base);
    return urlObj.pathname;
  } catch (e) {
    return url;
  }
}

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Beautify JSON for text output
 * @param {*} data - Data to beautify
 * @returns {string} Beautified JSON string
 */
export function beautifyJson(data) {
  if (!data) return '';
  
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return data;
    }
  }
  
  return JSON.stringify(data, null, 2);
}


