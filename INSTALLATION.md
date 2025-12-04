# Installation Guide

## Quick Start

### 1. Create Icon Files (Required)

The extension needs icon files. Create them using one of these methods:

#### Option A: Use Online Tool (Easiest)
1. Go to https://www.favicon-generator.org/
2. Upload any image or create a simple icon with text "BR" (Bug Recorder)
3. Download the generated icons
4. Rename them to: `icon16.png`, `icon48.png`, `icon128.png`
5. Place them in the `bug-recorder-extension` folder

#### Option B: Use Existing Image
1. Find any PNG image (company logo, screenshot, etc.)
2. Use an image editor or online tool to resize to 16x16, 48x48, and 128x128 pixels
3. Save as `icon16.png`, `icon48.png`, `icon128.png`
4. Place in the `bug-recorder-extension` folder

#### Option C: Temporary Workaround
For testing, you can temporarily remove icon references:
1. Open `manifest.json`
2. Remove the `"icons"` and `"default_icon"` sections
3. The extension will work but show a default Chrome icon

### 2. Load Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle switch in top-right corner)
4. Click **"Load unpacked"** button
5. Navigate to and select the `bug-recorder-extension` folder
6. Click **"Select Folder"**

### 3. Verify Installation

You should see:
- ✅ Extension card appears in the extensions page
- ✅ Extension icon in Chrome toolbar (or puzzle piece icon)
- ✅ No errors in the extension card

### 4. Pin Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "ICOS Bug Recorder"
3. Click the pin icon to keep it visible

## Testing the Extension

1. Navigate to your ICOS application
2. Click the extension icon
3. Click "▶️ Start Recording"
4. Perform some actions (click buttons, fill forms)
5. Click "⏹️ Stop Recording"
6. Click "📥 Download Report (HTML)"
7. Open the downloaded HTML file

## Troubleshooting

### "Manifest file is missing or unreadable"
- Ensure all files are in the same folder
- Check that `manifest.json` exists and is valid JSON

### "Could not load icon"
- Create the icon files as described above
- Or temporarily remove icon references from manifest.json

### Extension not appearing
- Refresh the extensions page
- Try reloading the extension
- Check for error messages in the extension card

### Recording not working
- Refresh the webpage after installing extension
- Check browser console for errors (F12)
- Ensure you clicked "Start Recording"

## File Structure

Your folder should contain:
```
bug-recorder-extension/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── background.js
├── README.md
├── INSTALLATION.md
├── icon16.png (create this)
├── icon48.png (create this)
└── icon128.png (create this)
```

## Next Steps

Once installed, read the [README.md](README.md) for usage instructions.
