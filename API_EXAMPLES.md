# Chrome Extension API Examples

A comprehensive reference of Chrome Extension API usage patterns with practical examples.

## Table of Contents

- [Storage API](#storage-api)
- [Tabs API](#tabs-api)
- [Downloads API](#downloads-api)
- [Runtime API](#runtime-api)
- [Notifications API](#notifications-api)
- [Context Menus API](#context-menus-api)
- [Commands API](#commands-api)
- [Alarms API](#alarms-api)
- [Scripting API](#scripting-api)
- [Windows API](#windows-api)

---

## Storage API

Store and retrieve data across browser sessions.

### Basic Operations

```javascript
// Save data
await chrome.storage.sync.set({ key: 'value' });

// Get data
const result = await chrome.storage.sync.get('key');
console.log(result.key); // 'value'

// Get multiple keys
const data = await chrome.storage.sync.get(['key1', 'key2']);

// Get all data
const allData = await chrome.storage.sync.get(null);

// Remove data
await chrome.storage.sync.remove('key');

// Clear all data
await chrome.storage.sync.clear();
```

### With Default Values

```javascript
const defaults = {
  theme: 'light',
  enabled: true,
  count: 0
};

const settings = await chrome.storage.sync.get(defaults);
// settings will have default values for missing keys
```

### Listen for Changes

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in area "${areaName}" changed`,
      `from "${oldValue}" to "${newValue}"`
    );
  }
});
```

### Storage Areas

```javascript
// Sync storage (synced across devices, 100KB limit)
chrome.storage.sync.set({ key: 'value' });

// Local storage (local only, 5MB limit)
chrome.storage.local.set({ key: 'value' });

// Session storage (clears when browser closes)
chrome.storage.session.set({ key: 'value' });
```

---

## Tabs API

Interact with browser tabs.

### Query Tabs

```javascript
// Get all tabs
const allTabs = await chrome.tabs.query({});

// Get current tab
const [currentTab] = await chrome.tabs.query({
  active: true,
  currentWindow: true
});

// Get tabs by URL pattern
const githubTabs = await chrome.tabs.query({
  url: 'https://github.com/*'
});

// Get tabs by status
const loadingTabs = await chrome.tabs.query({
  status: 'loading'
});
```

### Create and Modify Tabs

```javascript
// Create new tab
const tab = await chrome.tabs.create({
  url: 'https://example.com',
  active: true  // Focus the tab
});

// Update tab
await chrome.tabs.update(tabId, {
  url: 'https://newurl.com',
  active: true
});

// Reload tab
await chrome.tabs.reload(tabId);

// Duplicate tab
const duplicateTab = await chrome.tabs.duplicate(tabId);

// Close tab
await chrome.tabs.remove(tabId);

// Close multiple tabs
await chrome.tabs.remove([tabId1, tabId2, tabId3]);
```

### Tab Events

```javascript
// Tab created
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab.id);
});

// Tab updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
  }
});

// Tab activated
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
});

// Tab removed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab closed:', tabId);
});
```

### Tab Grouping

```javascript
// Group tabs
const groupId = await chrome.tabs.group({
  tabIds: [tabId1, tabId2, tabId3]
});

// Update group
await chrome.tabGroups.update(groupId, {
  title: 'My Group',
  color: 'blue'
});

// Ungroup tabs
await chrome.tabs.ungroup([tabId1, tabId2]);
```

---

## Downloads API

Download files programmatically.

### Basic Download

```javascript
// Download a file
const downloadId = await chrome.downloads.download({
  url: 'https://example.com/file.pdf',
  filename: 'document.pdf',  // Optional
  saveAs: false  // Don't show save dialog
});
```

### Advanced Download Options

```javascript
const downloadId = await chrome.downloads.download({
  url: 'https://example.com/image.jpg',
  filename: 'images/photo.jpg',  // Subfolder
  conflictAction: 'uniquify',  // or 'overwrite', 'prompt'
  saveAs: true,  // Show save dialog
  method: 'GET',
  headers: [
    { name: 'Authorization', value: 'Bearer token' }
  ]
});
```

### Monitor Downloads

```javascript
// Listen for download state changes
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Download complete:', delta.id);
  }
  
  if (delta.error) {
    console.error('Download failed:', delta.error.current);
  }
});

// Listen for download creation
chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('Download started:', downloadItem.id);
});
```

### Query Downloads

```javascript
// Get all downloads
const downloads = await chrome.downloads.search({});

// Get recent downloads
const recentDownloads = await chrome.downloads.search({
  limit: 10,
  orderBy: ['-startTime']
});

// Get downloads by URL
const specificDownloads = await chrome.downloads.search({
  url: 'https://example.com/*'
});
```

### Download Operations

```javascript
// Pause download
await chrome.downloads.pause(downloadId);

// Resume download
await chrome.downloads.resume(downloadId);

// Cancel download
await chrome.downloads.cancel(downloadId);

// Open downloaded file
await chrome.downloads.open(downloadId);

// Show in folder
await chrome.downloads.show(downloadId);

// Erase download history
await chrome.downloads.erase({ id: downloadId });
```

---

## Runtime API

Core extension functionality and messaging.

### Send Messages

```javascript
// Send message to background script
const response = await chrome.runtime.sendMessage({
  action: 'getData',
  params: { id: 123 }
});

// Send message to specific extension
const response = await chrome.runtime.sendMessage(
  extensionId,
  { action: 'ping' }
);

// Send message to specific tab
const response = await chrome.tabs.sendMessage(
  tabId,
  { action: 'updateUI' }
);
```

### Receive Messages

```javascript
// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received:', message);
  console.log('From:', sender.tab ? sender.tab.url : 'extension');
  
  // Synchronous response
  sendResponse({ status: 'received' });
  
  // For async response, return true
  if (message.action === 'async') {
    doAsyncWork().then(result => {
      sendResponse({ result });
    });
    return true;  // Required for async
  }
});
```

### Long-Lived Connections

```javascript
// Create connection (from popup/content script)
const port = chrome.runtime.connect({ name: 'myPort' });

port.onMessage.addListener((msg) => {
  console.log('Received:', msg);
});

port.postMessage({ data: 'hello' });

// Listen for connections (in background)
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connected:', port.name);
  
  port.onMessage.addListener((msg) => {
    console.log('Received:', msg);
    port.postMessage({ response: 'hi' });
  });
});
```

### Extension Info

```javascript
// Get extension ID
const id = chrome.runtime.id;

// Get manifest
const manifest = chrome.runtime.getManifest();
console.log('Version:', manifest.version);

// Get extension URL
const url = chrome.runtime.getURL('popup/popup.html');

// Open options page
chrome.runtime.openOptionsPage();
```

---

## Notifications API

Show system notifications.

**Permission Required:** `"notifications"` in manifest.json

### Basic Notification

```javascript
await chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Notification Title',
  message: 'This is the notification message'
});
```

### Advanced Notifications

```javascript
// With notification ID
await chrome.notifications.create('myNotificationId', {
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Hello',
  message: 'World',
  priority: 2,  // -2 to 2
  requireInteraction: true  // Stays until user dismisses
});

// Progress notification
await chrome.notifications.create({
  type: 'progress',
  iconUrl: 'icons/icon48.png',
  title: 'Downloading...',
  message: 'Progress: 50%',
  progress: 50  // 0-100
});

// Image notification
await chrome.notifications.create({
  type: 'image',
  iconUrl: 'icons/icon48.png',
  title: 'Image Saved',
  message: 'Your image has been saved',
  imageUrl: 'path/to/image.jpg'
});

// List notification
await chrome.notifications.create({
  type: 'list',
  iconUrl: 'icons/icon48.png',
  title: 'Tasks Complete',
  message: 'All tasks finished',
  items: [
    { title: 'Task 1', message: 'Done' },
    { title: 'Task 2', message: 'Done' }
  ]
});
```

### Notification Events

```javascript
// Notification clicked
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
  chrome.notifications.clear(notificationId);
});

// Notification closed
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log('Notification closed:', notificationId, 'by user:', byUser);
});

// Button clicked (if notification has buttons)
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log('Button', buttonIndex, 'clicked in', notificationId);
});
```

---

## Context Menus API

Add items to browser's context menu.

**Permission Required:** `"contextMenus"` in manifest.json

### Create Menu Items

```javascript
// On extension install
chrome.runtime.onInstalled.addListener(() => {
  // Simple menu item
  chrome.contextMenus.create({
    id: 'myMenuItem',
    title: 'My Menu Item',
    contexts: ['page']  // Where to show: page, selection, link, image, etc.
  });
  
  // Menu with icon
  chrome.contextMenus.create({
    id: 'withIcon',
    title: 'Save Image',
    contexts: ['image'],
    type: 'normal'  // normal, checkbox, radio, separator
  });
  
  // Submenu
  chrome.contextMenus.create({
    id: 'parent',
    title: 'Parent Menu',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'child1',
    parentId: 'parent',
    title: 'Child 1',
    contexts: ['page']
  });
});
```

### Handle Menu Clicks

```javascript
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Menu item clicked:', info.menuItemId);
  console.log('Page URL:', info.pageUrl);
  
  if (info.menuItemId === 'myMenuItem') {
    // Handle click
    if (info.selectionText) {
      console.log('Selected text:', info.selectionText);
    }
    
    if (info.srcUrl) {
      console.log('Image/media URL:', info.srcUrl);
    }
  }
});
```

### Dynamic Menus

```javascript
// Update menu item
chrome.contextMenus.update('myMenuItem', {
  title: 'Updated Title',
  enabled: true
});

// Remove menu item
chrome.contextMenus.remove('myMenuItem');

// Remove all menu items
chrome.contextMenus.removeAll();
```

---

## Commands API

Keyboard shortcuts.

### Define Commands in manifest.json

```json
{
  "commands": {
    "save-all": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Save all images"
    },
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+Y",
        "mac": "Command+Shift+Y"
      }
    }
  }
}
```

### Listen for Commands

```javascript
chrome.commands.onCommand.addListener((command) => {
  console.log('Command:', command);
  
  if (command === 'save-all') {
    // Handle save-all command
    saveAllImages();
  }
});
```

### Get All Commands

```javascript
const commands = await chrome.commands.getAll();
commands.forEach(command => {
  console.log(command.name, ':', command.shortcut);
});
```

---

## Alarms API

Schedule code to run periodically or at a specific time.

**Permission Required:** `"alarms"` in manifest.json

### Create Alarms

```javascript
// One-time alarm (1 minute from now)
chrome.alarms.create('myAlarm', {
  delayInMinutes: 1
});

// Periodic alarm (every 5 minutes)
chrome.alarms.create('periodicAlarm', {
  delayInMinutes: 1,
  periodInMinutes: 5
});

// Alarm at specific time
chrome.alarms.create('specificTime', {
  when: Date.now() + 60000  // Timestamp in milliseconds
});
```

### Listen for Alarms

```javascript
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm fired:', alarm.name);
  
  if (alarm.name === 'myAlarm') {
    // Do something
    performScheduledTask();
  }
});
```

### Manage Alarms

```javascript
// Get specific alarm
const alarm = await chrome.alarms.get('myAlarm');

// Get all alarms
const allAlarms = await chrome.alarms.getAll();

// Clear specific alarm
await chrome.alarms.clear('myAlarm');

// Clear all alarms
await chrome.alarms.clearAll();
```

---

## Scripting API

Inject JavaScript and CSS into pages.

**Permission Required:** `"scripting"` in manifest.json

### Execute Scripts

```javascript
// Execute script file
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content.js']
});

// Execute inline function
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    document.body.style.backgroundColor = 'red';
  }
});

// Execute with arguments
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (color) => {
    document.body.style.backgroundColor = color;
  },
  args: ['blue']
});

// Execute in specific frame
await chrome.scripting.executeScript({
  target: { tabId: tabId, frameIds: [0] },
  func: () => { /* ... */ }
});
```

### Insert CSS

```javascript
// Insert CSS file
await chrome.scripting.insertCSS({
  target: { tabId: tabId },
  files: ['styles.css']
});

// Insert inline CSS
await chrome.scripting.insertCSS({
  target: { tabId: tabId },
  css: 'body { background: red; }'
});

// Remove CSS
await chrome.scripting.removeCSS({
  target: { tabId: tabId },
  css: 'body { background: red; }'
});
```

### Register Content Scripts

```javascript
// Dynamically register content script
await chrome.scripting.registerContentScripts([{
  id: 'my-script',
  matches: ['https://example.com/*'],
  js: ['content.js'],
  runAt: 'document_idle'
}]);

// Unregister content script
await chrome.scripting.unregisterContentScripts({
  ids: ['my-script']
});

// Get registered scripts
const scripts = await chrome.scripting.getRegisteredContentScripts();
```

---

## Windows API

Manage browser windows.

### Query Windows

```javascript
// Get all windows
const allWindows = await chrome.windows.getAll();

// Get current window
const currentWindow = await chrome.windows.getCurrent();

// Get window with tabs
const windowWithTabs = await chrome.windows.get(windowId, {
  populate: true
});
```

### Create and Modify Windows

```javascript
// Create new window
const window = await chrome.windows.create({
  url: 'https://example.com',
  type: 'popup',  // normal, popup, panel
  width: 800,
  height: 600,
  left: 100,
  top: 100,
  focused: true
});

// Update window
await chrome.windows.update(windowId, {
  focused: true,
  state: 'maximized'  // normal, minimized, maximized, fullscreen
});

// Close window
await chrome.windows.remove(windowId);
```

### Window Events

```javascript
// Window created
chrome.windows.onCreated.addListener((window) => {
  console.log('Window created:', window.id);
});

// Window focus changed
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    console.log('No window focused');
  } else {
    console.log('Window focused:', windowId);
  }
});

// Window removed
chrome.windows.onRemoved.addListener((windowId) => {
  console.log('Window closed:', windowId);
});
```

---

## Additional Resources

- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**Happy coding! 🚀**
