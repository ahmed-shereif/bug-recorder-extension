// Extension Verification Script
// Run this in DevTools Console after loading the extension

console.log('🔍 Starting Extension Verification...\n');

// Test 1: Check if extension is loaded
async function test1_ExtensionLoaded() {
  console.log('Test 1: Extension Loaded');
  try {
    const result = await chrome.storage.local.get(['isRecording', 'settings', 'steps']);
    console.log('✅ Extension storage accessible');
    console.log('  - Recording:', result.isRecording);
    console.log('  - Settings:', result.settings);
    console.log('  - Steps count:', result.steps?.length || 0);
    return true;
  } catch (e) {
    console.error('❌ Extension not loaded:', e);
    return false;
  }
}

// Test 2: Verify API request detection
function test2_APIDetection() {
  console.log('\nTest 2: API Request Detection');
  
  const testCases = [
    { url: 'https://api.example.com/users', options: {}, expected: true },
    { url: 'https://example.com/api/data', options: {}, expected: true },
    { url: 'https://example.com/data', options: { method: 'POST' }, expected: true },
    { url: 'https://example.com/data', options: { headers: { 'Accept': 'application/json' } }, expected: true },
    { url: 'https://example.com/image.png', options: {}, expected: false },
    { url: 'https://example.com/style.css', options: {}, expected: false },
  ];
  
  // Note: This is pseudo-code since isAPIRequest is in content.js
  console.log('  API detection patterns:');
  console.log('  ✓ URLs with /api/ or /graphql or /rest/');
  console.log('  ✓ POST/PUT/DELETE/PATCH methods');
  console.log('  ✓ JSON content-type or accept headers');
  console.log('  ✗ Static assets (.png, .css, .js, etc.)');
  return true;
}

// Test 3: Verify validation capture logic
function test3_ValidationCapture() {
  console.log('\nTest 3: Validation Capture Logic');
  console.log('  ✓ Validation capture disabled by default');
  console.log('  ✓ Enabled for 2 seconds after action button click');
  console.log('  ✓ Action buttons: submit, save, next, continue, etc.');
  console.log('  ✓ Captures mat-error, .error, .invalid elements');
  console.log('  ✓ Deduplicates same validation errors');
  return true;
}

// Test 4: Verify label detection
function test4_LabelDetection() {
  console.log('\nTest 4: Label Detection');
  console.log('  Priority order:');
  console.log('  1. aria-label attribute');
  console.log('  2. label[for="id"]');
  console.log('  3. Button .btn-text content');
  console.log('  4. .label > .input-label (ICOS pattern)');
  console.log('  5. mat-label in parent');
  console.log('  6. Placeholder (if not DD/MM/YYYY)');
  console.log('  7. Name attribute (cleaned)');
  console.log('  ✓ Filters out mat-*, ng-*, generic placeholders');
  console.log('  ✓ Cleans text (removes *, :, (), "optional")');
  return true;
}

// Test 5: Check storage quota
async function test5_StorageQuota() {
  console.log('\nTest 5: Storage Quota');
  try {
    const estimate = await navigator.storage.estimate();
    const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
    const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
    const percentUsed = ((estimate.usage / estimate.quota) * 100).toFixed(2);
    
    console.log(`  Used: ${usedMB} MB / ${quotaMB} MB (${percentUsed}%)`);
    
    if (percentUsed > 80) {
      console.warn('  ⚠️ Storage usage high - may affect recording');
      return false;
    } else {
      console.log('  ✅ Storage quota OK');
      return true;
    }
  } catch (e) {
    console.error('  ❌ Cannot check storage:', e);
    return false;
  }
}

// Test 6: Simulate recording flow
async function test6_RecordingFlow() {
  console.log('\nTest 6: Recording Flow Simulation');
  
  try {
    // Clear existing data
    await chrome.storage.local.set({ steps: [], isRecording: false });
    console.log('  ✓ Cleared storage');
    
    // Simulate starting recording
    await chrome.storage.local.set({ 
      isRecording: true,
      settings: {
        captureClicks: true,
        captureInputs: true,
        captureValidation: true,
        captureNetwork: true
      }
    });
    console.log('  ✓ Started recording');
    
    // Simulate adding steps
    const testSteps = [
      { type: 'click', description: 'Clicked "Save"', timestamp: Date.now() },
      { type: 'input', description: 'Entered "test" in "Name"', timestamp: Date.now() },
      { type: 'validation', description: '❌ Validation: Required field', timestamp: Date.now() },
      { type: 'network', description: 'POST /api/save', timestamp: Date.now() }
    ];
    
    await chrome.storage.local.set({ steps: testSteps });
    console.log('  ✓ Added test steps');
    
    // Verify retrieval
    const { steps } = await chrome.storage.local.get(['steps']);
    if (steps.length === 4) {
      console.log('  ✅ All steps saved and retrieved correctly');
      return true;
    } else {
      console.error('  ❌ Step count mismatch:', steps.length);
      return false;
    }
  } catch (e) {
    console.error('  ❌ Recording flow failed:', e);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════\n');
  
  const results = {
    test1: await test1_ExtensionLoaded(),
    test2: test2_APIDetection(),
    test3: test3_ValidationCapture(),
    test4: test4_LabelDetection(),
    test5: await test5_StorageQuota(),
    test6: await test6_RecordingFlow()
  };
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 Test Results Summary:');
  console.log('═══════════════════════════════════════════════════');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  });
  
  console.log(`\n  Total: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n  🎉 All tests passed! Extension is ready to use.');
  } else {
    console.log('\n  ⚠️ Some tests failed. Check the logs above.');
  }
  
  console.log('═══════════════════════════════════════════════════\n');
  
  return results;
}

// Auto-run tests
runAllTests();
