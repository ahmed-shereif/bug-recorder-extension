# ICOS Bug Recorder Chrome Extension

A Chrome extension specifically designed for the ICOS Claims application to capture user interactions and generate bug recreation reports.

## Features

### Capture Options
- ✅ **Clicks** - Records all button clicks, links, and interactive elements
- ✅ **Form Inputs** - Captures text entry, dropdowns, checkboxes with field labels
- ✅ **Navigation** - Tracks page navigation and URL changes
- ✅ **Scrolling** - Records scroll positions (optional)
- ✅ **Console Errors** - Captures JavaScript errors and promise rejections
- ✅ **Validation Errors** - Detects Angular Material validation messages

### ICOS-Specific Features
- 🎯 **Stepper Detection** - Identifies which step in multi-step forms
- 🎯 **Angular Material Support** - Recognizes mat-form-field, mat-error, etc.
- 🎯 **Form Field Labels** - Captures field labels for better context
- 🎯 **Validation Messages** - Detects your custom validation error messages

### Report Options
- 📊 **Timestamps** - Include time for each action
- 🔗 **URLs** - Track which page each action occurred on
- 📸 **Screenshots** - Capture visual state at each step (optional)
- 📥 **Export Formats** - Download as HTML or copy as text

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `bug-recorder-extension` folder
5. The extension icon will appear in your toolbar

## Usage

### Recording a Bug

1. **Navigate to ICOS application** in your browser
2. **Click the extension icon** in the toolbar
3. **Configure capture settings** (checkboxes for what to record)
4. **Click "▶️ Start Recording"**
5. **Perform the steps** that lead to the bug
6. **Click "⏹️ Stop Recording"** when done

### Generating a Report

After recording:

1. **Download HTML Report**: Click "📥 Download Report (HTML)"
   - Opens a beautiful, formatted report in your browser
   - Includes all steps with descriptions and details
   - Can be shared with developers

2. **Copy to Clipboard**: Click "📋 Copy to Clipboard"
   - Copies plain text version
   - Paste into Jira, email, or chat

### Clearing Steps

Click "🗑️ Clear Steps" to remove all recorded steps and start fresh.

## Report Format

The generated report includes:

- **Step Number** - Sequential numbering
- **Step Type** - Click, Input, Navigation, Error, Validation, Scroll
- **Description** - Human-readable action description
- **Details**:
  - Element selector (CSS selector)
  - Field labels (from Angular Material forms)
  - Input values
  - Validation error messages
  - URLs (if enabled)
  - Timestamps (if enabled)
  - Screenshots (if enabled)

## Example Report Steps

```
Step 1: CLICK
Clicked on button: "Create New Claim"
Element: #createClaimBtn

Step 2: INPUT
Entered "12345" in field: Policy Number
Element: input#policyNumber

Step 3: VALIDATION
Validation Error: Policy Number is required
Validation: Policy Number is required

Step 4: CLICK
Clicked on button: "Next" - Stepper: Policy Details
Element: button.next-btn
```

## Tips for Best Results

1. **Start recording BEFORE** reproducing the bug
2. **Use descriptive field labels** in your forms (already done in ICOS)
3. **Enable validation capture** to catch form errors
4. **Enable screenshots** for visual bugs (increases file size)
5. **Stop recording** as soon as bug occurs
6. **Clear steps** between different bug reports

## Troubleshooting

**Extension not recording?**
- Refresh the page after installing
- Check that recording is started (red status)
- Verify capture settings are enabled

**Missing field labels?**
- Extension looks for mat-label, label, placeholder, aria-label
- Ensure your forms have proper labels

**Screenshots not working?**
- Requires activeTab permission
- May not work on chrome:// pages

## Technical Details

### Captured Elements
- Buttons, links, inputs, selects, checkboxes
- Angular Material components (mat-*)
- Stepper navigation (mat-step)
- Validation errors (mat-error)

### Storage
- Uses Chrome's local storage
- Steps persist across browser sessions
- Clear manually or by clearing steps

### Permissions
- `activeTab` - Capture current tab
- `storage` - Save recording state
- `scripting` - Inject content script
- `tabs` - Take screenshots

## Support

For issues or feature requests related to this extension, contact the development team.

## Version

1.0.0 - Initial release
