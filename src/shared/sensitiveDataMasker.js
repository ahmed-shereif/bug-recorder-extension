/**
 * Sensitive data masking utilities
 */

const SENSITIVE_PATTERNS = {
  password: /password|passwd|pwd|pass/i,
  apiKey: /api[_-]?key|apikey|secret|api[_-]?secret/i,
  creditCard: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/
};

function isSensitiveField(fieldName) {
  if (!fieldName) return false;
  return Object.values(SENSITIVE_PATTERNS).some(pattern => pattern.test(fieldName));
}

function isSensitiveValue(value) {
  if (!value || typeof value !== 'string') return false;
  return Object.values(SENSITIVE_PATTERNS).some(pattern => pattern.test(value));
}

function maskValue(value) {
  if (!value || typeof value !== 'string') return value;
  
  const length = value.length;
  if (length <= 4) return '****';
  
  // Credit card: show last 4
  if (SENSITIVE_PATTERNS.creditCard.test(value)) {
    return '**** **** **** ' + value.replace(/\D/g, '').slice(-4);
  }
  
  // Default: first 4 + last 4
  return value.substring(0, 4) + '...' + value.substring(length - 4);
}

export function maskSensitiveData(data, fieldName = '') {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    if (isSensitiveField(fieldName) || isSensitiveValue(data)) {
      return maskValue(data);
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, fieldName));
  }
  
  if (typeof data === 'object') {
    const masked = {};
    for (const [key, value] of Object.entries(data)) {
      masked[key] = maskSensitiveData(value, key);
    }
    return masked;
  }
  
  return data;
}

export function maskStepData(step) {
  if (!step) return step;
  
  const masked = { ...step };
  
  if (masked.details) {
    // Check if this is a password field
    if (masked.details.fieldType === 'password' && masked.details.value) {
      masked.details = { ...masked.details, value: '••••••••' };
    } else {
      masked.details = maskSensitiveData(masked.details);
    }
  }
  
  return masked;
}
