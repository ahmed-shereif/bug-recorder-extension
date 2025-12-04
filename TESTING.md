# Testing Guide - Bug Recorder Extension

## Quick Test (5 minutes)

### 1. Setup
1. Create icon files (see INSTALLATION.md)
2. Load extension in Chrome (chrome://extensions/)
3. Open `test-page.html` in Chrome

### 2. Test Recording
1. Click the extension icon
2. Verify all checkboxes are enabled
3. Click "▶️ Start Recording"
4. Status should show "🔴 Recording..."

### 3. Perform Actions
On the test page:
- ✅ Click the "Click Me" button
- ✅ Type "John Doe" in the Name field
- ✅ Type "test@example.com" in Email field
- ✅ Select "United States" from dropdown
- ✅ Check the "I agree" checkbox
- ✅ Click "Validate" button
- ✅ Click "Trigger Validation Error"

### 4. Stop & Verify
1. Click "⏹️ Stop Recording"
2. Check "Steps recorded" count (should be 7+)
3. Click "📥 Download Report (HTML)"
4. Open the downloaded file

### 5. Expected Results
You should see steps like:
```
Step 1: NAVIGATION
Recording started on /test-page.html

Step 2: CLICK
Clicked on button: "Click Me"

Step 3: INPUT
Entered "John Doe" in field: Name

Step 4: INPUT
Entered "test@example.com" in field: Email

Step 5: INPUT
Set "Country" to: us

Step 6: INPUT
Set "I agree to terms" to: true

Step 7: CLICK
Clicked on button: "Validate"

Step 8: VALIDATION
Validation Error: Email field is required
```

## Troubleshooting

### No Steps Recorded?

**Check Console Logs:**
1. Open test page
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Start recording
5. Look for messages like:
   - "Bug Recorder: Started recording"
   - "Bug Recorder: Recording step 1: ..."
   - "Bug Recorder: Step saved. Total steps: 1"

**If you see these messages:**
✅ Extension is working correctly
✅ Steps are being captured
✅ Check popup shows correct count

**If you DON'T see these messages:**
1. Refresh the page
2. Try reloading the extension
3. Check extension is enabled
4. Try clicking "Start Recording" again

### Extension Not Loading?

**Error: "Manifest file is missing"**
- Ensure all files are in the folder
- Check manifest.json is valid

**Error: "Could not load icon"**
- Create icon files (see INSTALLATION.md)
- Or temporarily remove icon references from manifest.json

### Steps Not Saving?

**Check Storage:**
1. Open extension popup
2. Press F12 in popup window
3. Go to Console
4. Type: `chrome.storage.local.get(['steps'], console.log)`
5. Press Enter
6. You should see your steps array

**If steps array is empty:**
- Content script may not be injected
- Try refreshing the page
- Check for JavaScript errors in console

### Screenshots Not Working?

This is normal! Screenshots require special permissions and may not work on all pages.

**To test screenshots:**
1. Enable "Screenshots" in settings
2. Record on a regular webpage (not chrome:// pages)
3. Check if screenshots appear in report

**If still not working:**
- This is optional feature
- Extension works fine without screenshots
- Focus on capturing steps first

## Advanced Testing

### Test on ICOS Application

1. **Navigate to ICOS app**
2. **Start recording**
3. **Perform a real workflow:**
   - Create a new claim
   - Fill policy details
   - Navigate through stepper
   - Trigger a validation error
   - Submit the form

4. **Stop recording**
5. **Check report includes:**
   - ✅ Stepper navigation
   - ✅ Form field labels
   - ✅ Validation errors
   - ✅ Button clicks
   - ✅ URLs for each step

### Test Each Capture Type

**Clicks:**
- Enable only "Clicks"
- Click various buttons
- Verify only clicks are captured

**Form Inputs:**
- Enable only "Form Inputs"
- Fill form fields
- Verify inputs are captured with labels

**Navigation:**
- Enable only "Navigation"
- Navigate between pages
- Verify URL changes are captured

**Validation:**
- Enable only "Validation Errors"
- Trigger form validation
- Verify error messages are captured

**Console Errors:**
- Enable only "Console Errors"
- Click "Trigger Console Error" on test page
- Verify error is captured

## Debugging Tips

### Enable Verbose Logging

The extension now includes console.log statements. To see them:

1. **For content script logs:**
   - Open the webpage
   - Press F12
   - Go to Console tab
   - Look for "Bug Recorder:" messages

2. **For popup logs:**
   - Right-click extension icon
   - Click "Inspect popup"
   - Go to Console tab

3. **For background script logs:**
   - Go to chrome://extensions/
   - Find Bug Recorder
   - Click "service worker" link
   - Check console

### Common Log Messages

**Good signs:**
```
Bug Recorder: Started recording
Bug Recorder: Initializing with settings: {...}
Bug Recorder: Click listener attached
Bug Recorder: Recording step 1: Clicked on button
Bug Recorder: Step saved. Total steps: 1
```

**Warning signs:**
```
Bug Recorder: Error saving step: ...
Screenshot error: ...
Error sending message: ...
```

### Manual Storage Check

Open console and run:

```javascript
// Check if recording
chrome.storage.local.get(['isRecording'], console.log);

// Check steps
chrome.storage.local.get(['steps'], console.log);

// Check settings
chrome.storage.local.get(['settings'], console.log);

// Clear all data
chrome.storage.local.clear();
```

## Performance Testing

### Test with Many Steps

1. Start recording
2. Perform 50+ actions quickly
3. Stop recording
4. Verify all steps captured
5. Check report generates correctly

**Expected:**
- All steps should be captured
- Report should load (may take a moment)
- No browser slowdown

### Test with Screenshots

1. Enable screenshots
2. Perform 10 actions
3. Stop recording
4. Download report

**Expected:**
- Report file will be larger
- May take longer to generate
- Screenshots should appear in report

## Validation Checklist

Before using in production:

- [ ] Extension loads without errors
- [ ] Can start/stop recording
- [ ] Clicks are captured
- [ ] Form inputs are captured with labels
- [ ] Validation errors are detected
- [ ] Console errors are captured
- [ ] Navigation is tracked
- [ ] Step count updates correctly
- [ ] HTML report generates
- [ ] Text report copies to clipboard
- [ ] Can clear steps
- [ ] Settings persist
- [ ] Works on test page
- [ ] Works on ICOS application

## Known Limitations

1. **Screenshots may not work on:**
   - chrome:// pages
   - file:// pages
   - Some secure pages

2. **Content script may not inject on:**
   - Browser internal pages
   - Extension pages
   - Some protected pages

3. **Validation detection works best with:**
   - Angular Material (mat-error)
   - Elements with "error" or "invalid" in class name
   - May miss custom validation styles

## Getting Help

If tests fail:

1. Check console logs (see Debugging Tips above)
2. Review INSTALLATION.md
3. Try on test-page.html first
4. Check all files are present
5. Reload extension
6. Refresh webpage

## Success Criteria

✅ **Extension is working if:**
- Steps are captured and counted
- Report generates with step details
- Console shows "Bug Recorder:" messages
- No errors in console

✅ **Ready for production if:**
- All validation checklist items pass
- Works on test page
- Works on ICOS application
- Team can reproduce bugs from reports

---

**Next Steps:**
- If tests pass: Start using for real bugs!
- If tests fail: Check console logs and troubleshooting section
- Need help: Review documentation or contact team
