/**
 * CSS styles for the HTML bug report
 */

export const reportStyles = `
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
`;


