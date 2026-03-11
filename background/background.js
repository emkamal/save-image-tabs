/**
 * Background Service Worker for Save Image Tabs
 * Handles browser events, downloads, and context menus.
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
 * Initialize extension state on install or update
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
      maxConcurrent: 5,
      maxTabsToOpen: 30,
      minImageWidth: 100,
      minImageHeight: 100,
      skipBlurryImages: false,
      blurThreshold: 100,
      showBlurScore: false
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
    title: 'Open images below in tabs',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'downloadImagesBelow',
    title: 'Download images below...',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'reviewImagesBelow',
    title: 'Review and download images...',
    contexts: ['page']
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, service worker initialized');
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Message listener for communication between different parts of the extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message, 'from:', sender);

  // Handle different message types
  switch (message.action) {
    case 'getImageTabs':
      handleGetImageTabs(sendResponse);
      return true; // Will respond asynchronously

    case 'saveImages':
      handleSaveImages(message.tabIds, message.folderName, message.closeTabs, sendResponse);
      return true;

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'openTabs':
      handleOpenTabs(message.urls);
      return true;

    case 'saveExtractedImages':
      handleSaveExtractedImages(message.images, message.folderName, sendResponse);
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
  const settings = await chrome.storage.sync.get({
    maxTabsToOpen: 30,
    minImageWidth: 100,
    minImageHeight: 100,
    skipBlurryImages: false,
    blurThreshold: 100,
    showBlurScore: false
  });

  if (info.menuItemId === 'openImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'openImagesBelow',
        limit: settings.maxTabsToOpen,
        minWidth: settings.minImageWidth,
        minHeight: settings.minImageHeight,
        skipBlurryImages: settings.skipBlurryImages,
        blurThreshold: settings.blurThreshold
      });
    } catch (error) {
      console.log('Context menu message failed (likely page needs refresh):', error.message);
    }
  } else if (info.menuItemId === 'downloadImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'downloadImagesBelow',
        minWidth: settings.minImageWidth,
        minHeight: settings.minImageHeight,
        skipBlurryImages: settings.skipBlurryImages,
        blurThreshold: settings.blurThreshold
      });
    } catch (error) {
      console.log('Context menu message failed:', error.message);
    }
  } else if (info.menuItemId === 'reviewImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'reviewImagesBelow',
        minWidth: settings.minImageWidth,
        minHeight: settings.minImageHeight,
        skipBlurryImages: settings.skipBlurryImages,
        blurThreshold: settings.blurThreshold,
        showBlurScore: settings.showBlurScore
      });
    } catch (error) {
      console.log('Context menu message failed:', error.message);
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

    // Filter for image tabs (keep response light)
    const imageTabsCount = tabs.filter(tab => isImageUrl(tab.url)).length;

    callback({
      success: true,
      count: imageTabsCount
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
 * @param {Array<number>} tabIds - Array of tab IDs
 * @param {string} folderName - Subfolder name
 * @param {boolean} closeTabs - Whether to close tabs after download
 * @param {Function} callback - Function to call with the results
 */
async function handleSaveImages(tabIds, folderName, closeTabs, callback) {
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
    for (let i = 0; i < tabIds.length; i++) {
      const tabId = tabIds[i];
      try {
        // Fetch tab data by ID to get fresh URL and bypass messaging limit
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !isImageUrl(tab.url)) continue;

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
          total: tabIds.length
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
 * Save extracted images with throttling
 */
async function handleSaveExtractedImages(images, folderName, callback) {
  try {
    const settings = await chrome.storage.sync.get({ maxConcurrent: 5, notification: true });
    const maxConcurrent = settings.maxConcurrent;

    // Get currently open image tabs to avoid duplicates
    const openTabs = await chrome.tabs.query({});
    const openTabUrls = new Set(openTabs.map(t => t.url).filter(url => !!url));

    // Deduplicate images by URL AND filter out already open tabs
    const imagesToDownload = [];
    const seenUrls = new Set();

    for (const img of images) {
      if (!img.url || seenUrls.has(img.url) || openTabUrls.has(img.url)) {
        continue;
      }
      seenUrls.add(img.url);
      imagesToDownload.push(img);
    }

    if (imagesToDownload.length === 0) {
      callback({ success: true, count: 0, message: 'All images are already open in tabs or are duplicates.' });
      return;
    }

    // Process folder name
    let finalFolderName = folderName.trim();
    if (!finalFolderName) finalFolderName = getTimestampFolder();

    // Check session naming
    if (sessionState.folderUsage[finalFolderName]) {
      sessionState.folderUsage[finalFolderName]++;
      finalFolderName = `${finalFolderName}${sessionState.folderUsage[finalFolderName]}`;
    } else {
      sessionState.folderUsage[finalFolderName] = 0;
    }

    const downloadIds = [];
    const total = imagesToDownload.length;
    let completed = 0;

    // Throttle downloads
    const downloadQueue = [...imagesToDownload];
    const runBatch = async () => {
      const batch = downloadQueue.splice(0, maxConcurrent);
      if (batch.length === 0) return;

      await Promise.all(batch.map(async (img, index) => {
        try {
          const filename = img.filename || `image${completed + 1}.jpg`;
          const fullPath = `${finalFolderName}/${filename}`;

          const downloadId = await chrome.downloads.download({
            url: img.url,
            saveAs: false,
            filename: fullPath,
            conflictAction: 'uniquify'
          });

          downloadIds.push(downloadId);
          completed++;

          // Notify progress
          chrome.runtime.sendMessage({
            action: 'downloadProgress',
            current: completed,
            total: total
          }).catch(() => { });

        } catch (err) {
          console.error('Inner download error:', err);
          completed++; // Still increment to keep progress moving
        }
      }));

      // Start next batch
      await runBatch();
    };

    await runBatch();

    if (settings.notification && downloadIds.length > 0) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Extractor Finished',
        message: `Saved ${downloadIds.length} images to ${finalFolderName}`
      });
    }

    callback({ success: true, count: downloadIds.length });
  } catch (error) {
    console.error('Error in handleSaveExtractedImages:', error);
    callback({ success: false, error: error.message });
  }
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

  // Extract tabs and save them
  const tabsToSave = imageTabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title
  }));

  handleSaveImages(tabsToSave, '', false, (response) => {
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


console.log('Background service worker loaded successfully');
