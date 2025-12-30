# 🛠️ Development Guide

This guide provides in-depth information about developing Chrome extensions using this template.

## Table of Contents

- [Chrome Extension Architecture](#chrome-extension-architecture)
- [Component Deep Dive](#component-deep-dive)
- [Advanced Patterns](#advanced-patterns)
- [Performance Optimization](#performance-optimization)
- [Security Best Practices](#security-best-practices)
- [Testing Strategies](#testing-strategies)
- [Common Pitfalls](#common-pitfalls)

## Chrome Extension Architecture

### The Extension Lifecycle

```
Extension Installation
    ↓
Background Service Worker Starts
    ↓
User Clicks Extension Icon
    ↓
Popup Opens (loads HTML/CSS/JS)
    ↓
Popup Requests Data from Background
    ↓
Background Processes Request
    ↓
Background Sends Response to Popup
    ↓
Popup Updates UI
    ↓
User Clicks Outside → Popup Closes
    ↓
Background Service Worker Idles
    ↓
(Service Worker may stop if inactive)
```

### Communication Flow

```
┌─────────────────┐
│   Web Page      │
│                 │
│  ┌────────────┐ │
│  │  Content   │ │  chrome.runtime.sendMessage()
│  │  Script    │─┼─────────────────────────┐
│  └────────────┘ │                         │
└─────────────────┘                         ↓
                                    ┌──────────────────┐
┌─────────────────┐                 │   Background     │
│   Popup         │                 │  Service Worker  │
│                 │ sendMessage()   │                  │
│  ┌────────────┐ │─────────────────→                  │
│  │  popup.js  │ │←─────────────── │  Event Handler   │
│  └────────────┘ │   sendResponse()│                  │
└─────────────────┘                 └──────────────────┘
                                            ↓
┌─────────────────┐                 chrome.tabs.query()
│   Options       │                 chrome.storage.get()
│                 │                 chrome.downloads.download()
│  ┌────────────┐ │                        etc.
│  │ options.js │ │
│  └────────────┘ │
└─────────────────┘
```

## Component Deep Dive

### Manifest.json

The manifest file is JSON-formatted and defines everything about your extension.

#### Key Sections Explained

**manifest_version**
```json
"manifest_version": 3
```
- Must be `3` for new extensions (Manifest V2 is deprecated)
- Manifest V3 brings better security and performance

**Permissions**
```json
"permissions": [
  "tabs",        // Read tab info (URL, title, etc.)
  "downloads",   // Download files
  "storage",     // Use chrome.storage API
  "activeTab"    // Interact with active tab on user action
]
```

**Host Permissions** (Manifest V3)
```json
"host_permissions": [
  "<all_urls>"  // Access all URLs (be specific in production!)
]
```

**Action (Popup)**
```json
"action": {
  "default_popup": "popup/popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png"
  },
  "default_title": "Extension Name"
}
```

**Background Service Worker**
```json
"background": {
  "service_worker": "background/background.js",
  "type": "module"  // Allows ES6 imports
}
```

**Content Scripts**
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "run_at": "document_idle"  // or "document_start", "document_end"
  }
]
```

### Background Service Worker

Service workers are the backbone of your extension in Manifest V3.

#### Lifecycle

**Key Characteristics:**
- Event-driven (start on event, stop when idle)
- No DOM access
- No `window` or `document` objects
- Use `chrome.storage` instead of `localStorage`
- Can be terminated at any time

**When Service Worker Starts:**
- Extension installed/updated
- Extension enabled
- Browser starts
- Event occurs (message, alarm, tab event, etc.)

**When Service Worker Stops:**
- After ~30 seconds of inactivity
- When browser closes
- When explicitly terminated by Chrome

#### Best Practices

```javascript
// ✅ GOOD: Use chrome.storage
chrome.storage.local.set({ key: 'value' });

// ❌ BAD: localStorage not available in service worker
localStorage.setItem('key', 'value');

// ✅ GOOD: Use chrome.alarms for scheduled tasks
chrome.alarms.create('myAlarm', { delayInMinutes: 60 });

// ❌ BAD: setTimeout may not fire if service worker stops
setTimeout(() => { /* ... */ }, 3600000);

// ✅ GOOD: Keep operations fast
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  processQuickly(msg);
  sendResponse({ done: true });
});

// ❌ BAD: Long-running operations
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // This might fail if service worker stops
  slowOperation().then(() => sendResponse({ done: true }));
  return true;
});
```

### Content Scripts

Content scripts bridge the gap between web pages and your extension.

#### The Isolated World

Content scripts run in an "isolated world":
- Can access and modify the DOM
- Cannot access page's JavaScript variables/functions
- Share the DOM but have separate JavaScript context

```javascript
// On the web page
window.myPageVariable = 'hello';

// In content script
console.log(window.myPageVariable); // undefined!
```

#### Communicating with the Page

To exchange data with page JavaScript, use `window.postMessage`:

```javascript
// Content script → Page
window.postMessage({
  type: 'FROM_EXTENSION',
  data: 'Hello page!'
}, '*');

// Page → Content script
window.addEventListener('message', (event) => {
  if (event.data.type === 'FROM_PAGE') {
    console.log('Received:', event.data);
  }
});
```

⚠️ **Security Warning:** Always validate `event.origin` when using postMessage!

#### Dynamic Content Script Injection

You can inject content scripts programmatically:

```javascript
// In background or popup
chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content/content.js']
});

// Or inject inline code
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    document.body.style.backgroundColor = 'red';
  }
});
```

### Popup

The popup is a temporary UI that appears when clicking the extension icon.

#### Popup Lifecycle

```
User clicks icon → Popup opens → popup.html loads → popup.js runs
                                                           ↓
User clicks outside → Popup closes → popup.js unloads
```

**Important:** Popup state is NOT preserved! Every open is a fresh start.

#### Keeping Popup Open (for debugging)

1. Right-click extension icon → Inspect popup
2. Click the "⋮" menu in DevTools
3. Check "Disable caching"
4. Popup stays open while DevTools is focused

#### Popup Best Practices

```javascript
// ✅ GOOD: Load data on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadData();
  renderUI(data);
});

// ❌ BAD: Assuming popup stays open
let myState = { counter: 0 };
// This resets to 0 every time popup opens!

// ✅ GOOD: Use chrome.storage for persistence
const data = await chrome.storage.local.get('counter');
let counter = data.counter || 0;
```

### Options Page

The options page is for complex settings that don't fit in the popup.

#### Access Methods

1. Right-click extension icon → Options
2. chrome://extensions/ → Extension Details → Extension options
3. `chrome.runtime.openOptionsPage()` from code

#### Options Page Patterns

**Pattern 1: Manual Save**
```javascript
// User clicks "Save" button to persist changes
document.getElementById('save').addEventListener('click', async () => {
  const settings = getFormData();
  await chrome.storage.sync.set(settings);
  showMessage('Saved!');
});
```

**Pattern 2: Auto-Save**
```javascript
// Save immediately on any change
document.querySelectorAll('input, select').forEach(input => {
  input.addEventListener('change', async () => {
    const settings = getFormData();
    await chrome.storage.sync.set(settings);
  });
});
```

## Advanced Patterns

### Pattern: Long-Lived Connections

For continuous communication, use long-lived connections:

```javascript
// In popup/content script
const port = chrome.runtime.connect({ name: 'myChannel' });

port.onMessage.addListener((msg) => {
  console.log('Received:', msg);
});

port.postMessage({ type: 'hello' });

// In background
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'myChannel') {
    port.onMessage.addListener((msg) => {
      console.log('Received:', msg);
      port.postMessage({ type: 'response' });
    });
  }
});
```

### Pattern: Tab-Specific State

Store data per tab:

```javascript
// In background
const tabData = new Map();

chrome.tabs.onCreated.addListener((tab) => {
  tabData.set(tab.id, { /* initial data */ });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabData.delete(tabId); // Clean up!
});

// Get data for specific tab
chrome.runtime.onMessage.addListener((msg, sender) => {
  const data = tabData.get(sender.tab.id);
  // Use data...
});
```

### Pattern: Batch Operations

Process multiple items efficiently:

```javascript
async function downloadAllImages(urls) {
  const MAX_CONCURRENT = 3;
  const results = [];
  
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
    const batch = urls.slice(i, i + MAX_CONCURRENT);
    const downloads = await Promise.all(
      batch.map(url => chrome.downloads.download({ url }))
    );
    results.push(...downloads);
    
    // Optional: Show progress
    showProgress(i + batch.length, urls.length);
  }
  
  return results;
}
```

### Pattern: Error Recovery

Gracefully handle failures:

```javascript
async function robustOperation() {
  const MAX_RETRIES = 3;
  let lastError;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await riskyOperation();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error);
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
  
  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError}`);
}
```

## Performance Optimization

### 1. Minimize Storage Operations

```javascript
// ❌ BAD: Multiple writes
await chrome.storage.sync.set({ key1: 'value1' });
await chrome.storage.sync.set({ key2: 'value2' });
await chrome.storage.sync.set({ key3: 'value3' });

// ✅ GOOD: Single write
await chrome.storage.sync.set({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3'
});
```

### 2. Cache DOM Queries

```javascript
// ❌ BAD: Query every time
function updateUI() {
  document.getElementById('status').textContent = 'Loading...';
  document.getElementById('status').classList.add('loading');
}

// ✅ GOOD: Query once
const statusEl = document.getElementById('status');
function updateUI() {
  statusEl.textContent = 'Loading...';
  statusEl.classList.add('loading');
}
```

### 3. Debounce Expensive Operations

```javascript
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Use for search, auto-save, etc.
const saveSettings = debounce(async () => {
  await chrome.storage.sync.set(getFormData());
}, 500);

inputElement.addEventListener('input', saveSettings);
```

### 4. Use Efficient Content Script Injection

```javascript
// ❌ BAD: Inject on all pages always
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["heavy-script.js"]
}]

// ✅ GOOD: Inject only when needed
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['heavy-script.js']
  });
});
```

## Security Best Practices

### 1. Minimize Permissions

Only request permissions you actually use:

```json
// ❌ BAD: Requesting unnecessary permissions
"permissions": [
  "tabs",
  "downloads",
  "storage",
  "bookmarks",    // Don't need this
  "history",      // Don't need this
  "cookies"       // Don't need this
]

// ✅ GOOD: Only what you need
"permissions": [
  "tabs",
  "downloads",
  "storage"
]
```

### 2. Use Specific Host Permissions

```json
// ❌ BAD: Access everything
"host_permissions": ["<all_urls>"]

// ✅ GOOD: Specific domains
"host_permissions": [
  "https://api.example.com/*",
  "https://cdn.example.com/*"
]
```

### 3. Sanitize User Input

```javascript
// ❌ BAD: Direct innerHTML injection (XSS risk!)
element.innerHTML = userInput;

// ✅ GOOD: Use textContent or sanitize
element.textContent = userInput;

// Or use a sanitization library
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

### 4. Validate Messages

```javascript
// ✅ GOOD: Validate message source and content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Verify sender
  if (!sender.tab) {
    console.warn('Message not from tab');
    return;
  }
  
  // Validate message structure
  if (!msg.action || typeof msg.action !== 'string') {
    console.warn('Invalid message format');
    return;
  }
  
  // Process message...
});
```

### 5. Content Security Policy

Modern extensions have strict CSP by default. Don't weaken it:

```json
// ❌ BAD: Weakening CSP
"content_security_policy": {
  "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'"
}

// ✅ GOOD: Keep default or make stricter
// (Don't include CSP in manifest to use default)
```

## Testing Strategies

### Unit Testing

Test individual functions:

```javascript
// utils.js
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// utils.test.js (using Jest or similar)
import { formatFileSize } from './utils.js';

test('formats file size correctly', () => {
  expect(formatFileSize(0)).toBe('0 Bytes');
  expect(formatFileSize(1024)).toBe('1 KB');
  expect(formatFileSize(1048576)).toBe('1 MB');
});
```

### Integration Testing

Test component interactions:

```javascript
// Test message passing
async function testMessagePassing() {
  const response = await chrome.runtime.sendMessage({
    action: 'test'
  });
  
  console.assert(response.success === true, 'Message should succeed');
}
```

### Manual Testing Checklist

- [ ] Install fresh (no prior data)
- [ ] Install update (migration works)
- [ ] Popup opens and displays correctly
- [ ] Options page saves settings
- [ ] Content script runs on target pages
- [ ] Background handles all message types
- [ ] Keyboard shortcuts work
- [ ] Downloads complete successfully
- [ ] Error messages display properly
- [ ] Works in incognito mode (if enabled)
- [ ] No console errors
- [ ] Performance is acceptable

## Common Pitfalls

### Pitfall 1: Assuming Popup Stays Open

```javascript
// ❌ WRONG
let counter = 0;
button.onclick = () => {
  counter++; // Resets to 0 on next popup open!
  console.log(counter);
};

// ✅ CORRECT
let counter = 0;
chrome.storage.local.get('counter').then(data => {
  counter = data.counter || 0;
});
button.onclick = async () => {
  counter++;
  await chrome.storage.local.set({ counter });
  console.log(counter);
};
```

### Pitfall 2: Service Worker Assumptions

```javascript
// ❌ WRONG: Global variables don't persist
let cachedData = null;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!cachedData) {
    // May always be null after service worker restarts!
    cachedData = fetchData();
  }
  sendResponse(cachedData);
});

// ✅ CORRECT: Use chrome.storage
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  let data = await chrome.storage.local.get('cachedData');
  if (!data.cachedData) {
    data.cachedData = await fetchData();
    await chrome.storage.local.set({ cachedData: data.cachedData });
  }
  sendResponse(data.cachedData);
  return true;
});
```

### Pitfall 3: Content Script Timing

```javascript
// ❌ WRONG: Element might not exist yet
const button = document.getElementById('myButton');
button.addEventListener('click', handler); // Error if null!

// ✅ CORRECT: Wait for element
function waitForElement(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

const button = await waitForElement('#myButton');
button.addEventListener('click', handler);
```

### Pitfall 4: Message Response Timing

```javascript
// ❌ WRONG: Async response without return true
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetchData().then(data => {
    sendResponse(data); // Response may not send!
  });
});

// ✅ CORRECT: Return true for async response
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetchData().then(data => {
    sendResponse(data);
  });
  return true; // Keeps message channel open!
});
```

### Pitfall 5: Memory Leaks

```javascript
// ❌ WRONG: Event listeners not cleaned up
function addListeners() {
  document.addEventListener('click', handler);
  // Called multiple times = multiple listeners!
}

// ✅ CORRECT: Clean up or check existence
let listenerAdded = false;
function addListeners() {
  if (!listenerAdded) {
    document.addEventListener('click', handler);
    listenerAdded = true;
  }
}

// Or remove before adding
document.removeEventListener('click', handler);
document.addEventListener('click', handler);
```

## Resources

### Tools

- **Chrome Extension Source Viewer** - View source of published extensions
- **Extension Reloader** - Auto-reload during development
- **Redux DevTools** - If using Redux for state management

### Communities

- [Chrome Extension Developers Google Group](https://groups.google.com/a/chromium.org/g/chromium-extensions)
- [r/chrome_extensions](https://reddit.com/r/chrome_extensions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-chrome-extension)

### Further Reading

- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Content Script Best Practices](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

---

**Good luck with your extension development! 🎉**
