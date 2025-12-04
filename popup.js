let isRecording = false;
let currentSessionId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const state = await chrome.storage.local.get([
    'isRecording',
    'steps',
    'settings',
    'recordingSessionId',
    'activeSessionDomain'
  ]);
  isRecording = state.isRecording || false;
  currentSessionId = state.recordingSessionId || null;
  updateUI();
  updateStepCount(state.steps?.length || 0);
  
  if (state.settings) {
    Object.keys(state.settings).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = state.settings[key];
        } else if (el.tagName === 'SELECT') {
          el.value = state.settings[key];
        }
      }
    });
  }
  
  // Verify recording state with content script if recording is active
  if (isRecording) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (response && !response.isRecording) {
        // Content script is not recording, sync the state
        console.log('Popup: Syncing state - content script not recording');
        isRecording = false;
        await chrome.storage.local.set({ isRecording: false });
        updateUI();
      }
    } catch (e) {
      // Content script not available, might need to inject
      console.log('Popup: Could not verify recording state with content script');
    }
  }
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const settings = getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    alert('Unable to determine current tab URL. Please try again.');
    return;
  }

  let domain;
  try {
    const url = new URL(tab.url);
    domain = url.hostname;
  } catch (e) {
    console.error('Popup: Failed to parse tab URL for domain:', tab.url, e);
    alert('Unable to start recording on this page.');
    return;
  }

  console.log('Starting recording for domain:', domain, 'with settings:', settings);

  // Ask background to start or join a domain-scoped session
  let sessionId;
  let isNewSession = true;
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startSession',
      domain,
      settings
    });
    if (!response || !response.success) {
      console.error('Popup: Failed to start session via background:', response);
      alert('Could not start recording. Please try again.');
      return;
    }
    sessionId = response.sessionId;
    isNewSession = !!response.isNewSession;
    console.log(
      'Popup: Session established. Domain:',
      response.domain,
      'session:',
      sessionId,
      'isNewSession:',
      isNewSession
    );
  } catch (e) {
    console.error('Popup: Error starting session via background:', e);
    alert('Could not start recording. Please try again.');
    return;
  }
  
  currentSessionId = sessionId;
  // For a brand-new session, reset visible step count immediately
  if (isNewSession) {
    updateStepCount(0);
  }
  
  // First, try to send message to content script
  let messageSent = false;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'startRecording', settings, sessionId, isNewSession });
    messageSent = true;
    console.log('Start message sent to tab');
  } catch (error) {
    console.error('Error sending message:', error);
    // Try injecting content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      // Wait a moment for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      // Try again after injection
      await chrome.tabs.sendMessage(tab.id, { action: 'startRecording', settings, sessionId, isNewSession });
      messageSent = true;
    } catch (injectError) {
      console.error('Error injecting script:', injectError);
      alert('Please refresh the page and try again');
      return;
    }
  }
  
  // Only update storage after successfully sending message to content script
  if (messageSent) {
    isRecording = true;
    updateUI();
  }
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  console.log('Stopping recording');
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // First send stop message to content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' });
    console.log('Stop message sent to tab');
  } catch (error) {
    console.error('Error sending stop message:', error);
  }
  
  // Wait a moment for any pending steps to be saved
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Then notify background to stop the current session (for this domain)
  try {
    await chrome.runtime.sendMessage({ action: 'stopSession' });
  } catch (e) {
    console.error('Popup: Error notifying background to stop session:', e);
  }
  
  isRecording = false;
  currentSessionId = null;
  updateUI();
  
  // Show step count
  const { steps } = await chrome.storage.local.get(['steps']);
  updateStepCount(steps?.length || 0);
  console.log('Recording stopped. Total steps:', steps?.length || 0);
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const { steps, settings, isRecording } = await chrome.storage.local.get(['steps', 'settings', 'isRecording']);
  console.log('Export clicked - Recording:', isRecording, 'Steps:', steps?.length || 0);
  console.log('Steps data:', steps);
  
  if (!steps || steps.length === 0) {
    alert('No steps recorded yet. Start recording and perform some actions first.');
    return;
  }
  
  const mergedSteps = mergeSteps(steps);
  console.log('Merged to', mergedSteps.length, 'steps');
  const html = generateReport(mergedSteps, settings || {});
  downloadHTML(html);
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  const { steps, settings } = await chrome.storage.local.get(['steps', 'settings']);
  console.log('Copy clicked - Steps:', steps?.length || 0);
  console.log('Steps data:', steps);
  
  if (!steps || steps.length === 0) {
    alert('No steps recorded yet. Start recording and perform some actions first.');
    return;
  }
  
  const mergedSteps = mergeSteps(steps);
  const text = generateTextReport(mergedSteps, settings || {});
  await navigator.clipboard.writeText(text);
  alert('Report copied to clipboard!');
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (confirm('Clear all recorded steps?')) {
    await chrome.storage.local.set({ steps: [] });
    updateStepCount(0);
  }
});

function getSettings() {
  return {
    captureClicks: document.getElementById('captureClicks').checked,
    captureInputs: document.getElementById('captureInputs').checked,
    captureNavigation: document.getElementById('captureNavigation').checked,
    captureScroll: document.getElementById('captureScroll').checked,
    captureErrors: document.getElementById('captureErrors').checked,
    captureValidation: document.getElementById('captureValidation').checked,
    captureNetwork: document.getElementById('captureNetwork').checked,
    includeTimestamps: document.getElementById('includeTimestamps').checked,
    includeUrls: document.getElementById('includeUrls').checked,
    includeScreenshots: document.getElementById('includeScreenshots').checked,
    screenshotQuality: parseInt(document.getElementById('screenshotQuality').value, 10)
  };
}

function updateUI() {
  const status = document.getElementById('status');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isRecording) {
    status.textContent = '🔴 Recording...';
    status.className = 'status recording';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    status.textContent = '⏹️ Not Recording';
    status.className = 'status stopped';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
}

function updateStepCount(count) {
  document.getElementById('stepCount').textContent = `Steps recorded: ${count}`;
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.steps) {
    updateStepCount(changes.steps.newValue?.length || 0);
  }
});

// Helper function to generate network card HTML
function generateNetworkCard(step, index, settings, d) {
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
  
  // Prepare JSON data for the viewer
  const requestData = d.requestBody ? escapeJsonForHtml(d.requestBody) : null;
  const responseData = d.responseBody ? escapeJsonForHtml(d.responseBody) : null;
  
  // Generate unique ID for this network card
  const cardId = `network-${index}`;
  
  // Build field mappings HTML
  let fieldMappingsHtml = '';
  if (d.fieldMappings && d.fieldMappings.length > 0) {
    fieldMappingsHtml = `
      <div class="field-mapping">
        <div class="field-mapping-title">📊 Field Mappings (Input → API)</div>
        ${d.fieldMappings.map(m => `
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

// Helper to escape HTML special characters
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to escape JSON for embedding in HTML
function escapeJsonForHtml(data) {
  if (!data) return null;
  let jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  // Escape for embedding in script tag
  return jsonStr.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function generateReport(steps, settings) {
  const timestamp = new Date().toLocaleString();
  const stepTypes = [...new Set(steps.map(s => s.type))];
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ICOS Bug Report - ${timestamp}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3); }
    .header h1 { margin: 0 0 12px 0; font-size: 32px; font-weight: 700; }
    .header .meta { opacity: 0.95; font-size: 14px; display: flex; gap: 20px; flex-wrap: wrap; }
    .filter-panel { background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid rgba(102, 126, 234, 0.1); }
    .filter-panel h3 { margin: 0 0 8px 0; color: #2d3748; font-size: 18px; font-weight: 600; }
    .filter-panel > p { margin: 0 0 16px 0; color: #718096; font-size: 14px; }
    .filter-options { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    .filter-option.screenshot-filter { background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 2px solid #cbd5e0; width: 100%; margin-top: 10px; padding-top: 10px; }
    .filter-option { display: flex; align-items: center; background: #f7fafc; padding: 8px 12px; border-radius: 8px; transition: all 0.2s; border: 2px solid transparent; }
    .filter-option:hover { background: #edf2f7; border-color: #667eea; }
    .filter-option input { margin-right: 8px; cursor: pointer; width: 18px; height: 18px; }
    .filter-option label { cursor: pointer; font-size: 13px; font-weight: 500; user-select: none; }
    .filter-buttons { margin-top: 16px; display: flex; gap: 10px; }
    .filter-buttons button { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }
    .btn-all { background: #667eea; color: white; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); }
    .btn-none { background: #e2e8f0; color: #4a5568; }
    .btn-all:hover { background: #5568d3; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .btn-none:hover { background: #cbd5e0; }
    .btn-compact { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); }
    .btn-compact:hover { background: linear-gradient(135deg, #5568d3 0%, #6a3ba2 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .btn-compact.active { background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); box-shadow: 0 2px 8px rgba(46, 125, 50, 0.3); }
    .step.compacted-hidden { display: none !important; }
    .step.priority-badge::after { content: attr(data-priority); position: absolute; top: 10px; right: 10px; background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .step[data-priority="critical"]::after { background: #c62828; }
    .step[data-priority="high"]::after { background: #e65100; }
    .step[data-priority="medium"]::after { background: #f57c00; }
    .compact-summary { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #81c784; display: none; }
    .compact-summary.active { display: block; }
    .compact-summary h3 { margin: 0 0 8px 0; color: #2e7d32; font-size: 16px; }
    .compact-summary p { margin: 4px 0; color: #1b5e20; font-size: 14px; }
    .summary { background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-left: 4px solid #667eea; }
    .summary h2 { margin: 0 0 12px 0; color: #2d3748; font-size: 20px; font-weight: 600; }
    .summary p { color: #4a5568; line-height: 1.6; margin: 8px 0; }
    .step { background: white; padding: 20px; margin-bottom: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid #667eea; transition: all 0.3s; position: relative; overflow: hidden; }
    .step::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); transition: width 0.3s; }
    .step:hover { box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15); transform: translateY(-2px); }
    .step:hover::before { width: 6px; }
    .step.hidden { display: none; }
    .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .step-number { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; min-width: 36px; text-align: center; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); }
    .step-time { color: #718096; font-size: 12px; background: #f7fafc; padding: 6px 10px; border-radius: 6px; font-weight: 500; border: 1px solid #e2e8f0; }
    .step-type { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .type-click { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #0d47a1; border: 2px solid #90caf9; box-shadow: 0 2px 4px rgba(13, 71, 161, 0.1); }
    .type-input { background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); color: #4a148c; border: 2px solid #ce93d8; box-shadow: 0 2px 4px rgba(74, 20, 140, 0.1); }
    .type-navigation { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); color: #1b5e20; border: 2px solid #a5d6a7; box-shadow: 0 2px 4px rgba(27, 94, 32, 0.1); }
    .type-error { background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #b71c1c; border: 2px solid #ef9a9a; box-shadow: 0 2px 4px rgba(183, 28, 28, 0.1); }
    .type-validation { background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #c62828; border: 2px solid #ef9a9a; box-shadow: 0 2px 4px rgba(198, 40, 40, 0.15); font-weight: 700; }
    .type-scroll { background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); color: #880e4f; border: 2px solid #f48fb1; box-shadow: 0 2px 4px rgba(136, 14, 79, 0.1); }
    .type-network { background: linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%); color: #01579b; border: 2px solid #81d4fa; box-shadow: 0 2px 4px rgba(1, 87, 155, 0.1); }
    .type-network.failed { background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #b71c1c; border: 2px solid #ef9a9a; }
    .type-network.slow { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); color: #e65100; border: 2px solid #ffcc80; }
    .step-description { font-size: 16px; color: #2d3748; margin: 10px 0 14px 0; line-height: 1.6; font-weight: 500; }
    .step-details { background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 16px; border-radius: 8px; margin-top: 14px; font-size: 13px; border: 1px solid #e2e8f0; }
    .step-details div { margin: 8px 0; display: flex; gap: 12px; align-items: baseline; }
    .step-details strong { color: #667eea; min-width: 80px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .step-details div:first-child { margin-top: 0; }
    .step-details div:last-child { margin-bottom: 0; }
    .url { color: #1976d2; word-break: break-all; }
    .screenshot { max-width: 250px; height: auto; border-radius: 8px; margin-top: 14px; cursor: pointer; transition: all 0.4s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 2px solid #e2e8f0; }
    .screenshot:hover, .screenshot.expanded { max-width: 1250px; border-color: #667eea; box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3); }
    .footer { text-align: center; color: #718096; margin-top: 40px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .footer p { margin: 8px 0; font-size: 14px; }
    .visible-count { color: #667eea; font-weight: 700; margin-top: 12px; font-size: 14px; padding: 8px 16px; background: #f7fafc; border-radius: 8px; display: inline-block; border: 2px solid #e2e8f0; }
    
    /* Network Card Styles - Chrome DevTools inspired */
    .network-card { background: #1e1e1e; border-radius: 8px; overflow: hidden; margin-top: 12px; font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace; max-height: 550px; display: flex; flex-direction: column; }
    .network-card-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: linear-gradient(135deg, #2d2d2d 0%, #1e1e1e 100%); border-bottom: 1px solid #3d3d3d; flex-shrink: 0; }
    .network-method { font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .method-get { background: #1565c0; color: #fff; }
    .method-post { background: #2e7d32; color: #fff; }
    .method-put { background: #f57c00; color: #fff; }
    .method-patch { background: #7b1fa2; color: #fff; }
    .method-delete { background: #c62828; color: #fff; }
    .network-url { color: #9cdcfe; font-size: 13px; word-break: break-all; flex: 1; }
    .network-status { display: flex; align-items: center; gap: 8px; }
    .status-code { font-weight: 700; font-size: 13px; padding: 3px 8px; border-radius: 4px; }
    .status-success { background: rgba(46, 125, 50, 0.2); color: #81c784; }
    .status-error { background: rgba(198, 40, 40, 0.2); color: #ef9a9a; }
    .status-warning { background: rgba(245, 124, 0, 0.2); color: #ffb74d; }
    .network-duration { color: #888; font-size: 12px; }
    .network-tabs { display: flex; background: #252526; border-bottom: 1px solid #3d3d3d; flex-shrink: 0; }
    .network-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #252526; border-bottom: 1px solid #3d3d3d; flex-shrink: 0; }
    .network-search-input { flex: 1; background: #1e1e1e; border: 1px solid #3d3d3d; border-radius: 4px; padding: 6px 10px; color: #d4d4d4; font-size: 12px; outline: none; transition: border-color 0.2s; }
    .network-search-input:focus { border-color: #4fc3f7; }
    .network-search-input::placeholder { color: #6d6d6d; }
    .network-search-results { font-size: 11px; color: #888; white-space: nowrap; }
    .network-search-results.has-results { color: #4fc3f7; }
    .network-search-results.no-results { color: #f48771; }
    .network-search-clear { background: transparent; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
    .network-search-clear:hover { background: #3d3d3d; color: #fff; }
    .network-search-nav { background: transparent; border: none; color: #888; cursor: pointer; font-size: 10px; padding: 2px 6px; border-radius: 3px; transition: all 0.2s; }
    .network-search-nav:hover { background: #3d3d3d; color: #4fc3f7; }
    .search-highlight { background: #614d0a; color: #fff; border-radius: 2px; padding: 0 2px; }
    .search-highlight.current { background: #f57c00; color: #fff; box-shadow: 0 0 4px rgba(245, 124, 0, 0.5); }
    .network-tab { padding: 10px 20px; color: #888; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
    .network-tab:hover { color: #ddd; background: rgba(255,255,255,0.05); }
    .network-tab.active { color: #4fc3f7; border-bottom-color: #4fc3f7; background: rgba(79, 195, 247, 0.05); }
    .network-content { display: none; flex: 1; overflow: auto; min-height: 0; }
    .network-content.expanded { }
    .json-actions { display: flex; gap: 8px; padding: 8px 16px 0; }
    .json-action-btn { background: #3d3d3d; color: #ddd; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; }
    .json-action-btn:hover { background: #4fc3f7; color: #1e1e1e; }
    .json-action-btn.active { background: #4fc3f7; color: #1e1e1e; }
    .raw-json-view { display: none; background: #1a1a1a; padding: 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.5; color: #d4d4d4; white-space: pre; overflow-x: auto; }
    .raw-json-view.active { display: block; }
    .network-content.active { display: block; }
    .network-content::-webkit-scrollbar { width: 8px; height: 8px; }
    .network-content::-webkit-scrollbar-track { background: #1e1e1e; }
    .network-content::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
    .network-content::-webkit-scrollbar-thumb:hover { background: #666; }
    
    /* JSON Tree Viewer Styles */
    .json-tree { padding: 16px; font-size: 13px; line-height: 1.6; color: #d4d4d4; min-width: max-content; }
    .json-tree-line { display: flex; align-items: flex-start; white-space: nowrap; }
    .json-tree-toggle { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #888; font-size: 10px; margin-right: 4px; user-select: none; flex-shrink: 0; }
    .json-tree-toggle:hover { color: #fff; }
    .json-tree-toggle.collapsed::before { content: '▶'; }
    .json-tree-toggle.expanded::before { content: '▼'; }
    .json-tree-toggle.empty { visibility: hidden; }
    .json-tree-key { color: #9cdcfe; }
    .json-tree-string { color: #ce9178; }
    .json-tree-number { color: #b5cea8; }
    .json-tree-boolean { color: #569cd6; }
    .json-tree-null { color: #569cd6; font-style: italic; }
    .json-tree-bracket { color: #808080; }
    .json-tree-comma { color: #808080; }
    .json-tree-colon { color: #808080; margin: 0 4px; }
    .json-tree-children { margin-left: 20px; }
    .json-tree-children.collapsed { display: none; }
    .json-tree-preview { color: #888; font-style: italic; margin-left: 6px; }
    .json-tree-copy-btn { background: #3d3d3d; color: #ddd; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; margin: 8px 16px 16px; transition: all 0.2s; }
    .json-tree-copy-btn:hover { background: #4fc3f7; color: #1e1e1e; }
    
    /* Info Panel for network card */
    .network-info-panel { padding: 16px; overflow-x: auto; }
    .network-info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #2d2d2d; white-space: nowrap; }
    .network-info-row:last-child { border-bottom: none; }
    .network-info-label { color: #888; font-size: 12px; min-width: 140px; text-transform: uppercase; letter-spacing: 0.5px; }
    .network-info-value { color: #d4d4d4; font-size: 13px; }
    .network-info-value.error { color: #ef9a9a; }
    .network-info-value.success { color: #81c784; }
    
    /* Field Mapping Styles */
    .field-mapping { margin-top: 12px; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; border: 1px solid rgba(102, 126, 234, 0.2); }
    .field-mapping-title { font-size: 11px; color: #667eea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600; }
    .field-mapping-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; color: #4a5568; }
    .field-mapping-prop { color: #667eea; font-weight: 600; font-family: 'SF Mono', monospace; }
    .field-mapping-value { color: #2d3748; }
    .field-mapping-source { background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🐛 ICOS Bug Recreation Report</h1>
    <div class="meta">Generated: ${timestamp}</div>
    <div class="meta">Total Steps: ${steps.length}</div>
  </div>
  
  <div class="filter-panel">
    <h3>🔍 Filter Steps</h3>
    <p>Select which step types to display:</p>
    <div class="filter-options">
      ${stepTypes.map(type => `
        <div class="filter-option">
          <input type="checkbox" id="filter-${type}" value="${type}" checked onchange="filterSteps()">
          <label for="filter-${type}">
            <span class="step-type type-${type}">${type.toUpperCase()}</span>
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
      <button class="btn-all" onclick="selectAll()">✓ Select All</button>
      <button class="btn-none" onclick="selectNone()">✗ Clear All</button>
      <button class="btn-compact" id="compactBtn" onclick="toggleCompactMode()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-left: auto;">🎯 Compact View</button>
    </div>
    <div class="visible-count" id="visibleCount">Showing ${steps.length} of ${steps.length} steps</div>
  </div>
  
  <div class="summary">
    <h2>📋 Summary</h2>
    <p>This report contains ${steps.length} recorded steps to recreate the bug in the ICOS Claims application.</p>
    <p><strong>Follow these steps in order to reproduce the issue.</strong></p>
  </div>
  
  <div class="compact-summary" id="compactSummary">
    <h3>🎯 Compact Mode Active</h3>
    <p id="compactStats"></p>
  </div>
  
  ${steps.map((step, index) => {
    const d = step.details || {};
    
    // For network steps, generate the network card
    if (step.type === 'network') {
      return generateNetworkCard(step, index, settings, d);
    }
    
    // Build compact details - only show relevant info for other types
    const detailsToShow = [];
    
    if (step.type === 'input') {
      if (d.fieldLabel) detailsToShow.push('<strong>Field:</strong> ' + d.fieldLabel);
      if (d.value !== undefined && d.value !== '') detailsToShow.push('<strong>Value:</strong> ' + d.value);
      if (d.fieldType && d.fieldType !== 'text') detailsToShow.push('<strong>Type:</strong> ' + d.fieldType);
      if (d.path) detailsToShow.push('<strong>Path:</strong> <code style="font-size: 11px; background: #2d2d2d; padding: 2px 6px; border-radius: 3px; color: #9cdcfe;">' + d.path + '</code>');
    } else if (step.type === 'click') {
      if (d.label) detailsToShow.push('<strong>Element:</strong> ' + d.label);
      if (d.stepper) detailsToShow.push('<strong>Stepper:</strong> ' + d.stepper);
      if (d.text && !d.label) detailsToShow.push('<strong>Text:</strong> ' + d.text);
      if (d.path) detailsToShow.push('<strong>Path:</strong> <code style="font-size: 11px; background: #2d2d2d; padding: 2px 6px; border-radius: 3px; color: #9cdcfe;">' + d.path + '</code>');
    } else if (step.type === 'error') {
      if (d.error) detailsToShow.push('<strong>Error:</strong> ' + d.error);
      if (d.file) detailsToShow.push('<strong>File:</strong> ' + d.file + ':' + (d.line || ''));
    } else if (step.type === 'validation') {
      if (d.fieldLabel) detailsToShow.push('<strong>Field:</strong> ' + d.fieldLabel);
      if (d.status) detailsToShow.push('<strong>Status:</strong> <span style="color: #c62828; font-weight: 700;">❌ Failed</span>');
    }
    
    const stepPriority = step.priority || 'medium';
    return '<div class="step" data-type="' + step.type + '" data-step-index="' + index + '" data-priority="' + stepPriority + '" data-captured-priority="' + stepPriority + '">' +
      '<div class="step-header">' +
        '<div style="display: flex; align-items: center; gap: 10px;">' +
          '<span class="step-number">' + (index + 1) + '</span>' +
          '<span class="step-type type-' + step.type + '">' + step.type.toUpperCase() + '</span>' +
        '</div>' +
        (settings.includeTimestamps ? '<span class="step-time">' + new Date(step.timestamp).toLocaleTimeString() + '</span>' : '') +
      '</div>' +
      '<div class="step-description">' + step.description + '</div>' +
      (detailsToShow.length > 0 ? 
        '<div class="step-details">' +
          detailsToShow.map(function(detail) { return '<div>' + detail + '</div>'; }).join('') +
        '</div>'
      : '') +
      (step.screenshot ? '<img src="' + step.screenshot + '" class="screenshot" alt="Screenshot" onmouseenter="expandScreenshot(this)" title="Hover to expand, click outside to collapse">' : '') +
    '</div>';
  }).join('')}
  
  <div class="footer">
    <p>Generated by ICOS Bug Recorder Extension</p>
    <p>Use this report to help developers recreate and fix the bug</p>
  </div>
  
  <script>
    let currentExpandedScreenshot = null;
    
    function expandScreenshot(img) {
      // Collapse any previously expanded screenshot
      if (currentExpandedScreenshot && currentExpandedScreenshot !== img) {
        currentExpandedScreenshot.classList.remove('expanded');
      }
      img.classList.add('expanded');
      currentExpandedScreenshot = img;
    }
    
    // Collapse screenshot when clicking outside
    document.addEventListener('click', function(e) {
      if (currentExpandedScreenshot && !e.target.classList.contains('screenshot')) {
        currentExpandedScreenshot.classList.remove('expanded');
        currentExpandedScreenshot = null;
      }
    });
    
    // ==========================================
    // Network Card Functions
    // ==========================================
    
    // Switch between network tabs
    function switchNetworkTab(tabEl, cardId, tabName) {
      // Get the card container
      const card = tabEl.closest('.network-card');
      
      // Deactivate all tabs
      card.querySelectorAll('.network-tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.network-content').forEach(c => c.classList.remove('active'));
      
      // Activate selected tab
      tabEl.classList.add('active');
      const content = document.getElementById(cardId + '-' + tabName);
      if (content) {
        content.classList.add('active');
        
        // Initialize JSON tree if not already done
        const treeContainer = content.querySelector('.json-tree');
        const dataScript = content.querySelector('script[type="application/json"]');
        if (treeContainer && dataScript && !treeContainer.hasChildNodes()) {
          try {
            const jsonData = JSON.parse(dataScript.textContent);
            renderJsonTree(treeContainer, jsonData);
          } catch (e) {
            treeContainer.innerHTML = '<div style="color: #ce9178; padding: 8px;">' + escapeHtmlJs(dataScript.textContent) + '</div>';
          }
        }
      }
    }
    
    // Render JSON tree with collapsible nodes
    function renderJsonTree(container, data, depth = 0) {
      container.innerHTML = '';
      const tree = createJsonNode(data, depth, true);
      container.appendChild(tree);
    }
    
    // Create a JSON tree node recursively
    function createJsonNode(value, depth, isRoot = false) {
      const wrapper = document.createElement('div');
      
      if (value === null) {
        wrapper.innerHTML = '<span class="json-tree-null">null</span>';
        return wrapper;
      }
      
      if (typeof value === 'boolean') {
        wrapper.innerHTML = '<span class="json-tree-boolean">' + value + '</span>';
        return wrapper;
      }
      
      if (typeof value === 'number') {
        wrapper.innerHTML = '<span class="json-tree-number">' + value + '</span>';
        return wrapper;
      }
      
      if (typeof value === 'string') {
        wrapper.innerHTML = '<span class="json-tree-string">"' + escapeHtmlJs(value) + '"</span>';
        return wrapper;
      }
      
      if (Array.isArray(value)) {
        return createArrayNode(value, depth, isRoot);
      }
      
      if (typeof value === 'object') {
        return createObjectNode(value, depth, isRoot);
      }
      
      wrapper.textContent = String(value);
      return wrapper;
    }
    
    // Create an object node
    function createObjectNode(obj, depth, isRoot) {
      const wrapper = document.createElement('div');
      const keys = Object.keys(obj);
      
      if (keys.length === 0) {
        wrapper.innerHTML = '<span class="json-tree-bracket">{}</span>';
        return wrapper;
      }
      
      const header = document.createElement('div');
      header.className = 'json-tree-line';
      
      const toggle = document.createElement('span');
      toggle.className = 'json-tree-toggle ' + (isRoot || depth < 2 ? 'expanded' : 'collapsed');
      toggle.onclick = () => toggleJsonNode(toggle);
      header.appendChild(toggle);
      
      const bracket = document.createElement('span');
      bracket.className = 'json-tree-bracket';
      bracket.textContent = '{';
      header.appendChild(bracket);
      
      const preview = document.createElement('span');
      preview.className = 'json-tree-preview';
      preview.textContent = keys.length + ' properties';
      preview.style.display = (isRoot || depth < 2) ? 'none' : 'inline';
      header.appendChild(preview);
      
      wrapper.appendChild(header);
      
      const children = document.createElement('div');
      children.className = 'json-tree-children' + ((isRoot || depth < 2) ? '' : ' collapsed');
      
      keys.forEach((key, idx) => {
        const row = document.createElement('div');
        row.className = 'json-tree-line';
        
        const keySpan = document.createElement('span');
        keySpan.className = 'json-tree-key';
        keySpan.textContent = '"' + key + '"';
        row.appendChild(keySpan);
        
        const colon = document.createElement('span');
        colon.className = 'json-tree-colon';
        colon.textContent = ':';
        row.appendChild(colon);
        
        const valueNode = createJsonNode(obj[key], depth + 1);
        row.appendChild(valueNode);
        
        if (idx < keys.length - 1) {
          const comma = document.createElement('span');
          comma.className = 'json-tree-comma';
          comma.textContent = ',';
          row.appendChild(comma);
        }
        
        children.appendChild(row);
      });
      
      wrapper.appendChild(children);
      
      const closeBracket = document.createElement('div');
      closeBracket.innerHTML = '<span class="json-tree-bracket">}</span>';
      closeBracket.style.marginLeft = '20px';
      wrapper.appendChild(closeBracket);
      
      return wrapper;
    }
    
    // Create an array node
    function createArrayNode(arr, depth, isRoot) {
      const wrapper = document.createElement('div');
      
      if (arr.length === 0) {
        wrapper.innerHTML = '<span class="json-tree-bracket">[]</span>';
        return wrapper;
      }
      
      const header = document.createElement('div');
      header.className = 'json-tree-line';
      
      const toggle = document.createElement('span');
      toggle.className = 'json-tree-toggle ' + (isRoot || depth < 2 ? 'expanded' : 'collapsed');
      toggle.onclick = () => toggleJsonNode(toggle);
      header.appendChild(toggle);
      
      const bracket = document.createElement('span');
      bracket.className = 'json-tree-bracket';
      bracket.textContent = '[';
      header.appendChild(bracket);
      
      const preview = document.createElement('span');
      preview.className = 'json-tree-preview';
      preview.textContent = arr.length + ' items';
      preview.style.display = (isRoot || depth < 2) ? 'none' : 'inline';
      header.appendChild(preview);
      
      wrapper.appendChild(header);
      
      const children = document.createElement('div');
      children.className = 'json-tree-children' + ((isRoot || depth < 2) ? '' : ' collapsed');
      
      arr.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'json-tree-line';
        
        const indexSpan = document.createElement('span');
        indexSpan.className = 'json-tree-key';
        indexSpan.textContent = idx;
        indexSpan.style.color = '#b5cea8';
        row.appendChild(indexSpan);
        
        const colon = document.createElement('span');
        colon.className = 'json-tree-colon';
        colon.textContent = ':';
        row.appendChild(colon);
        
        const valueNode = createJsonNode(item, depth + 1);
        row.appendChild(valueNode);
        
        if (idx < arr.length - 1) {
          const comma = document.createElement('span');
          comma.className = 'json-tree-comma';
          comma.textContent = ',';
          row.appendChild(comma);
        }
        
        children.appendChild(row);
      });
      
      wrapper.appendChild(children);
      
      const closeBracket = document.createElement('div');
      closeBracket.innerHTML = '<span class="json-tree-bracket">]</span>';
      closeBracket.style.marginLeft = '20px';
      wrapper.appendChild(closeBracket);
      
      return wrapper;
    }
    
    // Toggle JSON node expand/collapse
    function toggleJsonNode(toggle) {
      const isExpanded = toggle.classList.contains('expanded');
      const wrapper = toggle.closest('div').parentElement;
      const children = wrapper.querySelector('.json-tree-children');
      const preview = toggle.parentElement.querySelector('.json-tree-preview');
      
      if (isExpanded) {
        toggle.classList.remove('expanded');
        toggle.classList.add('collapsed');
        if (children) children.classList.add('collapsed');
        if (preview) preview.style.display = 'inline';
      } else {
        toggle.classList.remove('collapsed');
        toggle.classList.add('expanded');
        if (children) children.classList.remove('collapsed');
        if (preview) preview.style.display = 'none';
      }
    }
    
    // Copy JSON to clipboard (beautified)
    function copyJsonToClipboard(dataId) {
      const dataScript = document.getElementById(dataId);
      if (dataScript) {
        try {
          const jsonData = JSON.parse(dataScript.textContent);
          const formatted = JSON.stringify(jsonData, null, 2);
          navigator.clipboard.writeText(formatted).then(() => {
            // Show brief success feedback
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.style.background = '#2e7d32';
            setTimeout(() => {
              btn.textContent = originalText;
              btn.style.background = '';
            }, 1500);
          });
        } catch (e) {
          navigator.clipboard.writeText(dataScript.textContent);
        }
      }
    }
    
    // Expand all JSON nodes in a tree
    function expandAllJson(treeId) {
      const tree = document.getElementById(treeId);
      if (!tree) {
        console.log('Tree not found:', treeId);
        return;
      }
      
      // Find all collapsed toggles and expand them using the existing toggle function
      const collapsedToggles = tree.querySelectorAll('.json-tree-toggle.collapsed');
      let count = 0;
      collapsedToggles.forEach(toggle => {
        toggleJsonNode(toggle);
        count++;
      });
      
      // Visual feedback
      showButtonFeedback(event.target, '✓ Expanded ' + count);
    }
    
    // Collapse all JSON nodes in a tree
    function collapseAllJson(treeId) {
      const tree = document.getElementById(treeId);
      if (!tree) {
        console.log('Tree not found:', treeId);
        return;
      }
      
      // Find all expanded toggles and collapse them (skip the first one to keep root expanded)
      const expandedToggles = Array.from(tree.querySelectorAll('.json-tree-toggle.expanded'));
      // Skip the root toggle (first one)
      let count = 0;
      expandedToggles.slice(1).forEach(toggle => {
        toggleJsonNode(toggle);
        count++;
      });
      
      // Visual feedback
      showButtonFeedback(event.target, '✓ Collapsed ' + count);
    }
    
    // Show brief feedback on button
    function showButtonFeedback(btn, message) {
      if (!btn) return;
      const originalText = btn.textContent;
      btn.textContent = message;
      btn.style.background = '#2e7d32';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1000);
    }
    
    // Toggle raw JSON view
    function toggleRawJson(contentId) {
      const content = document.getElementById(contentId);
      if (!content) return;
      
      const tree = content.querySelector('.json-tree');
      const rawView = content.querySelector('.raw-json-view');
      const dataScript = content.querySelector('script[type="application/json"]');
      const toggleBtn = content.querySelector('.json-action-btn:last-child');
      
      if (rawView.classList.contains('active')) {
        // Switch to tree view
        rawView.classList.remove('active');
        tree.style.display = 'block';
        if (toggleBtn) {
          toggleBtn.textContent = '📄 Raw JSON';
          toggleBtn.classList.remove('active');
        }
      } else {
        // Switch to raw view
        if (dataScript && rawView.innerHTML === '') {
          try {
            const jsonData = JSON.parse(dataScript.textContent);
            rawView.textContent = JSON.stringify(jsonData, null, 2);
          } catch (e) {
            rawView.textContent = dataScript.textContent;
          }
        }
        rawView.classList.add('active');
        tree.style.display = 'none';
        if (toggleBtn) {
          toggleBtn.textContent = '🌳 Tree View';
          toggleBtn.classList.add('active');
        }
      }
    }
    
    // ==========================================
    // Network Search Functions
    // ==========================================
    
    // Track search state per card
    const searchState = {};
    
    // Search in network card (request/response data)
    function searchInNetworkCard(cardId, query) {
      const resultsEl = document.getElementById(cardId + '-search-results');
      const clearBtn = document.getElementById(cardId + '-search-clear');
      const prevBtn = document.getElementById(cardId + '-search-prev');
      const nextBtn = document.getElementById(cardId + '-search-next');
      
      // Clear previous highlights
      clearSearchHighlights(cardId);
      
      // Reset search state
      searchState[cardId] = { matches: [], currentIndex: 0 };
      
      if (!query || query.length < 2) {
        resultsEl.textContent = '';
        resultsEl.className = 'network-search-results';
        clearBtn.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
      }
      
      clearBtn.style.display = 'block';
      
      const searchLower = query.toLowerCase();
      
      // Search in request data
      const requestData = document.getElementById(cardId + '-request-data');
      if (requestData) {
        highlightInJsonTree(cardId + '-request-tree', searchLower);
        highlightInRawView(cardId + '-request-raw', requestData.textContent, searchLower);
      }
      
      // Search in response data
      const responseData = document.getElementById(cardId + '-response-data');
      if (responseData) {
        highlightInJsonTree(cardId + '-response-tree', searchLower);
        highlightInRawView(cardId + '-response-raw', responseData.textContent, searchLower);
      }
      
      // Collect all highlight elements in the currently visible tab only
      const searchInput = document.getElementById(cardId + '-search');
      let allHighlights = [];
      if (searchInput) {
        const card = searchInput.closest('.network-card');
        if (card) {
          const activeContents = card.querySelectorAll('.network-content.active');
          activeContents.forEach(content => {
            allHighlights = allHighlights.concat(
              Array.from(content.querySelectorAll('.search-highlight'))
            );
          });
        }
      }
      searchState[cardId].matches = allHighlights;
      
      const totalMatches = searchState[cardId].matches.length;
      
      // Update results count and show/hide navigation
      if (totalMatches > 0) {
        resultsEl.className = 'network-search-results has-results';
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        // Set first match as current
        searchState[cardId].currentIndex = 0;
        updateCurrentMatch(cardId);
      } else {
        resultsEl.textContent = 'No matches';
        resultsEl.className = 'network-search-results no-results';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }
    
    // Update current match highlight and results display
    function updateCurrentMatch(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      
      // Remove current class from all matches
      state.matches.forEach(m => m.classList.remove('current'));
      
      // Add current class to current match
      const currentMatch = state.matches[state.currentIndex];
      if (currentMatch) {
        currentMatch.classList.add('current');
        scrollToMatch(currentMatch);
      }
      
      // Update results display
      const resultsEl = document.getElementById(cardId + '-search-results');
      resultsEl.textContent = (state.currentIndex + 1) + ' of ' + state.matches.length;
    }
    
    // Scroll to a match element within the network card
    function scrollToMatch(element) {
      if (!element) return;

      // Find the scrollable network content container
      const container = element.closest('.network-content');
      if (container) {
        // Calculate element position relative to the container using offset properties
        let elementTop = 0;
        let elementLeft = 0;
        let currentElement = element;

        // Walk up the DOM tree to calculate cumulative offset
        while (currentElement && currentElement !== container) {
          elementTop += currentElement.offsetTop;
          elementLeft += currentElement.offsetLeft;
          currentElement = currentElement.offsetParent;
        }

        // Center the element vertically in the visible area
        const containerHeight = container.clientHeight;
        const elementHeight = element.offsetHeight;
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

        // Smooth scroll vertically to center the element
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });

        // Handle horizontal scrolling for long lines
        const containerWidth = container.clientWidth;
        const elementWidth = element.offsetWidth;

        // Check if element is outside the current visible horizontal area
        if (elementLeft < container.scrollLeft) {
          // Element is to the left - scroll it into view with margin
          container.scrollTo({
            left: Math.max(0, elementLeft - 20),
            behavior: 'smooth'
          });
        } else if (elementLeft + elementWidth > container.scrollLeft + containerWidth) {
          // Element is to the right - scroll it into view with margin
          container.scrollTo({
            left: elementLeft + elementWidth - containerWidth + 20,
            behavior: 'smooth'
          });
        }
      } else {
        // Fallback to default behavior
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }
    
    // Navigate to next match
    function searchNext(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      
      state.currentIndex = (state.currentIndex + 1) % state.matches.length;
      updateCurrentMatch(cardId);
    }
    
    // Navigate to previous match
    function searchPrev(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      
      state.currentIndex = (state.currentIndex - 1 + state.matches.length) % state.matches.length;
      updateCurrentMatch(cardId);
    }
    
    // Highlight matches in JSON tree
    function highlightInJsonTree(treeId, query) {
      const tree = document.getElementById(treeId);
      if (!tree) return 0;
      
      let matches = 0;
      const textNodes = getTextNodes(tree);
      
      textNodes.forEach(node => {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        if (lowerText.includes(query)) {
          const parent = node.parentElement;
          if (parent && !parent.classList.contains('search-highlight')) {
            const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
            const parts = text.split(regex);
            if (parts.length > 1) {
              const fragment = document.createDocumentFragment();
              parts.forEach(part => {
                if (part.toLowerCase() === query) {
                  const mark = document.createElement('mark');
                  mark.className = 'search-highlight';
                  mark.textContent = part;
                  fragment.appendChild(mark);
                  matches++;
                } else {
                  fragment.appendChild(document.createTextNode(part));
                }
              });
              node.replaceWith(fragment);
            }
          }
        }
      });
      
      return matches;
    }
    
    // Highlight matches in raw JSON view
    function highlightInRawView(rawId, jsonText, query) {
      const rawView = document.getElementById(rawId);
      if (!rawView) return 0;
      
      const lowerText = jsonText.toLowerCase();
      let matches = 0;
      let pos = 0;
      while ((pos = lowerText.indexOf(query, pos)) !== -1) {
        matches++;
        pos += query.length;
      }
      
      if (matches > 0 && rawView.classList.contains('active')) {
        const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
        rawView.innerHTML = escapeHtmlJs(jsonText).replace(regex, '<mark class="search-highlight">$1</mark>');
      }
      
      return matches;
    }
    
    // Get all text nodes in an element
    function getTextNodes(element) {
      const nodes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
          nodes.push(node);
        }
      }
      return nodes;
    }
    
    // Escape regex special characters
    function escapeRegex(str) {
      return str.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
    }
    
    // Clear search highlights
    function clearSearchHighlights(cardId) {
      ['request', 'response'].forEach(type => {
        const tree = document.getElementById(cardId + '-' + type + '-tree');
        const rawView = document.getElementById(cardId + '-' + type + '-raw');
        const dataScript = document.getElementById(cardId + '-' + type + '-data');
        
        if (tree) {
          // Re-render the tree to clear highlights
          if (dataScript) {
            try {
              const jsonData = JSON.parse(dataScript.textContent);
              renderJsonTree(tree, jsonData);
            } catch (e) {}
          }
        }
        
        if (rawView && dataScript) {
          try {
            const jsonData = JSON.parse(dataScript.textContent);
            rawView.textContent = JSON.stringify(jsonData, null, 2);
          } catch (e) {
            rawView.textContent = dataScript.textContent;
          }
        }
      });
    }
    
    // Clear network search
    function clearNetworkSearch(cardId) {
      const input = document.getElementById(cardId + '-search');
      const resultsEl = document.getElementById(cardId + '-search-results');
      const clearBtn = document.getElementById(cardId + '-search-clear');
      const prevBtn = document.getElementById(cardId + '-search-prev');
      const nextBtn = document.getElementById(cardId + '-search-next');
      
      if (input) input.value = '';
      if (resultsEl) {
        resultsEl.textContent = '';
        resultsEl.className = 'network-search-results';
      }
      if (clearBtn) clearBtn.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      
      // Reset search state
      searchState[cardId] = { matches: [], currentIndex: 0 };
      
      clearSearchHighlights(cardId);
    }
    
    // Escape HTML for JavaScript context
    function escapeHtmlJs(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    
    // Initialize JSON trees on page load
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize JSON trees for visible tabs
      document.querySelectorAll('.network-content.active').forEach(content => {
        const treeContainer = content.querySelector('.json-tree');
        const dataScript = content.querySelector('script[type="application/json"]');
        if (treeContainer && dataScript && !treeContainer.hasChildNodes()) {
          try {
            const jsonData = JSON.parse(dataScript.textContent);
            renderJsonTree(treeContainer, jsonData);
          } catch (e) {
            treeContainer.innerHTML = '<div style="color: #ce9178;">' + escapeHtmlJs(dataScript.textContent) + '</div>';
          }
        }
      });
    });
    
    // ==========================================
    // Filter Functions
    // ==========================================
    
    function filterSteps() {
      // Reset special filters
      document.getElementById('filter-validation-only').checked = false;
      document.getElementById('filter-api-only').checked = false;
      
      const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]:not(#filter-screenshots):not(#filter-validation-only):not(#filter-api-only)');
      const selectedTypes = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      
      const steps = document.querySelectorAll('.step');
      let visibleCount = 0;
      
      steps.forEach(step => {
        const stepType = step.getAttribute('data-type');
        if (selectedTypes.includes(stepType)) {
          step.classList.remove('hidden');
          visibleCount++;
        } else {
          step.classList.add('hidden');
        }
      });
      
      document.getElementById('visibleCount').textContent = 
        \`Showing \${visibleCount} of \${steps.length} steps\`;
    }
    
    function selectAll() {
      const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]:not(#filter-validation-only):not(#filter-api-only)');
      checkboxes.forEach(cb => cb.checked = true);
      document.getElementById('filter-validation-only').checked = false;
      document.getElementById('filter-api-only').checked = false;
      filterSteps();
    }
    
    function selectNone() {
      const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]:not(#filter-screenshots):not(#filter-validation-only):not(#filter-api-only)');
      checkboxes.forEach(cb => cb.checked = false);
      document.getElementById('filter-validation-only').checked = false;
      document.getElementById('filter-api-only').checked = false;
      filterSteps();
    }
    
    function toggleScreenshots() {
      const showScreenshots = document.getElementById('filter-screenshots').checked;
      const screenshots = document.querySelectorAll('.screenshot');
      screenshots.forEach(img => {
        img.style.display = showScreenshots ? 'block' : 'none';
      });
    }
    
    function toggleValidationOnly() {
      const validationOnly = document.getElementById('filter-validation-only').checked;
      const apiOnly = document.getElementById('filter-api-only').checked;
      
      if (validationOnly) {
        // Uncheck API only
        document.getElementById('filter-api-only').checked = false;
        // Show only validation steps
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
          const type = step.getAttribute('data-type');
          if (type === 'validation' || type === 'error') {
            step.classList.remove('hidden');
          } else {
            step.classList.add('hidden');
          }
        });
      } else {
        // Reset to normal filter
        filterSteps();
      }
      updateVisibleCount();
    }
    
    function toggleAPIOnly() {
      const apiOnly = document.getElementById('filter-api-only').checked;
      const validationOnly = document.getElementById('filter-validation-only').checked;
      
      if (apiOnly) {
        // Uncheck validation only
        document.getElementById('filter-validation-only').checked = false;
        // Show only network steps
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
          const type = step.getAttribute('data-type');
          if (type === 'network') {
            step.classList.remove('hidden');
          } else {
            step.classList.add('hidden');
          }
        });
      } else {
        // Reset to normal filter
        filterSteps();
      }
      updateVisibleCount();
    }
    
    function updateVisibleCount() {
      const steps = document.querySelectorAll('.step');
      const visibleSteps = Array.from(steps).filter(s => !s.classList.contains('hidden'));
      document.getElementById('visibleCount').textContent = 
        \`Showing \${visibleSteps.length} of \${steps.length} steps\`;
    }
    
    let compactMode = false;
    let allStepsData = [];
    
    function toggleCompactMode() {
      compactMode = !compactMode;
      const btn = document.getElementById('compactBtn');
      const summary = document.getElementById('compactSummary');
      
      if (compactMode) {
        btn.textContent = '📋 Show All Steps';
        btn.classList.add('active');
        applyCompactMode();
        summary.classList.add('active');
      } else {
        btn.textContent = '🎯 Compact View';
        btn.classList.remove('active');
        showAllSteps();
        summary.classList.remove('active');
      }
    }
    
    function applyCompactMode() {
      const steps = document.querySelectorAll('.step');
      allStepsData = Array.from(steps).map(step => ({
        element: step,
        type: step.getAttribute('data-type'),
        index: parseInt(step.getAttribute('data-step-index'))
      }));
      
      // Calculate priorities
      const priorities = calculateStepPriorities(allStepsData);
      
      let keptCount = 0;
      steps.forEach((step, index) => {
        const priority = priorities[index];
        step.setAttribute('data-priority', priority);
        
        // Show ONLY high and critical priority steps in compact mode
        if (priority === 'critical' || priority === 'high') {
          step.classList.remove('compacted-hidden');
          step.classList.add('priority-badge');
          keptCount++;
        } else {
          step.classList.add('compacted-hidden');
          step.classList.remove('priority-badge');
        }
      });
      
      updateCompactSummary(steps.length, keptCount);
    }
    
    function showAllSteps() {
      const steps = document.querySelectorAll('.step');
      steps.forEach(step => {
        step.classList.remove('compacted-hidden');
        step.classList.remove('priority-badge');
        step.removeAttribute('data-priority');
      });
    }
    
    function calculateStepPriorities(stepsData) {
      const priorities = [];
      
      stepsData.forEach((stepData, index) => {
        const step = stepData.element;
        const type = stepData.type;
        
        // Check if step already has priority from capture (data attribute)
        const capturedPriority = step.getAttribute('data-captured-priority');
        if (capturedPriority) {
          priorities.push(capturedPriority);
          return;
        }
        
        let priority = 'low';
        
        // Critical: Errors and validation failures
        if (type === 'error' || type === 'validation') {
          priority = 'critical';
        }
        // Critical: Failed network requests
        else if (type === 'network') {
          const desc = step.querySelector('.step-description')?.textContent || '';
          if (desc.includes('❌')) priority = 'critical';
          else if (desc.includes('⚠️')) priority = 'high'; // Slow network = high
          else priority = 'medium'; // Regular network requests
        }
        // High: All button clicks
        else if (type === 'click') {
          priority = 'high';
        }
        // High: All inputs
        else if (type === 'input') {
          priority = 'high';
        }
        // High: Navigation
        else if (type === 'navigation') {
          priority = 'high';
        }
        // Low: Scroll events
        else if (type === 'scroll') {
          priority = 'low';
        }
        
        priorities.push(priority);
      });
      
      return priorities;
    }
    
    function updateCompactSummary(total, kept) {
      const removed = total - kept;
      const percentage = total > 0 ? Math.round((removed / total) * 100) : 0;
      document.getElementById('compactStats').innerHTML = 
        \`Showing <strong>\${kept}</strong> of \${total} steps (\${percentage}% hidden) - 
        Showing only HIGH and CRITICAL priority actions (clicks, inputs, errors, failed requests)\`;
    }
  </script>
</body>
</html>`;
}

function generateTextReport(steps, settings) {
  const timestamp = new Date().toLocaleString();
  let text = `ICOS BUG RECREATION REPORT\n`;
  text += `Generated: ${timestamp}\n`;
  text += `Total Steps: ${steps.length}\n`;
  text += `${'='.repeat(60)}\n\n`;
  
  steps.forEach((step, index) => {
    text += `STEP ${index + 1}: ${step.type.toUpperCase()}\n`;
    if (settings.includeTimestamps) {
      text += `Time: ${new Date(step.timestamp).toLocaleTimeString()}\n`;
    }
    text += `Description: ${step.description}\n`;
    if (step.details) {
      if (step.details.fieldLabel) text += `Field: ${step.details.fieldLabel}\n`;
      if (step.details.label) text += `Element: ${step.details.label}\n`;
      if (step.details.stepper) text += `Stepper: ${step.details.stepper}\n`;
      if (step.details.value !== undefined) text += `Value: ${step.details.value}\n`;
      if (step.details.text && !step.details.label) text += `Text: ${step.details.text}\n`;
      if (step.details.error) text += `Error: ${step.details.error}\n`;
      if (step.details.validationMessage) text += `Validation: ${step.details.validationMessage}\n`;
      if (step.details.method) text += `Method: ${step.details.method}\n`;
      if (step.details.status) text += `Status: ${step.details.status}\n`;
      if (step.details.duration) text += `Duration: ${step.details.duration}ms\n`;
      if (settings.includeUrls && step.url) text += `URL: ${step.url}\n`;
      
      // Include full request body for network requests (beautified JSON)
      if (step.details.requestBody) {
        text += `\nRequest Body:\n`;
        text += beautifyJson(step.details.requestBody);
        text += `\n`;
      }
      
      // Include full response body for network requests (beautified JSON)
      if (step.details.responseBody) {
        text += `\nResponse Body:\n`;
        text += beautifyJson(step.details.responseBody);
        text += `\n`;
      }
      
      // Include error message if present
      if (step.details.errorMessage) {
        text += `Error Message: ${step.details.errorMessage}\n`;
      }
      
      // Include field mappings for network requests
      if (step.details.fieldMappings && step.details.fieldMappings.length > 0) {
        text += `Field Mapping:\n`;
        step.details.fieldMappings.forEach(m => {
          text += `  - ${m.propPath}: "${m.value}" <- from "${m.sourceField}"\n`;
        });
      }
    }
    text += `${'-'.repeat(60)}\n\n`;
  });
  
  return text;
}

// Beautify JSON for text output - ensures proper formatting without truncation
function beautifyJson(data) {
  if (!data) return '';
  
  // If it's already a string, try to parse and re-stringify for consistent formatting
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // If it's not valid JSON, return as-is
      return data;
    }
  }
  
  // If it's an object, stringify with formatting
  return JSON.stringify(data, null, 2);
}

function mergeSteps(steps) {
  // First, remove duplicates from the data
  const deduplicated = removeDuplicates(steps);
  console.log('After deduplication:', deduplicated.length, 'steps (removed', steps.length - deduplicated.length, 'duplicates)');
  
  const merged = [];
  let i = 0;
  
  while (i < deduplicated.length) {
    const current = deduplicated[i];
    
    // Skip unnecessary clicks on containers/wrappers
    if (current.type === 'click' && isContainerClick(current)) {
      i++;
      continue;
    }
    
    // Merge dropdown selection (click to open + click option)
    if (current.type === 'click' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      // Check if this is opening a dropdown and next is selecting an option
      if (next.type === 'click' && 
          isDropdownOpen(current) && 
          isDropdownOption(next) &&
          next.timestamp - current.timestamp < 3000) {
        
        merged.push({
          type: 'input',
          description: `Selected "${next.details?.text || ''}" in ${current.details?.label || 'dropdown'}`,
          timestamp: current.timestamp,
          url: current.url,
          details: {
            fieldLabel: current.details?.label,
            fieldType: 'select',
            value: next.details?.text,
            selector: next.details?.selector
          }
        });
        i += 2;
        continue;
      }
    }
    
    // Merge duplicate input + change events
    if (current.type === 'input' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      if (next.type === 'input' && 
          current.details?.fieldName === next.details?.fieldName &&
          next.timestamp - current.timestamp < 100) {
        // Skip the duplicate, keep the first one
        merged.push(current);
        i += 2;
        continue;
      }
    }
    
    // Deduplicate consecutive navigation events
    if (current.type === 'navigation' && i + 1 < deduplicated.length) {
      const next = deduplicated[i + 1];
      
      if (next.type === 'navigation' && 
          current.url === next.url &&
          next.timestamp - current.timestamp < 1000) {
        merged.push(current);
        i += 2;
        continue;
      }
    }
    
    merged.push(current);
    i++;
  }
  
  return merged;
}

// Remove duplicate steps based on type, description, and key details
function removeDuplicates(steps) {
  const seen = new Map(); // Map to track seen steps with their timestamps
  const result = [];
  
  for (const step of steps) {
    const key = generateStepKey(step);
    const existingEntry = seen.get(key);
    
    // Check if we've seen this step before
    if (existingEntry) {
      const timeDiff = Math.abs(step.timestamp - existingEntry.timestamp);
      
      // If same step within 5 seconds, consider it a duplicate
      if (timeDiff < 5000) {
        console.log('Removing duplicate:', step.type, '-', step.description?.substring(0, 50));
        continue; // Skip this duplicate
      }
      
      // If it's been more than 5 seconds, it might be a legitimate repeated action
      // Update the seen entry for future comparison
      seen.set(key, { timestamp: step.timestamp, index: result.length });
    } else {
      seen.set(key, { timestamp: step.timestamp, index: result.length });
    }
    
    result.push(step);
  }
  
  return result;
}

// Generate a unique key for a step based on its type and key details
function generateStepKey(step) {
  const d = step.details || {};
  
  switch (step.type) {
    case 'click':
      // Key based on element clicked (label, text, or selector)
      return `click:${d.label || d.text || d.selector || ''}:${d.name || ''}`;
      
    case 'input':
      // Key based on field and value
      return `input:${d.fieldName || d.fieldLabel || d.selector || ''}:${d.value || ''}`;
      
    case 'navigation':
      // Key based on URL
      return `navigation:${step.url || ''}`;
      
    case 'scroll':
      // For scroll, round positions to avoid minor differences
      const x = Math.round((d.x || 0) / 100) * 100;
      const y = Math.round((d.y || 0) / 100) * 100;
      return `scroll:${x}:${y}`;
      
    case 'validation':
      // Key based on field and validation message
      return `validation:${d.fieldName || d.fieldLabel || ''}:${d.validationMessage || ''}`;
      
    case 'error':
      // Key based on error message
      return `error:${d.error || step.description || ''}`;
      
    case 'network':
      // Key based on method, URL path, and status
      const urlPath = getPathFromUrl(d.url || '');
      return `network:${d.method || ''}:${urlPath}:${d.status || ''}`;
      
    default:
      // Fallback: use type and description
      return `${step.type}:${step.description || ''}`;
  }
}

// Extract path from URL for comparison
function getPathFromUrl(url) {
  try {
    const urlObj = new URL(url, window.location?.origin || 'http://localhost');
    return urlObj.pathname;
  } catch (e) {
    return url;
  }
}

function isContainerClick(step) {
  const d = step.details || {};
  // Skip clicks on generic containers without meaningful text
  if (d.element === 'div' && !d.text && !d.label) return true;
  if (d.element === 'span' && !d.text && !d.label) return true;
  if (d.selector?.includes('mat-select-value') && !d.text) return true;
  return false;
}

function isDropdownOpen(step) {
  const d = step.details || {};
  // Check if this is clicking to open a dropdown
  return d.label || 
         d.selector?.includes('mat-select') ||
         d.selector?.includes('mat-form-field') ||
         d.text?.toLowerCase().includes('select');
}

function isDropdownOption(step) {
  const d = step.details || {};
  // Check if this is selecting an option
  return d.selector?.includes('mat-option') || 
         d.name?.includes('mat-option');
}

function downloadHTML(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `icos-bug-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
