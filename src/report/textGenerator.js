/**
 * Text report generation for clipboard export
 */

import { beautifyJson } from '../shared/utils.js';
import { maskStepData } from '../shared/sensitiveDataMasker.js';

/**
 * Generate a plain text report for clipboard
 * @param {Array} steps - Array of recorded steps
 * @param {Object} settings - Report settings
 * @returns {string} Plain text report
 */
export function generateTextReport(steps, settings) {
  const timestamp = new Date().toLocaleString();
  let text = `BUG RECREATION REPORT\n`;
  text += `Generated: ${timestamp}\n`;
  text += `Total Steps: ${steps.length}\n`;
  text += `${'='.repeat(60)}\n\n`;
  
  steps.forEach((step, index) => {
    const maskedStep = maskStepData(step);
    text += `STEP ${index + 1}: ${maskedStep.type.toUpperCase()}\n`;
    if (settings.includeTimestamps) {
      text += `Time: ${new Date(maskedStep.timestamp).toLocaleTimeString()}\n`;
    }
    text += `Description: ${maskedStep.description}\n`;
    if (maskedStep.details) {
      if (maskedStep.details.fieldLabel) text += `Field: ${maskedStep.details.fieldLabel}\n`;
      if (maskedStep.details.label) text += `Element: ${maskedStep.details.label}\n`;
      if (maskedStep.details.stepper) text += `Stepper: ${maskedStep.details.stepper}\n`;
      if (maskedStep.details.value !== undefined) text += `Value: ${maskedStep.details.value}\n`;
      if (maskedStep.details.text && !maskedStep.details.label) text += `Text: ${maskedStep.details.text}\n`;
      if (maskedStep.details.error) text += `Error: ${maskedStep.details.error}\n`;
      if (maskedStep.details.validationMessage) text += `Validation: ${maskedStep.details.validationMessage}\n`;
      if (maskedStep.details.method) text += `Method: ${maskedStep.details.method}\n`;
      if (maskedStep.details.status) text += `Status: ${maskedStep.details.status}\n`;
      if (maskedStep.details.duration) text += `Duration: ${maskedStep.details.duration}ms\n`;
      if (settings.includeUrls && maskedStep.url) text += `URL: ${maskedStep.url}\n`;
      
      // Include full request body for network requests (beautified JSON)
      if (maskedStep.details.requestBody) {
        text += `\nRequest Body:\n`;
        text += beautifyJson(maskedStep.details.requestBody);
        text += `\n`;
      }
      
      // Include full response body for network requests (beautified JSON)
      if (maskedStep.details.responseBody) {
        text += `\nResponse Body:\n`;
        text += beautifyJson(maskedStep.details.responseBody);
        text += `\n`;
      }
      
      // Include error message if present
      if (maskedStep.details.errorMessage) {
        text += `Error Message: ${maskedStep.details.errorMessage}\n`;
      }
      
      // Include field mappings for network requests
      if (maskedStep.details.fieldMappings && maskedStep.details.fieldMappings.length > 0) {
        text += `Field Mapping:\n`;
        maskedStep.details.fieldMappings.forEach(m => {
          text += `  - ${m.propPath}: "${m.value}" <- from "${m.sourceField}"\n`;
        });
      }
    }
    text += `${'-'.repeat(60)}\n\n`;
  });
  
  return text;
}


