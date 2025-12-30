# 📷 Save Image Tabs - Chrome Extension Template

A **comprehensive, well-documented Chrome extension template** for building extensions that work with browser tabs, specifically designed for bulk saving image tabs. This template includes all the essential components of a modern Chrome extension with extensive documentation to help you customize it for your own needs.

## 🌟 Features

- ✅ **Complete Chrome Extension Structure** - All necessary files and folders
- ✅ **Manifest V3** - Uses the latest Chrome extension manifest version
- ✅ **Background Service Worker** - Event-driven background processing
- ✅ **Popup Interface** - User-friendly popup with tab management
- ✅ **Content Scripts** - Interact with web pages
- ✅ **Options Page** - Comprehensive settings management
- ✅ **Storage API** - Save and sync user preferences
- ✅ **Downloads API** - Bulk download functionality
- ✅ **Keyboard Shortcuts** - Customizable commands
- ✅ **Extensive Documentation** - Every file is thoroughly documented

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [How to Load the Extension](#-how-to-load-the-extension)
- [Architecture Overview](#-architecture-overview)
- [Customization Guide](#-customization-guide)
- [API Reference](#-api-reference)
- [Development Tips](#-development-tips)
- [Common Patterns](#-common-patterns)
- [Debugging](#-debugging)
- [Publishing](#-publishing)
- [Resources](#-resources)

> 📚 **Need help navigating?** Check out [DOCS_INDEX.md](DOCS_INDEX.md) for a complete documentation guide with learning paths!

## 🚀 Quick Start

### Prerequisites

- Google Chrome or any Chromium-based browser (Edge, Brave, Opera, etc.)
- A code editor (VS Code, Sublime Text, etc.)
- Basic knowledge of HTML, CSS, and JavaScript

### Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/emkamal/save-image-tabs.git
   cd save-image-tabs
   ```

2. **Open Chrome and navigate to extensions**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `save-image-tabs` folder
   - The extension should now appear in your toolbar

4. **Test the extension**
   - Click the extension icon to open the popup
   - Open some image URLs in new tabs (e.g., direct links to .jpg, .png files)
   - Click the extension icon again to see detected image tabs
   - Click "Save All Images" to download them

## 📁 Project Structure

```
save-image-tabs/
├── manifest.json           # Extension configuration (REQUIRED)
├── README.md              # This file
├── DEVELOPMENT.md         # Detailed development guide
│
├── background/            # Background service worker
│   └── background.js      # Event handlers, message processing
│
├── popup/                 # Extension popup UI
│   ├── popup.html        # Popup structure
│   ├── popup.css         # Popup styles
│   └── popup.js          # Popup logic
│
├── content/               # Content scripts
│   └── content.js        # Scripts that run on web pages
│
├── options/               # Options/settings page
│   ├── options.html      # Settings page structure
│   ├── options.css       # Settings page styles
│   └── options.js        # Settings page logic
│
└── icons/                 # Extension icons
    ├── icon16.png        # 16x16 icon
    ├── icon48.png        # 48x48 icon
    ├── icon128.png       # 128x128 icon
    ├── icon.svg          # Source SVG icon
    └── ICONS_README.md   # Icon creation guide
```

## 🔧 How to Load the Extension

### Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Navigate to and select the extension folder
5. The extension icon should appear in your toolbar

### Loading in Other Browsers

**Microsoft Edge:**
- Navigate to `edge://extensions/`
- Follow the same steps as Chrome

**Brave:**
- Navigate to `brave://extensions/`
- Follow the same steps as Chrome

**Opera:**
- Navigate to `opera://extensions/`
- Follow the same steps as Chrome

## 🏗️ Architecture Overview

Chrome extensions consist of several components that work together:

### 1. **Manifest File (`manifest.json`)**
The manifest is the heart of every extension. It defines:
- Extension metadata (name, version, description)
- Permissions required
- Background scripts
- Content scripts
- UI components (popup, options page)
- Icons and resources

### 2. **Background Service Worker (`background/background.js`)**
Runs in the background and handles:
- Extension lifecycle events
- Message passing between components
- Browser events (tabs, downloads, etc.)
- Long-running operations
- State management

**Key Points:**
- Runs event-driven (starts when needed, stops when idle)
- No access to DOM
- Cannot use `window`, `document`, or `localStorage`
- Use `chrome.storage` for persistence

### 3. **Popup (`popup/popup.html`, `popup.css`, `popup.js`)**
The UI that appears when clicking the extension icon:
- Small, focused interface
- Closes when user clicks outside
- State doesn't persist between opens
- Good for quick actions

### 4. **Content Scripts (`content/content.js`)**
Run in the context of web pages:
- Can read and modify page DOM
- Run in isolated JavaScript context
- Cannot access page's JavaScript variables
- Communicate with background via message passing

### 5. **Options Page (`options/options.html`, `options.css`, `options.js`)**
Full-page settings interface:
- Opens in a tab
- Persists while open
- Good for complex settings
- Access via right-click extension icon → Options

## 🎨 Customization Guide

### Changing Extension Metadata

Edit `manifest.json`:

```json
{
  "name": "Your Extension Name",
  "version": "1.0.0",
  "description": "Your extension description",
  ...
}
```

### Adding New Permissions

In `manifest.json`, add to the `permissions` array:

```json
"permissions": [
  "tabs",
  "downloads",
  "storage",
  "activeTab",
  "notifications",    // Add this for notifications
  "contextMenus"      // Add this for context menus
]
```

### Modifying the Popup UI

1. **Structure:** Edit `popup/popup.html`
2. **Styles:** Edit `popup/popup.css`
3. **Logic:** Edit `popup/popup.js`

Example - Add a new button:

```html
<!-- In popup.html -->
<button id="myButton" class="btn btn-primary">My Action</button>
```

```javascript
// In popup.js
document.getElementById('myButton').addEventListener('click', () => {
  // Your action here
  console.log('Button clicked!');
});
```

### Adding Content Script Functionality

Edit `content/content.js` to interact with web pages:

```javascript
// Example: Highlight all images on a page
function highlightAllImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.style.border = '3px solid red';
  });
}
```

### Customizing Settings

1. Add new settings to `DEFAULT_SETTINGS` in `options/options.js`
2. Add UI controls in `options/options.html`
3. Update save/load logic in `options/options.js`

## 📚 API Reference

### Common Chrome Extension APIs

#### Storage API
```javascript
// Save data
chrome.storage.sync.set({ key: 'value' }, () => {
  console.log('Saved');
});

// Get data
chrome.storage.sync.get(['key'], (result) => {
  console.log('Value:', result.key);
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Changed:', changes);
});
```

#### Tabs API
```javascript
// Get all tabs
chrome.tabs.query({}, (tabs) => {
  console.log('All tabs:', tabs);
});

// Get current tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  console.log('Current tab:', tabs[0]);
});

// Create new tab
chrome.tabs.create({ url: 'https://example.com' });

// Update tab
chrome.tabs.update(tabId, { url: 'https://example.com' });

// Close tab
chrome.tabs.remove(tabId);
```

#### Downloads API
```javascript
// Download a file
chrome.downloads.download({
  url: 'https://example.com/image.jpg',
  filename: 'image.jpg',
  saveAs: false  // Don't show save dialog
}, (downloadId) => {
  console.log('Download started:', downloadId);
});

// Listen for download completion
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Download complete');
  }
});
```

#### Runtime API (Message Passing)
```javascript
// Send message from popup/content to background
chrome.runtime.sendMessage(
  { action: 'getData' },
  (response) => {
    console.log('Response:', response);
  }
);

// Send message to specific tab
chrome.tabs.sendMessage(
  tabId,
  { action: 'doSomething' },
  (response) => {
    console.log('Response:', response);
  }
);

// Listen for messages (in background or content script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    sendResponse({ data: 'some data' });
  }
  return true; // Required for async response
});
```

## 💡 Development Tips

### 1. Hot Reload During Development

When you make changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Reload any open extension pages (popup, options)
4. Refresh web pages for content script changes

### 2. Console Logging

Different parts log to different places:
- **Background:** Click "service worker" link in `chrome://extensions/`
- **Popup:** Right-click extension icon → Inspect popup
- **Options:** F12 on options page
- **Content Script:** F12 on web page

### 3. Use Async/Await

Modern Chrome APIs support promises:

```javascript
// Old way
chrome.storage.sync.get(['key'], (result) => {
  console.log(result.key);
});

// Better way
const result = await chrome.storage.sync.get(['key']);
console.log(result.key);
```

### 4. Error Handling

Always handle errors:

```javascript
try {
  const result = await chrome.storage.sync.get(['key']);
  // Use result
} catch (error) {
  console.error('Storage error:', error);
  // Show user-friendly message
}
```

### 5. Test Edge Cases

- Extension just installed (no saved data)
- No tabs open
- Many tabs open (performance)
- No internet connection
- Rapid clicking (prevent double actions)

## 🔄 Common Patterns

### Pattern 1: Popup → Background Communication

```javascript
// In popup.js
async function getDataFromBackground() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'getData' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// In background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    // Get data
    const data = { /* ... */ };
    sendResponse({ success: true, data: data });
  }
  return true; // For async response
});
```

### Pattern 2: Background → Content Script Communication

```javascript
// In background.js
async function sendToContentScript(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

// In content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'doSomething') {
    // Do something with the page
    sendResponse({ success: true });
  }
});
```

### Pattern 3: Storage with Defaults

```javascript
const DEFAULTS = {
  setting1: true,
  setting2: 'value'
};

// Get with defaults
const settings = await chrome.storage.sync.get(DEFAULTS);
console.log(settings.setting1); // Always defined
```

## 🐛 Debugging

### Common Issues

**1. "Extension context invalidated"**
- Cause: Extension was reloaded/updated
- Solution: Reload the affected page/popup

**2. Content script not running**
- Check `manifest.json` matches patterns
- Verify page URL matches the pattern
- Check for JavaScript errors in console

**3. Message not received**
- Ensure `return true` in message listener for async responses
- Check for typos in message action names
- Verify sender/receiver are both loaded

**4. Storage not saving**
- Check permissions in manifest
- Verify using correct storage area (sync vs local)
- Check for quota exceeded errors

### Debugging Tools

1. **Chrome DevTools** - F12 on any extension page
2. **Service Worker Inspector** - Click "service worker" in `chrome://extensions/`
3. **Console Logs** - Strategic `console.log()` statements
4. **Debugger** - Use `debugger;` statement to pause execution
5. **Network Tab** - Monitor API calls and downloads

## 📦 Publishing

### Preparing for Chrome Web Store

1. **Create icons** (16×16, 48×48, 128×128)
2. **Add promotional images** (1280×800 or 640×400)
3. **Write description and screenshots**
4. **Test thoroughly** on multiple sites/scenarios
5. **Create privacy policy** (if collecting data)
6. **Update manifest** (remove test/development code)

### Publishing Steps

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Pay one-time $5 developer fee (if first extension)
3. Click "New Item"
4. Upload ZIP of extension folder
5. Fill in listing details
6. Submit for review

**Review typically takes 1-3 days**

## 📖 Resources

### Official Documentation
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [API Reference](https://developer.chrome.com/docs/extensions/reference/)

### Learning Resources
- [Chrome Extension Tutorial](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Sample Extensions](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Stack Overflow - Chrome Extension Tag](https://stackoverflow.com/questions/tagged/google-chrome-extension)

### Tools
- [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)
- [Web Store Upload](https://github.com/fregante/chrome-webstore-upload)
- [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)

## 🤝 Contributing

This is a template project. Feel free to:
- Fork and customize for your needs
- Submit issues for documentation improvements
- Share your extensions built with this template

## 📄 License

MIT License - Feel free to use this template for any purpose.

## 💬 Support

- Create an issue for bugs or questions
- Check existing issues for common problems
- Read the inline code comments for detailed explanations

## 🎓 Next Steps

See [DEVELOPMENT.md](DEVELOPMENT.md) for:
- Detailed component explanations
- Advanced patterns and techniques
- Performance optimization tips
- Security best practices
- Testing strategies

---

**Happy coding! Build something awesome! 🚀**
