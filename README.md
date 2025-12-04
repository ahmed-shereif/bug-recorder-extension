# Bug Recorder Chrome Extension

A Chrome extension for capturing user interactions and generating bug recreation reports.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Documentation

- [Full Documentation](docs/README.md) - Complete feature guide
- [Installation Guide](docs/INSTALLATION.md) - Detailed setup instructions  
- [Quick Start Guide](docs/QUICKSTART.md) - 5-minute setup guide

## Project Structure

```
├── assets/          # Icons and static assets
├── docs/           # Documentation files
├── scripts/        # Build and utility scripts
├── src/            # Source code
│   ├── background/ # Service worker
│   ├── content/    # Content script and listeners
│   ├── popup/      # Extension popup UI
│   ├── report/     # Report generation
│   └── shared/     # Common utilities
├── dist/           # Built extension (generated)
├── manifest.json   # Extension manifest
└── popup.html      # Popup HTML template
```

## Development

- `npm run build` - Build for production
- `npm run watch` - Build and watch for changes
- `npm run clean` - Clean build directory

## Version

1.0.1