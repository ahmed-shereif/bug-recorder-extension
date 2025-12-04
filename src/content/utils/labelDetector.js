/**
 * Label detection utilities for form elements
 */

/**
 * Get the label for an element using multiple detection strategies
 * @param {Element} element - DOM element
 * @returns {string|null} Label text or null
 */
export function getLabel(element) {
  // 1. Try aria-label first (most explicit)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && !ariaLabel.startsWith('mat-') && isUsefulLabel(ariaLabel)) return ariaLabel;
  
  // 2. Try label[for] (standard HTML)
  if (element.id && !element.id.startsWith('mat-')) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      const text = cleanText(label.textContent);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 3. Try aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl) {
      const text = cleanText(labelEl.textContent);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 4. For buttons, check buttonText attribute or text content
  if (element.tagName === 'BUTTON' || element.closest('button')) {
    const btn = element.tagName === 'BUTTON' ? element : element.closest('button');
    const btnText = btn.querySelector('.btn-text')?.textContent || btn.textContent;
    if (btnText && !btnText.startsWith('mat-')) {
      const text = cleanText(btnText);
      if (isUsefulLabel(text)) return text;
    }
  }
  
  // 5. Check element's own data attributes
  const dataLabel = element.getAttribute('data-label') || 
                    element.getAttribute('data-field') || 
                    element.getAttribute('data-name') ||
                    element.getAttribute('data-testid') ||
                    element.getAttribute('formcontrolname');
  if (dataLabel && isUsefulLabel(dataLabel)) {
    return formatAttributeName(dataLabel);
  }
  
  // 6. Search up DOM extensively for labels (up to 15 levels)
  let current = element;
  let depth = 0;
  const maxDepth = 15;
  
  while (current && depth < maxDepth) {
    // Check for .label div (custom pattern)
    const labelDiv = current.querySelector('.label > .input-label, .label > mat-label, .field-label, .form-label');
    if (labelDiv && !labelDiv.contains(element)) {
      const text = cleanText(labelDiv.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for mat-label in parent
    const matLabel = current.querySelector('mat-label:not(.date-container__lbl_month):not(.date-container__lbl_day)');
    if (matLabel && !matLabel.contains(element)) {
      const text = cleanText(matLabel.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for label elements
    const labels = current.querySelectorAll('label.input-label, label.checkbox__label, label:not([for])');
    for (const label of labels) {
      if (!label.contains(element) && label.textContent.trim()) {
        const text = cleanText(label.textContent);
        if (isUsefulLabel(text)) return text;
      }
    }
    
    // Check for legend (in fieldset)
    const legend = current.querySelector('legend');
    if (legend && !legend.contains(element)) {
      const text = cleanText(legend.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for heading elements that might be section titles
    const heading = current.querySelector('h1, h2, h3, h4, h5, h6, .section-title, .card-title, .panel-title, .header-title');
    if (heading && !heading.contains(element)) {
      const text = cleanText(heading.textContent);
      if (isUsefulLabel(text)) return text;
    }
    
    // Check for span/div with label-like classes
    const labelLike = current.querySelector('.label, .field-name, .input-title, .control-label, [class*="label"]:not(input):not(select):not(textarea)');
    if (labelLike && !labelLike.contains(element) && labelLike.tagName !== 'INPUT') {
      const text = cleanText(labelLike.textContent);
      if (isUsefulLabel(text) && text.length < 50) return text;
    }
    
    // Check for data attributes on parent containers
    const parentDataLabel = current.getAttribute('data-label') || 
                            current.getAttribute('data-field') ||
                            current.getAttribute('data-name') ||
                            current.getAttribute('aria-label');
    if (parentDataLabel && isUsefulLabel(parentDataLabel)) {
      return formatAttributeName(parentDataLabel);
    }
    
    // Check for title attribute
    const title = current.getAttribute('title');
    if (title && isUsefulLabel(title)) return title;
    
    // Check previous sibling for label text
    const prevSibling = current.previousElementSibling;
    if (prevSibling) {
      const siblingTag = prevSibling.tagName?.toLowerCase();
      if (siblingTag === 'label' || siblingTag === 'span' || siblingTag === 'div') {
        const text = cleanText(prevSibling.textContent);
        if (isUsefulLabel(text) && text.length < 50) return text;
      }
    }
    
    current = current.parentElement;
    depth++;
  }
  
  // 7. Try placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && isUsefulLabel(placeholder)) return placeholder;
  
  // 8. Try name attribute (clean it up)
  const name = element.getAttribute('name');
  if (name && !name.startsWith('mat-') && isUsefulLabel(name)) {
    return formatAttributeName(name);
  }
  
  // 9. Try id attribute as last resort
  const id = element.getAttribute('id');
  if (id && !id.startsWith('mat-') && isUsefulLabel(id)) {
    return formatAttributeName(id);
  }
  
  // 10. Try formControlName (Angular)
  const formControlName = element.getAttribute('formcontrolname') || element.getAttribute('ng-model');
  if (formControlName && isUsefulLabel(formControlName)) {
    return formatAttributeName(formControlName);
  }
  
  return null;
}

/**
 * Check if a label text is useful (not just noise)
 * @param {string} text - Label text
 * @returns {boolean} True if useful
 */
export function isUsefulLabel(text) {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 2 || cleaned.length > 100) return false;
  
  // Skip generic/noise labels
  const noisePatterns = [
    /^(day|month|year|type|number|dd|mm|yyyy|select|choose|enter|input)$/i,
    /^mat-/i,
    /^ng-/i,
    /^input\d*$/i,
    /^field\d*$/i,
    /^\d+$/,
    /^[a-z]$/i,
    /^(true|false|null|undefined)$/i
  ];
  
  for (const pattern of noisePatterns) {
    if (pattern.test(cleaned)) return false;
  }
  
  return true;
}

/**
 * Format attribute names (camelCase, snake_case, kebab-case) to readable text
 * @param {string} name - Attribute name
 * @returns {string|null} Formatted name
 */
export function formatAttributeName(name) {
  if (!name) return null;
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean text for display
 * @param {string} text - Raw text
 * @returns {string|null} Cleaned text
 */
export function cleanText(text) {
  if (!text) return null;
  return text.trim().replace(/\s+/g, ' ').replace(/[*:()]/g, '').replace(/\s+optional\s*/gi, '').trim();
}

/**
 * Get stepper label if element is inside a stepper
 * @param {Element} element - DOM element
 * @returns {string|null} Stepper label or null
 */
export function getStepperLabel(element) {
  const stepper = element.closest('mat-step, .mat-step');
  if (stepper) {
    const label = stepper.querySelector('mat-step-label, .mat-step-label');
    if (label) return label.textContent.trim();
  }
  return null;
}

/**
 * Check if an element is an action button (submit, save, etc.)
 * @param {Element} element - DOM element
 * @param {string} text - Button text
 * @param {string} buttonType - Button type attribute
 * @returns {boolean} True if action button
 */
export function isActionButton(element, text, buttonType) {
  const textLower = (text || '').toLowerCase();
  const buttonTypeLower = (buttonType || '').toLowerCase();
  
  // Check button type
  if (buttonTypeLower === 'submit') return true;
  
  // Check button text for common action words
  const actionWords = ['submit', 'save', 'next', 'continue', 'confirm', 'send', 'create', 'update', 'delete', 'release', 'approve', 'reject'];
  if (actionWords.some(word => textLower.includes(word))) return true;
  
  // Check if it's a form submit button
  const form = element.closest('form');
  if (form && element.tagName.toLowerCase() === 'button') return true;
  
  return false;
}


