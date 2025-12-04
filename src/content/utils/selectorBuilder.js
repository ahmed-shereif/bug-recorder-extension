/**
 * DOM selector and path building utilities
 */

/**
 * Get a CSS selector for an element
 * @param {Element} element - DOM element
 * @returns {string} CSS selector
 */
export function getSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c && !c.startsWith('ng-') && !c.startsWith('mat-'));
    if (classes.length) return `.${classes[0]}`;
  }
  
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }
    path.unshift(selector);
    current = current.parentElement;
    if (path.length > 3) break;
  }
  return path.join(' > ');
}

/**
 * Generate a DOM breadcrumb path up to 10 levels with actual text values
 * @param {Element} element - DOM element
 * @returns {string} Breadcrumb path
 */
export function getDomBreadcrumb(element) {
  const breadcrumb = [];
  let current = element;
  let level = 0;
  
  while (current && current !== document.body && current !== document.documentElement && level < 10) {
    const text = getActualText(current);
    
    // Only add if there's actual text, skip empty elements
    if (text) {
      // Avoid duplicates
      if (breadcrumb.length === 0 || breadcrumb[0] !== text) {
        breadcrumb.unshift(text);
      }
    }
    
    current = current.parentElement;
    level++;
  }
  
  return breadcrumb.join(' > ');
}

/**
 * Get actual visible text from an element - no fallbacks to element names
 * @param {Element} element - DOM element
 * @returns {string|null} Visible text or null
 */
export function getActualText(element) {
  // 1. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length >= 2 && ariaLabel.length <= 50) {
    return ariaLabel.trim();
  }
  
  // 2. placeholder (for inputs)
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.trim().length >= 2 && placeholder.length <= 50) {
    return placeholder.trim();
  }
  
  // 3. Associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      const labelText = label.textContent?.trim();
      if (labelText && labelText.length >= 2 && labelText.length <= 50) {
        return labelText;
      }
    }
  }
  
  // 4. Direct text content only (not from child elements)
  let directText = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent;
    }
  }
  directText = directText.trim();
  if (directText.length >= 2 && directText.length <= 50) {
    return directText;
  }
  
  return null;
}


