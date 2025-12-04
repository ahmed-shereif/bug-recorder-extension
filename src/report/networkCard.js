/**
 * Network card HTML generation for bug reports
 */

import { escapeHtml, escapeJsonForHtml } from '../shared/utils.js';
import { maskSensitiveData } from '../shared/sensitiveDataMasker.js';

/**
 * Generate HTML for a network request step card
 * @param {Object} step - The step object
 * @param {number} index - Step index
 * @param {Object} settings - Report settings
 * @param {Object} d - Step details
 * @returns {string} HTML string for the network card
 */
export function generateNetworkCard(step, index, settings, d) {
  const method = d.method || 'GET';
  const methodClass = `method-${method.toLowerCase()}`;
  const statusClass = d.isFailed ? 'status-error' : d.isSlow ? 'status-warning' : 'status-success';
  const networkClass = d.isFailed ? 'failed' : d.isSlow ? 'slow' : '';
  
  // Parse URL to get path
  let urlPath = d.url || '';
  try {
    const urlObj = new URL(d.url);
    urlPath = urlObj.pathname + urlObj.search;
  } catch (e) {}
  
  // Prepare JSON data for the viewer (with sensitive data masked)
  const requestData = d.requestBody ? escapeJsonForHtml(maskSensitiveData(d.requestBody)) : null;
  const responseData = d.responseBody ? escapeJsonForHtml(maskSensitiveData(d.responseBody)) : null;
  
  // Generate unique ID for this network card
  const cardId = `network-${index}`;
  
  // Build field mappings HTML (with sensitive data masked)
  let fieldMappingsHtml = '';
  if (d.fieldMappings && d.fieldMappings.length > 0) {
    const maskedMappings = d.fieldMappings.map(m => ({
      ...m,
      value: maskSensitiveData(m.value, m.propPath)
    }));
    fieldMappingsHtml = `
      <div class="field-mapping">
        <div class="field-mapping-title">📊 Field Mappings (Input → API)</div>
        ${maskedMappings.map(m => `
          <div class="field-mapping-item">
            <span class="field-mapping-prop">${escapeHtml(m.propPath)}</span>
            <span>:</span>
            <span class="field-mapping-value">"${escapeHtml(String(m.value))}"</span>
            <span>←</span>
            <span class="field-mapping-source">${escapeHtml(m.sourceField)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  const stepPriority = step.priority || (d.isFailed ? 'critical' : d.isSlow ? 'high' : 'medium');
  return `
    <div class="step" data-type="network" data-step-index="${index}" data-priority="${stepPriority}" data-captured-priority="${stepPriority}">
      <div class="step-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="step-number">${index + 1}</span>
          <span class="step-type type-network ${networkClass}">NETWORK</span>
        </div>
        ${settings.includeTimestamps ? `<span class="step-time">${new Date(step.timestamp).toLocaleTimeString()}</span>` : ''}
      </div>
      
      ${d.triggeredBy ? `<div style="font-size: 12px; color: #718096; margin-bottom: 8px;">🖱️ Triggered by: ${escapeHtml(d.triggeredBy)}</div>` : ''}
      
      <div class="network-card">
        <div class="network-card-header">
          <span class="network-method ${methodClass}">${method}</span>
          <span class="network-url">${escapeHtml(urlPath)}</span>
          <div class="network-status">
            <span class="status-code ${statusClass}">${d.status || '—'} ${d.statusText || ''}</span>
            <span class="network-duration">${d.duration ? `${(d.duration/1000).toFixed(2)}s` : '—'}</span>
          </div>
        </div>
        
        <div class="network-tabs">
          <div class="network-tab active" onclick="switchNetworkTab(this, '${cardId}', 'info')">Overview</div>
          ${requestData ? `<div class="network-tab" onclick="switchNetworkTab(this, '${cardId}', 'request')">Request</div>` : ''}
          ${responseData ? `<div class="network-tab" onclick="switchNetworkTab(this, '${cardId}', 'response')">Response</div>` : ''}
        </div>
        
        <div class="network-search">
          <input type="text" class="network-search-input" id="${cardId}-search" placeholder="🔍 Search in request/response..." oninput="searchInNetworkCard('${cardId}', this.value)">
          <span class="network-search-results" id="${cardId}-search-results"></span>
          <button class="network-search-nav" id="${cardId}-search-prev" onclick="searchPrev('${cardId}')" style="display: none;" title="Previous match">▲</button>
          <button class="network-search-nav" id="${cardId}-search-next" onclick="searchNext('${cardId}')" style="display: none;" title="Next match">▼</button>
          <button class="network-search-clear" id="${cardId}-search-clear" onclick="clearNetworkSearch('${cardId}')" style="display: none;">✕</button>
        </div>
        
        <!-- Overview Tab -->
        <div id="${cardId}-info" class="network-content active">
          <div class="network-info-panel">
            <div class="network-info-row">
              <span class="network-info-label">Request URL</span>
              <span class="network-info-value">${escapeHtml(d.url || '—')}</span>
            </div>
            <div class="network-info-row">
              <span class="network-info-label">Request Method</span>
              <span class="network-info-value">${method}</span>
            </div>
            <div class="network-info-row">
              <span class="network-info-label">Status Code</span>
              <span class="network-info-value ${d.isFailed ? 'error' : 'success'}">${d.status || '—'} ${d.statusText || ''}</span>
            </div>
            <div class="network-info-row">
              <span class="network-info-label">Duration</span>
              <span class="network-info-value">${d.duration ? `${d.duration}ms (${(d.duration/1000).toFixed(2)}s)` : '—'}</span>
            </div>
            ${d.errorMessage ? `
              <div class="network-info-row">
                <span class="network-info-label">Error Message</span>
                <span class="network-info-value error">${escapeHtml(d.errorMessage)}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${requestData ? `
          <!-- Request Tab -->
          <div id="${cardId}-request" class="network-content">
            <div class="json-actions">
              <button class="json-action-btn" onclick="copyJsonToClipboard('${cardId}-request-data')">📋 Copy</button>
              <button class="json-action-btn" onclick="expandAllJson('${cardId}-request-tree')">➕ Expand All</button>
              <button class="json-action-btn" onclick="collapseAllJson('${cardId}-request-tree')">➖ Collapse All</button>
              <button class="json-action-btn" onclick="toggleRawJson('${cardId}-request')">📄 Raw JSON</button>
            </div>
            <div class="json-tree" id="${cardId}-request-tree"></div>
            <div class="raw-json-view" id="${cardId}-request-raw"></div>
            <script type="application/json" id="${cardId}-request-data">${requestData}</script>
          </div>
        ` : ''}
        
        ${responseData ? `
          <!-- Response Tab -->
          <div id="${cardId}-response" class="network-content">
            <div class="json-actions">
              <button class="json-action-btn" onclick="copyJsonToClipboard('${cardId}-response-data')">📋 Copy</button>
              <button class="json-action-btn" onclick="expandAllJson('${cardId}-response-tree')">➕ Expand All</button>
              <button class="json-action-btn" onclick="collapseAllJson('${cardId}-response-tree')">➖ Collapse All</button>
              <button class="json-action-btn" onclick="toggleRawJson('${cardId}-response')">📄 Raw JSON</button>
            </div>
            <div class="json-tree" id="${cardId}-response-tree"></div>
            <div class="raw-json-view" id="${cardId}-response-raw"></div>
            <script type="application/json" id="${cardId}-response-data">${responseData}</script>
          </div>
        ` : ''}
      </div>
      
      ${fieldMappingsHtml}
      
      ${step.screenshot ? `<img src="${step.screenshot}" class="screenshot" alt="Screenshot" onmouseenter="expandScreenshot(this)" title="Hover to expand, click outside to collapse">` : ''}
    </div>
  `;
}

