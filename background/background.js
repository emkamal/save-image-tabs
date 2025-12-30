/**
 * Background Service Worker
 *
 * This is the background script for the Chrome extension. In Manifest V3,
 * background scripts run as service workers, which means they:
 * - Only run when needed (event-driven)
 * - Terminate when idle
 * - Don't have access to DOM
 * - Can't use window, document, or localStorage
 *
 * Use this script for:
 * - Listening to browser events (tabs, windows, downloads, etc.)
 * - Managing extension state
 * - Communicating with content scripts and popup
 * - Making API calls
 * - Handling keyboard shortcuts (commands)
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Keep track of folder names used in this session to handle increments
 */
const sessionState = {
  folderUsage: {}
};

/**
 * Fired when the extension is first installed, updated, or Chrome is updated
 * Use this to initialize extension state, set default values, or run migrations
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details);

  // Initialize default settings
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      autoDownload: false,
      downloadFormat: 'original',
      saveLocation: 'downloads',
      notification: true,
      maxTabsToOpen: 30
    }, () => {
      console.log('Default settings initialized');
    });

    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }

  // Handle extension updates
  if (details.reason === 'update') {
    console.log('Extension updated from version:', details.previousVersion);
  }

  // Create context menu
  chrome.contextMenus.create({
    id: 'openImagesBelow',
    title: 'Open all images below in new tabs',
    contexts: ['page']
  });
});

/**
 * Fired when the service worker starts up
 * Note: Service workers may start and stop frequently
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, service worker initialized');
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Listen for messages from content scripts, popup, or other parts of the extension
 * This is the primary way different parts of your extension communicate
 *
 * @param {Object} message - The message object sent from another part of the extension
 * @param {Object} sender - Information about the sender (tab, frame, extension)
 * @param {Function} sendResponse - Function to call to send a response back
 * @returns {boolean} - Return true if you want to send a response asynchronously
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message, 'from:', sender);

  // Handle different message types
  switch (message.action) {
    case 'getImageTabs':
      handleGetImageTabs(sendResponse);
      return true; // Will respond asynchronously

    case 'saveImages':
      handleSaveImages(message.tabs, message.folderName, message.closeTabs, sendResponse);
      return true;

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'openTabs':
      handleOpenTabs(message.urls);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// ============================================================================
// TAB EVENTS
// ============================================================================

/**
 * Fired when a tab is created
 * Use this to track new tabs or respond to tab creation
 */
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab.id, tab.url);
});

/**
 * Fired when a tab is updated (URL change, loading state, etc.)
 * Use this to detect when tabs load images or change state
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only log when tab is completely loaded
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tabId, tab.url);

    // Check if this is an image tab
    if (isImageUrl(tab.url)) {
      console.log('Image tab detected:', tab.url);
      // You could add a badge or notification here
      chrome.action.setBadgeText({ text: '📷', tabId: tabId });
    }
  }
});

/**
 * Fired when a tab is closed
 * Use this to clean up tab-specific data
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab closed:', tabId);
});

// ============================================================================
// KEYBOARD SHORTCUTS (COMMANDS)
// ============================================================================

/**
 * Handle keyboard shortcuts defined in manifest.json
 * Commands are defined in the "commands" section of manifest.json
 */
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);

  switch (command) {
    case 'save-all-images':
      handleSaveAllImagesCommand();
      break;
  }
});

// ============================================================================
// CONTEXT MENUS (Optional - requires "contextMenus" permission)
// ============================================================================

/**
 * Create context menu items when the extension is installed
 * Uncomment the "contextMenus" permission in manifest.json to use this
 */
// chrome.runtime.onInstalled.addListener(() => {
//   chrome.contextMenus.create({
//     id: 'saveImage',
//     title: 'Save this image tab',
//     contexts: ['page'],
//     documentUrlPatterns: ['*://*/*.jpg', '*://*/*.jpeg', '*://*/*.png', '*://*/*.gif', '*://*/*.webp']
//   });
// });
//
// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   if (info.menuItemId === 'saveImage') {
//     handleSaveImages([{ id: tab.id, url: tab.url, title: tab.title }], '', false, (response) => {
//       console.log('Image saved via context menu:', response);
//     });
//   }
// });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'openImagesBelow') {
    try {
      const settings = await chrome.storage.sync.get({ maxTabsToOpen: 30 });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'openImagesBelow',
        limit: settings.maxTabsToOpen
      });
    } catch (error) {
      console.log('Context menu message failed (likely page needs refresh):', error.message);
    }
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all tabs that contain images
 * @param {Function} callback - Function to call with the results
 */
async function handleGetImageTabs(callback) {
  try {
    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Filter for image tabs
    const imageTabs = tabs.filter(tab => isImageUrl(tab.url));

    callback({
      success: true,
      tabs: imageTabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }))
    });
  } catch (error) {
    console.error('Error getting image tabs:', error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Save multiple images to the downloads folder
 * @param {Array<string>} urls - Array of image URLs to download
 * @param {Function} callback - Function to call with the results
 */
/**
 * Save multiple images to the downloads folder
 * @param {Array<Object>} tabs - Array of tab objects ({id, url, title})
 * @param {string} folderName - Subfolder name
 * @param {boolean} closeTabs - Whether to close tabs after download
 * @param {Function} callback - Function to call with the results
 */
async function handleSaveImages(tabs, folderName, closeTabs, callback) {
  try {
    // Get user settings
    const settings = await chrome.storage.sync.get(['autoDownload', 'notification']);

    // Process folder name
    let finalFolderName = folderName.trim();
    if (!finalFolderName) {
      finalFolderName = getTimestampFolder();
    } else {
      // Handle incrementing if custom folder name used before in this session
      if (sessionState.folderUsage[finalFolderName]) {
        sessionState.folderUsage[finalFolderName]++;
        finalFolderName = `${finalFolderName}${sessionState.folderUsage[finalFolderName]}`;
      } else {
        sessionState.folderUsage[finalFolderName] = 0; // First time, no suffix
      }
    }

    const downloadIds = [];
    const successfulTabs = [];

    // Download each image
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      try {
        let filename = getFilenameFromTab(tab);

        // If filename is empty, use imageN
        if (!filename || filename === 'image.jpg') {
          filename = `image${i + 1}.jpg`;
        }

        const fullPath = `${finalFolderName}/${filename}`;

        const downloadId = await chrome.downloads.download({
          url: tab.url,
          saveAs: false, // Override settings to make it seamless as requested
          filename: fullPath,
          conflictAction: 'uniquify' // Let chrome handle duplicate filenames
        });

        downloadIds.push(downloadId);
        successfulTabs.push(tab.id);
        console.log('Download started:', downloadId, tab.url);

        // Send progress update to popup
        chrome.runtime.sendMessage({
          action: 'downloadProgress',
          current: i + 1,
          total: tabs.length
        }).catch(() => {
          // Ignore error if popup is closed
        });
      } catch (error) {
        console.error('Failed to download:', tab.url, error);
      }
    }

    // Close tabs if requested and download started successfully
    if (closeTabs && successfulTabs.length > 0) {
      chrome.tabs.remove(successfulTabs);
    }

    // Show notification if enabled
    if (settings.notification && downloadIds.length > 0) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Images Saved',
        message: `Started downloading ${downloadIds.length} image(s) to ${finalFolderName}`
      });
    }

    callback({
      success: true,
      downloadIds: downloadIds,
      count: downloadIds.length
    });
  } catch (error) {
    console.error('Error saving images:', error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Open multiple URLs in new tabs
 * @param {Array<string>} urls
 */
function handleOpenTabs(urls) {
  urls.forEach(url => {
    chrome.tabs.create({ url, active: false });
  });
}

/**
 * Generate a timestamp string in YYYYMMDD_HHMMSS format
 * @returns {string}
 */
function getTimestampFolder() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const MM = pad(now.getMinutes());
  const SS = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${HH}${MM}${SS}`;
}

/**
 * Try to get a filename from tab title or URL
 * @param {Object} tab
 * @returns {string}
 */
function getFilenameFromTab(tab) {
  // If URL is data, try title or return empty
  if (tab.url.startsWith('data:')) {
    if (tab.title && tab.title !== 'data:image...') {
      // Clean title and ensure extension
      let title = tab.title.replace(/[<>:"/\\|?*]/g, '').trim();
      if (!title.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i)) {
        title += '.jpg'; // Default extension for data images if missing
      }
      return title;
    }
    return ''; // Will fallback to imageN
  }

  return getFilenameFromUrl(tab.url);
}

/**
 * Get extension settings from storage
 * @param {Function} callback - Function to call with the settings
 */
async function handleGetSettings(callback) {
  try {
    const settings = await chrome.storage.sync.get(null);
    callback({ success: true, settings: settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Handle the save-all-images keyboard command
 */
async function handleSaveAllImagesCommand() {
  console.log('Save all images command triggered');

  // Get all image tabs
  const tabs = await chrome.tabs.query({});
  const imageTabs = tabs.filter(tab => isImageUrl(tab.url));

  if (imageTabs.length === 0) {
    console.log('No image tabs found');
    return;
  }

  // Extract URLs and save them
  const urls = imageTabs.map(tab => tab.url);
  handleSaveImages(urls, (response) => {
    console.log('Save all images result:', response);
  });
}

/**
 * Check if a URL is an image
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL appears to be an image
 */
function isImageUrl(url) {
  if (!url) return false;

  // SUPPORT FOR DATA URLS
  if (url.startsWith('data:image/')) return true;

  // Common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

  // Check if URL ends with an image extension (excluding query params)
  const urlLower = url.toLowerCase().split('?')[0].split('#')[0];
  return imageExtensions.some(ext => urlLower.endsWith(ext));
}

/**
 * Extract a filename from a URL
 * @param {string} url - The URL to extract filename from
 * @returns {string} - The extracted filename
 */
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    return filename || 'image.jpg';
  } catch (error) {
    console.error('Error parsing URL:', error);
    return 'image.jpg';
  }
}

// ============================================================================
// ALARM API (for scheduled tasks)
// ============================================================================

/**
 * Use alarms for scheduled or delayed tasks
 * Alarms persist even when the service worker is inactive
 * Requires "alarms" permission in manifest.json
 */
/*
// Create an alarm
chrome.alarms.create('cleanupAlarm', {
  delayInMinutes: 60,
  periodInMinutes: 60
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupAlarm') {
    console.log('Running cleanup...');
    // Perform cleanup tasks
  }
});
*/

// ============================================================================
// STORAGE EVENTS
// ============================================================================

/**
 * Listen for changes to chrome.storage
 * Useful for responding to settings changes across different parts of the extension
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed in', areaName, ':', changes);

  // Example: React to settings changes
  if (changes.notification) {
    console.log('Notification setting changed:', changes.notification.newValue);
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handler
 * Catch any unhandled errors in the service worker
 */
self.addEventListener('error', (event) => {
  console.error('Unhandled error in service worker:', event.error);
});

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// ============================================================================
// NOTES FOR DEVELOPERS
// ============================================================================

/**
 * BEST PRACTICES:
 *
 * 1. Keep service workers lightweight - they should start and stop quickly
 * 2. Use chrome.storage instead of localStorage (service workers can't use localStorage)
 * 3. Use message passing to communicate with content scripts and popup
 * 4. Handle errors gracefully - network requests can fail
 * 5. Test with different network conditions and browser states
 * 6. Remember that service workers are terminated when idle
 * 7. Use chrome.alarms for scheduled tasks instead of setTimeout/setInterval
 * 8. All API calls should be async/await or promise-based
 *
 * DEBUGGING:
 *
 * 1. Open chrome://extensions/
 * 2. Enable "Developer mode"
 * 3. Click "service worker" link under your extension to open DevTools
 * 4. Console logs will appear in the service worker DevTools
 * 5. Service worker will show as "inactive" when not running
 *
 * COMMON APIS:
 *
 * - chrome.tabs: Manage browser tabs
 * - chrome.windows: Manage browser windows
 * - chrome.storage: Store and retrieve data
 * - chrome.downloads: Download files
 * - chrome.notifications: Show system notifications
 * - chrome.contextMenus: Add context menu items
 * - chrome.commands: Handle keyboard shortcuts
 * - chrome.alarms: Schedule tasks
 * - chrome.webRequest: Intercept network requests (requires additional permissions)
 * - chrome.cookies: Read and modify cookies
 * - chrome.bookmarks: Access bookmarks
 * - chrome.history: Access browsing history
 */

console.log('Background service worker loaded successfully');
