/**
 * JavaScript that gets embedded in the HTML report for interactivity
 */

export const reportScript = `
    let currentExpandedScreenshot = null;
    
    function expandScreenshot(img) {
      if (currentExpandedScreenshot && currentExpandedScreenshot !== img) {
        currentExpandedScreenshot.classList.remove('expanded');
      }
      img.classList.add('expanded');
      currentExpandedScreenshot = img;
    }
    
    document.addEventListener('click', function(e) {
      if (currentExpandedScreenshot && !e.target.classList.contains('screenshot')) {
        currentExpandedScreenshot.classList.remove('expanded');
        currentExpandedScreenshot = null;
      }
    });
    
    // ==========================================
    // Network Card Functions
    // ==========================================
    
    function switchNetworkTab(tabEl, cardId, tabName) {
      const card = tabEl.closest('.network-card');
      card.querySelectorAll('.network-tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.network-content').forEach(c => c.classList.remove('active'));
      tabEl.classList.add('active');
      const content = document.getElementById(cardId + '-' + tabName);
      if (content) {
        content.classList.add('active');
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
    
    function renderJsonTree(container, data, depth = 0) {
      container.innerHTML = '';
      const tree = createJsonNode(data, depth, true);
      container.appendChild(tree);
    }
    
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
    
    function copyJsonToClipboard(dataId) {
      const dataScript = document.getElementById(dataId);
      if (dataScript) {
        try {
          const jsonData = JSON.parse(dataScript.textContent);
          const formatted = JSON.stringify(jsonData, null, 2);
          navigator.clipboard.writeText(formatted).then(() => {
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
    
    function expandAllJson(treeId) {
      const tree = document.getElementById(treeId);
      if (!tree) return;
      const collapsedToggles = tree.querySelectorAll('.json-tree-toggle.collapsed');
      let count = 0;
      collapsedToggles.forEach(toggle => {
        toggleJsonNode(toggle);
        count++;
      });
      showButtonFeedback(event.target, '✓ Expanded ' + count);
    }
    
    function collapseAllJson(treeId) {
      const tree = document.getElementById(treeId);
      if (!tree) return;
      const expandedToggles = Array.from(tree.querySelectorAll('.json-tree-toggle.expanded'));
      let count = 0;
      expandedToggles.slice(1).forEach(toggle => {
        toggleJsonNode(toggle);
        count++;
      });
      showButtonFeedback(event.target, '✓ Collapsed ' + count);
    }
    
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
    
    function toggleRawJson(contentId) {
      const content = document.getElementById(contentId);
      if (!content) return;
      const tree = content.querySelector('.json-tree');
      const rawView = content.querySelector('.raw-json-view');
      const dataScript = content.querySelector('script[type="application/json"]');
      const toggleBtn = content.querySelector('.json-action-btn:last-child');
      if (rawView.classList.contains('active')) {
        rawView.classList.remove('active');
        tree.style.display = 'block';
        if (toggleBtn) {
          toggleBtn.textContent = '📄 Raw JSON';
          toggleBtn.classList.remove('active');
        }
      } else {
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
    
    const searchState = {};
    
    function searchInNetworkCard(cardId, query) {
      const resultsEl = document.getElementById(cardId + '-search-results');
      const clearBtn = document.getElementById(cardId + '-search-clear');
      const prevBtn = document.getElementById(cardId + '-search-prev');
      const nextBtn = document.getElementById(cardId + '-search-next');
      clearSearchHighlights(cardId);
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
      const requestData = document.getElementById(cardId + '-request-data');
      if (requestData) {
        highlightInJsonTree(cardId + '-request-tree', searchLower);
        highlightInRawView(cardId + '-request-raw', requestData.textContent, searchLower);
      }
      const responseData = document.getElementById(cardId + '-response-data');
      if (responseData) {
        highlightInJsonTree(cardId + '-response-tree', searchLower);
        highlightInRawView(cardId + '-response-raw', responseData.textContent, searchLower);
      }
      const searchInput = document.getElementById(cardId + '-search');
      let allHighlights = [];
      if (searchInput) {
        const card = searchInput.closest('.network-card');
        if (card) {
          const activeContents = card.querySelectorAll('.network-content.active');
          activeContents.forEach(content => {
            allHighlights = allHighlights.concat(Array.from(content.querySelectorAll('.search-highlight')));
          });
        }
      }
      searchState[cardId].matches = allHighlights;
      const totalMatches = searchState[cardId].matches.length;
      if (totalMatches > 0) {
        resultsEl.className = 'network-search-results has-results';
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        searchState[cardId].currentIndex = 0;
        updateCurrentMatch(cardId);
      } else {
        resultsEl.textContent = 'No matches';
        resultsEl.className = 'network-search-results no-results';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }
    
    function updateCurrentMatch(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      state.matches.forEach(m => m.classList.remove('current'));
      const currentMatch = state.matches[state.currentIndex];
      if (currentMatch) {
        currentMatch.classList.add('current');
        scrollToMatch(currentMatch);
      }
      const resultsEl = document.getElementById(cardId + '-search-results');
      resultsEl.textContent = (state.currentIndex + 1) + ' of ' + state.matches.length;
    }
    
    function scrollToMatch(element) {
      if (!element) return;
      const container = element.closest('.network-content');
      if (container) {
        let elementTop = 0;
        let elementLeft = 0;
        let currentElement = element;
        while (currentElement && currentElement !== container) {
          elementTop += currentElement.offsetTop;
          elementLeft += currentElement.offsetLeft;
          currentElement = currentElement.offsetParent;
        }
        const containerHeight = container.clientHeight;
        const elementHeight = element.offsetHeight;
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        const containerWidth = container.clientWidth;
        const elementWidth = element.offsetWidth;
        if (elementLeft < container.scrollLeft) {
          container.scrollTo({ left: Math.max(0, elementLeft - 20), behavior: 'smooth' });
        } else if (elementLeft + elementWidth > container.scrollLeft + containerWidth) {
          container.scrollTo({ left: elementLeft + elementWidth - containerWidth + 20, behavior: 'smooth' });
        }
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }
    
    function searchNext(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      state.currentIndex = (state.currentIndex + 1) % state.matches.length;
      updateCurrentMatch(cardId);
    }
    
    function searchPrev(cardId) {
      const state = searchState[cardId];
      if (!state || state.matches.length === 0) return;
      state.currentIndex = (state.currentIndex - 1 + state.matches.length) % state.matches.length;
      updateCurrentMatch(cardId);
    }
    
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
    
    function escapeRegex(str) {
      return str.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
    }
    
    function clearSearchHighlights(cardId) {
      ['request', 'response'].forEach(type => {
        const tree = document.getElementById(cardId + '-' + type + '-tree');
        const rawView = document.getElementById(cardId + '-' + type + '-raw');
        const dataScript = document.getElementById(cardId + '-' + type + '-data');
        if (tree) {
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
      searchState[cardId] = { matches: [], currentIndex: 0 };
      clearSearchHighlights(cardId);
    }
    
    function escapeHtmlJs(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    
    document.addEventListener('DOMContentLoaded', function() {
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
      document.getElementById('filter-validation-only').checked = false;
      document.getElementById('filter-api-only').checked = false;
      const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]:not(#filter-screenshots):not(#filter-validation-only):not(#filter-api-only)');
      const selectedTypes = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
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
      document.getElementById('visibleCount').textContent = 'Showing ' + visibleCount + ' of ' + steps.length + ' steps';
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
      if (validationOnly) {
        document.getElementById('filter-api-only').checked = false;
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
        filterSteps();
      }
      updateVisibleCount();
    }
    
    function toggleAPIOnly() {
      const apiOnly = document.getElementById('filter-api-only').checked;
      if (apiOnly) {
        document.getElementById('filter-validation-only').checked = false;
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
        filterSteps();
      }
      updateVisibleCount();
    }
    
    function updateVisibleCount() {
      const steps = document.querySelectorAll('.step');
      const visibleSteps = Array.from(steps).filter(s => !s.classList.contains('hidden'));
      document.getElementById('visibleCount').textContent = 'Showing ' + visibleSteps.length + ' of ' + steps.length + ' steps';
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
      const priorities = calculateStepPriorities(allStepsData);
      let keptCount = 0;
      steps.forEach((step, index) => {
        const priority = priorities[index];
        step.setAttribute('data-priority', priority);
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
        const capturedPriority = step.getAttribute('data-captured-priority');
        if (capturedPriority) {
          priorities.push(capturedPriority);
          return;
        }
        let priority = 'low';
        if (type === 'error' || type === 'validation') {
          priority = 'critical';
        } else if (type === 'network') {
          const desc = step.querySelector('.step-description')?.textContent || '';
          if (desc.includes('❌')) priority = 'critical';
          else if (desc.includes('⚠️')) priority = 'high';
          else priority = 'medium';
        } else if (type === 'click') {
          priority = 'high';
        } else if (type === 'input') {
          priority = 'high';
        } else if (type === 'navigation') {
          priority = 'high';
        } else if (type === 'scroll') {
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
        'Showing <strong>' + kept + '</strong> of ' + total + ' steps (' + percentage + '% hidden) - ' +
        'Showing only HIGH and CRITICAL priority actions (clicks, inputs, errors, failed requests)';
    }
`;


