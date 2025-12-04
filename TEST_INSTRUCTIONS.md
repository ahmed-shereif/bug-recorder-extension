# Bug Recorder Extension - Test Instructions

## Prerequisites
1. Load the extension in Chrome (chrome://extensions/)
2. Enable Developer Mode
3. Click "Load unpacked" and select the bug-recorder-extension folder

## Test Procedure

### 1. Open Test Suite
Open `test-suite.html` in Chrome browser

### 2. Start Recording
1. Click the extension icon
2. Ensure all capture options are checked:
   - ✓ Clicks
   - ✓ Form Inputs
   - ✓ Navigation
   - ✓ Console Errors
   - ✓ Validation Errors
   - ✓ API Requests
3. Click "▶️ Start Recording"
4. Open DevTools Console (F12) to monitor logs

### 3. Run Tests

#### Test 1: Click Detection
- Click each button (1.1, 1.2, 1.3)
- **Expected Console Logs:**
  - "Bug Recorder: Recording step X: Clicked 'Save Changes'"
  - "Bug Recorder: Recording step X: Clicked 'Submit Form'"
  - "Bug Recorder: Recording step X: Clicked 'Next Step'"
- **Pass Criteria:** All button clicks captured with correct labels

#### Test 2: Input Detection
- Type in each input field (2.1, 2.2, 2.3)
- Check the checkbox (2.4)
- Select an option from dropdown (2.5)
- **Expected Console Logs:**
  - "Bug Recorder: Recording step X: Entered '[value]' in 'Claim Amount'"
  - "Bug Recorder: Recording step X: Entered '[value]' in 'Policy Number'"
  - "Bug Recorder: Recording step X: Checked 'Accept Terms and Conditions'"
  - "Bug Recorder: Recording step X: Selected '[option]' in 'Claim Type'"
- **Pass Criteria:** All inputs captured with correct field labels

#### Test 3: Validation Capture
- Click "Submit" button without filling required field
- **Expected Console Logs:**
  - "Bug Recorder: Recording step X: Clicked 'Submit'"
  - "Bug Recorder: Recording step X: ❌ Validation: This field is required"
- **Pass Criteria:** Validation error captured ONLY after submit click

#### Test 4: API Request Capture
- Click "Test Fetch API" button
- Click "Test XMLHttpRequest" button
- Click "Test POST Request" button
- **Expected Console Logs:**
  - "Bug Recorder: Intercepted fetch: GET https://jsonplaceholder.typicode.com/posts/1"
  - "Bug Recorder: Capturing API request..."
  - "Bug Recorder: Recording network request: GET /posts/1"
- **Pass Criteria:** All API requests captured with status and duration

#### Test 5: Error Capture
- Click "Trigger Error" button
- **Expected Console Logs:**
  - "Bug Recorder: Recording step X: Console Error: Test error for bug recorder"
- **Pass Criteria:** Error captured in steps

### 4. Verify Storage
1. Click "Check Extension Storage" button
2. **Expected Results:**
   - Recording Status: 🔴 Recording
   - Total Steps: 15+ steps
   - Steps by Type:
     - click: 8+
     - input: 4+
     - validation: 1+
     - network: 3+
     - error: 1+

### 5. Stop Recording & Export
1. Click extension icon
2. Click "⏹️ Stop Recording"
3. Click "📥 Download Report (HTML)"
4. **Expected:** HTML file downloads successfully

### 6. Verify Report
1. Open downloaded HTML report
2. **Check:**
   - ✓ All steps are listed
   - ✓ Field labels are shown (not mat-input-XXX)
   - ✓ Button labels are shown (not mat-button-XXX)
   - ✓ Network requests are visible with status
   - ✓ Validation errors are shown
   - ✓ Compact view works
   - ✓ Filters work

## Expected Test Results

### ✅ Pass Criteria
- [ ] All clicks captured with readable labels
- [ ] All inputs captured with field names
- [ ] Validation errors captured only on submit
- [ ] API requests captured with details
- [ ] Console errors captured
- [ ] Report generates successfully
- [ ] Report is readable (no technical IDs)
- [ ] Compact view shows important steps
- [ ] No duplicate steps

### ❌ Common Issues
1. **"No steps recorded"** → Check console for "Not recording" messages
2. **"mat-input-174" in report** → Label detection failed
3. **No API requests** → Check "API Requests" is enabled
4. **No validation errors** → Must click submit button first

## Automated Console Checks

Run in DevTools Console after tests:

```javascript
// Check if recording
chrome.storage.local.get(['isRecording', 'steps'], (result) => {
  console.log('Recording:', result.isRecording);
  console.log('Steps:', result.steps?.length);
  console.log('Types:', [...new Set(result.steps?.map(s => s.type))]);
});
```

## Success Metrics
- ✅ 100% of clicks have readable labels
- ✅ 100% of inputs have field names
- ✅ 0 technical IDs (mat-*, ng-*) in descriptions
- ✅ All API requests captured
- ✅ Validation only captured on action
- ✅ Report file size < 5MB (with compression)
