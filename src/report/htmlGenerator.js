/**
 * HTML report generation for bug reports
 */

import { reportStyles } from './styles.js';
import { generateNetworkCard } from './networkCard.js';
import { reportScript } from './reportScript.js';
import { maskStepData } from '../shared/sensitiveDataMasker.js';

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, char => map[char]);
}

/**
 * Generate a complete HTML bug report
 * @param {Array} steps - Array of recorded steps
 * @param {Object} settings - Report settings
 * @returns {string} Complete HTML document
 */
export function generateReport(steps, settings) {
  const timestamp = new Date().toLocaleString();
  const stepTypes = [...new Set(steps.map(s => s.type))];
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Bug Report - ${escapeHtml(timestamp)}</title>
  <style>${reportStyles}</style>
</head>
<body>
  ${generateHeader(timestamp, steps.length)}
  ${generateFilterPanel(stepTypes, steps.length)}
  ${generateSummary(steps.length)}
  ${generateCompactSummary()}
  ${generateStepsHtml(steps, settings)}
  ${generateFooter()}
  <script>${reportScript}</script>
</body>
</html>`;
}

/**
 * Generate report header HTML
 */
function generateHeader(timestamp, stepCount) {
  return `
  <div class="header">
    <h1>🐛 Bug Recreation Report</h1>
    <div class="meta">Generated: ${escapeHtml(timestamp)}</div>
    <div class="meta">Total Steps: ${stepCount}</div>
  </div>`;
}

/**
 * Generate filter panel HTML
 */
function generateFilterPanel(stepTypes, stepCount) {
  return `
  <div class="filter-panel">
    <h3>🔍 Filter Steps</h3>
    <p>Select which step types to display:</p>
    <div class="filter-options">
      ${stepTypes.map(type => `
        <div class="filter-option">
          <input type="checkbox" id="filter-${escapeHtml(type)}" value="${escapeHtml(type)}" checked onchange="filterSteps()">
          <label for="filter-${escapeHtml(type)}">
            <span class="step-type type-${escapeHtml(type)}">${escapeHtml(type.toUpperCase())}</span>
          </label>
        </div>
      `).join('')}
    </div>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
      <div class="filter-option" style="width: 100%;">
        <input type="checkbox" id="filter-screenshots" checked onchange="toggleScreenshots()">
        <label for="filter-screenshots" style="font-weight: 500;">
          📸 Show Screenshots
        </label>
      </div>
      <div class="filter-option" style="width: 100%;">
        <input type="checkbox" id="filter-validation-only" onchange="toggleValidationOnly()">
        <label for="filter-validation-only" style="font-weight: 500;">
          ⚠️ Show Only Validation Errors
        </label>
      </div>
      <div class="filter-option" style="width: 100%;">
        <input type="checkbox" id="filter-api-only" onchange="toggleAPIOnly()">
        <label for="filter-api-only" style="font-weight: 500;">
          🌐 Show Only API Requests
        </label>
      </div>
    </div>
    <div class="filter-buttons">
      <button class="btn-compact" id="compactBtn" onclick="toggleCompactMode()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">🎯 Compact View</button>
    </div>
    <div class="visible-count" id="visibleCount">Showing ${stepCount} of ${stepCount} steps</div>
  </div>`;
}

/**
 * Generate summary section HTML
 */
function generateSummary(stepCount) {
  return `
  <div class="summary">
    <h2>📋 Summary</h2>
    <p>This report contains ${stepCount} recorded steps to recreate the bug.</p>
    <p><strong>Follow these steps in order to reproduce the issue.</strong></p>
  </div>`;
}

/**
 * Generate compact summary placeholder
 */
function generateCompactSummary() {
  return `
  <div class="compact-summary" id="compactSummary">
    <h3>🎯 Compact Mode Active</h3>
    <p id="compactStats"></p>
  </div>`;
}

/**
 * Generate all steps HTML
 */


/**
 * Generate HTML for a standard (non-network) step
 */
function generateStandardStepHtml(step, index, settings, d) {
  const detailsToShow = [];
  
  if (step.type === 'input') {
    if (d.fieldLabel) detailsToShow.push('<strong>Field:</strong> ' + escapeHtml(d.fieldLabel));
    if (d.value !== undefined && d.value !== '') detailsToShow.push('<strong>Value:</strong> ' + escapeHtml(d.value));
    if (d.fieldType && d.fieldType !== 'text') detailsToShow.push('<strong>Type:</strong> ' + escapeHtml(d.fieldType));
    if (d.path) detailsToShow.push('<strong>Path:</strong> <code style="font-size: 11px; background: #2d2d2d; padding: 2px 6px; border-radius: 3px; color: #9cdcfe;">' + escapeHtml(d.path) + '</code>');
  } else if (step.type === 'click') {
    if (d.label) detailsToShow.push('<strong>Element:</strong> ' + escapeHtml(d.label));
    if (d.stepper) detailsToShow.push('<strong>Stepper:</strong> ' + escapeHtml(d.stepper));
    if (d.text && !d.label) detailsToShow.push('<strong>Text:</strong> ' + escapeHtml(d.text));
    if (d.path) detailsToShow.push('<strong>Path:</strong> <code style="font-size: 11px; background: #2d2d2d; padding: 2px 6px; border-radius: 3px; color: #9cdcfe;">' + escapeHtml(d.path) + '</code>');
  } else if (step.type === 'error') {
    if (d.error) detailsToShow.push('<strong>Error:</strong> ' + escapeHtml(d.error));
    if (d.file) detailsToShow.push('<strong>File:</strong> ' + escapeHtml(d.file) + ':' + escapeHtml(d.line || ''));
  } else if (step.type === 'validation') {
    if (d.fieldLabel) detailsToShow.push('<strong>Field:</strong> ' + escapeHtml(d.fieldLabel));
    if (d.status) detailsToShow.push('<strong>Status:</strong> <span style="color: #c62828; font-weight: 700;">❌ Failed</span>');
  }
  
  const stepPriority = step.priority || 'medium';
  return '<div class="step" data-type="' + escapeHtml(step.type) + '" data-step-index="' + index + '" data-priority="' + escapeHtml(stepPriority) + '" data-captured-priority="' + escapeHtml(stepPriority) + '">' +
    '<div class="step-header">' +
      '<div style="display: flex; align-items: center; gap: 10px;">' +
        '<span class="step-number">' + (index + 1) + '</span>' +
        '<span class="step-type type-' + escapeHtml(step.type) + '">' + escapeHtml(step.type.toUpperCase()) + '</span>' +
      '</div>' +
      (settings.includeTimestamps ? '<span class="step-time">' + escapeHtml(new Date(step.timestamp).toLocaleTimeString()) + '</span>' : '') +
    '</div>' +
    '<div class="step-description">' + escapeHtml(step.description) + '</div>' +
    (detailsToShow.length > 0 ? 
      '<div class="step-details">' +
        detailsToShow.map(function(detail) { return '<div>' + detail + '</div>'; }).join('') +
      '</div>'
    : '') +
    (step.screenshot ? '<img src="' + escapeHtml(step.screenshot) + '" class="screenshot" alt="Screenshot" onmouseenter="expandScreenshot(this)" title="Hover to expand, click outside to collapse">' : '') +
  '</div>';
}

/**
 * Generate all steps HTML
 */
function generateStepsHtml(steps, settings) {
  return steps.map((step, index) => {
    const maskedStep = maskStepData(step);
    const d = maskedStep.details || {};
    
    // For network steps, generate the network card
    if (maskedStep.type === 'network') {
      return generateNetworkCard(maskedStep, index, settings, d);
    }
    
    // Build compact details for other types
    return generateStandardStepHtml(maskedStep, index, settings, d);
  }).join('');
}

/**
 * Generate footer HTML
 */
function generateFooter() {
  return `
  <div class="footer">
    <p>Generated by Bug Recorder Extension</p>
    <p>Use this report to help developers recreate and fix the bug</p>
  </div>`;
}

/**
 * Download HTML content as a file
 * @param {string} html - HTML content
 */
export function downloadHTML(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bug-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

