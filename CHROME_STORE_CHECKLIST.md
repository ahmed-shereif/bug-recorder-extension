# Chrome Web Store Submission Checklist

## ✅ Pre-Submission Verification (Completed)

### 1. Manifest.json ✓
- [x] Version: 1.0.1
- [x] Name: Bug Recorder
- [x] Description: "Capture user interactions and generate bug recreation reports"
- [x] All permissions defined
- [x] Icons properly referenced

### 2. Icons ✓
- [x] icon-main-16.png (16x16)
- [x] icon-main-48.png (48x48)
- [x] icon-main-128.png (128x128)

### 3. Version Number ✓
- [x] Consistent across manifest.json and package.json: 1.0.1

### 4. Console.log Removal ✓
- [x] Build script updated to remove console.log in production
- [x] `drop: ['console', 'debugger']` added to esbuild config

## 📋 Before Upload

### Build for Production
```bash
npm run clean
npm run build
```

### Create ZIP Package
```bash
cd dist
zip -r ../bug-recorder-extension.zip .
cd ..
```

### Verify Build
- [ ] Check dist/ folder contains all files
- [ ] Test the extension from dist/ folder
- [ ] Verify no console.log in built files:
  ```bash
  grep -r "console\.log" dist/*.js
  ```

## 📝 Chrome Web Store Information

### Required Information

**Store Listing:**
- **Name:** Bug Recorder
- **Summary:** Capture user interactions and generate bug recreation reports
- **Category:** Developer Tools
- **Language:** English

**Description Template:**
```
Bug Recorder helps developers and QA teams capture and document bugs efficiently.

KEY FEATURES:
• Record user interactions (clicks, inputs, navigation)
• Capture network requests and responses
• Automatic screenshot capture
• Generate detailed bug reports
• Export reports as HTML

PERFECT FOR:
• QA Engineers documenting bugs
• Developers reproducing issues
• Support teams capturing user problems
• Product teams tracking user flows

HOW IT WORKS:
1. Click the extension icon
2. Start recording
3. Perform the actions that cause the bug
4. Stop recording
5. Export a comprehensive bug report

All data is stored locally. No data is sent to external servers.
```

**Screenshots Needed:**
- Extension popup (1280x800 or 640x400)
- Recording in progress
- Generated bug report
- Settings panel

**Privacy:**
- [ ] Privacy policy URL (if collecting any data)
- [ ] Explain data usage: "All data stored locally, no external transmission"

**Permissions Justification:**
```
• activeTab: Capture user interactions on the current tab
• storage: Save recording sessions and user settings
• scripting: Inject content scripts for event capture
• tabs: Manage recording across browser tabs
• unlimitedStorage: Store screenshots and network data
• <all_urls>: Record interactions on any website
```

## 🚀 Upload Steps

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click "New Item"
3. Upload `bug-recorder-extension.zip`
4. Fill in all required fields
5. Upload screenshots (at least 1, max 5)
6. Set pricing: Free
7. Select distribution countries
8. Submit for review

## ⏱️ Timeline
- First submission: 3-7 days
- Updates: 1-3 days

## 📌 Post-Submission
- [ ] Monitor review status
- [ ] Respond to any review feedback
- [ ] Update documentation with store link
