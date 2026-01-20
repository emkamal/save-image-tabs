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

// ============================================================================
// VIDEO INTERCEPTOR STATE
// ============================================================================

/**
 * Video interception state
 * - pendingRequests: Temporarily stores headers for in-flight requests (keyed by requestId)
 * - detectedVideos: Videos detected per tab (keyed by tabId -> Map of url -> metadata)
 */
const videoState = {
  pendingRequests: new Map(),
  detectedVideos: new Map()
};

/**
 * Video file extensions to detect
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv'];

/**
 * Streaming formats to ignore (HLS/DASH)
 */
const STREAMING_EXTENSIONS = ['.m3u8', '.mpd', '.ts'];

/**
 * Check if URL is a video based on extension
 */
function isVideoUrl(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase().split('?')[0].split('#')[0];
  // Ignore streaming formats
  if (STREAMING_EXTENSIONS.some(ext => urlLower.endsWith(ext))) return false;
  return VIDEO_EXTENSIONS.some(ext => urlLower.endsWith(ext));
}

/**
 * Check if content-type indicates video
 */
function isVideoContentType(contentType) {
  if (!contentType) return false;
  return contentType.toLowerCase().startsWith('video/');
}

/**
 * Extract filename from URL
 */
function getVideoFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    // Ensure it has an extension
    if (!VIDEO_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))) {
      filename = filename || 'video';
      filename += '.mp4'; // Default extension
    }
    return filename;
  } catch {
    return 'video.mp4';
  }
}

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
      minImageSize: 500,
      // Video settings
      minVideoSize: 1, // Minimum video size in MB
      enableVideoDetection: true
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

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, service worker initialized');
  // Restore video state from session storage
  await restoreVideoState();
});

// ============================================================================
// VIDEO NETWORK INTERCEPTION
// ============================================================================

/**
 * Restore video state from session storage (for service worker resilience)
 */
async function restoreVideoState() {
  try {
    const data = await chrome.storage.session.get('detectedVideos');
    if (data.detectedVideos) {
      // Reconstruct Map from stored object
      for (const [tabId, videos] of Object.entries(data.detectedVideos)) {
        videoState.detectedVideos.set(parseInt(tabId), new Map(Object.entries(videos)));
      }
      console.log('Restored video state:', videoState.detectedVideos.size, 'tabs');
    }
  } catch (error) {
    console.error('Error restoring video state:', error);
  }
}

/**
 * Persist video state to session storage
 */
async function persistVideoState() {
  try {
    // Convert Maps to plain objects for storage
    const serializable = {};
    for (const [tabId, videos] of videoState.detectedVideos) {
      serializable[tabId] = Object.fromEntries(videos);
    }
    await chrome.storage.session.set({ detectedVideos: serializable });
  } catch (error) {
    console.error('Error persisting video state:', error);
  }
}

/**
 * Capture request headers before they are sent
 * We need these to replay the request later for download
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // Store headers temporarily keyed by requestId
    const headers = {};
    if (details.requestHeaders) {
      for (const header of details.requestHeaders) {
        // Capture important headers for replay
        const name = header.name.toLowerCase();
        if (['referer', 'cookie', 'origin', 'user-agent', 'authorization'].includes(name)) {
          headers[header.name] = header.value;
        }
      }
    }
    if (Object.keys(headers).length > 0) {
      videoState.pendingRequests.set(details.requestId, {
        headers,
        tabId: details.tabId,
        url: details.url
      });
    }
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'other'] },
  ['requestHeaders']
);

/**
 * Detect video responses when requests complete
 */
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // Skip if not from a valid tab
    if (details.tabId < 0) return;

    // Get response headers
    const responseHeaders = {};
    let contentType = '';
    let contentLength = 0;

    if (details.responseHeaders) {
      for (const header of details.responseHeaders) {
        const name = header.name.toLowerCase();
        responseHeaders[name] = header.value;
        if (name === 'content-type') contentType = header.value;
        if (name === 'content-length') contentLength = parseInt(header.value) || 0;
      }
    }

    // Check if this is a video
    const isVideo = isVideoContentType(contentType) || isVideoUrl(details.url);
    if (!isVideo) {
      // Cleanup pending request
      videoState.pendingRequests.delete(details.requestId);
      return;
    }

    // Get settings for minimum video size
    const settings = await chrome.storage.sync.get({ minVideoSize: 1 }); // Default 1 MB
    const minBytes = settings.minVideoSize * 1024 * 1024;

    // Skip if too small (and we know the size)
    if (contentLength > 0 && contentLength < minBytes) {
      videoState.pendingRequests.delete(details.requestId);
      return;
    }

    // Get the captured request headers
    const pendingRequest = videoState.pendingRequests.get(details.requestId);
    videoState.pendingRequests.delete(details.requestId);

    // Create video metadata
    const videoMetadata = {
      url: details.url,
      filename: getVideoFilename(details.url),
      contentType,
      contentLength,
      requestHeaders: pendingRequest?.headers || {},
      detectedAt: Date.now()
    };

    // Store in detectedVideos map
    if (!videoState.detectedVideos.has(details.tabId)) {
      videoState.detectedVideos.set(details.tabId, new Map());
    }

    const tabVideos = videoState.detectedVideos.get(details.tabId);
    // Use URL as key to avoid duplicates
    if (!tabVideos.has(details.url)) {
      tabVideos.set(details.url, videoMetadata);
      console.log('Video detected:', details.url, 'Tab:', details.tabId);

      // Persist state
      await persistVideoState();

      // Notify any open popups about new video
      chrome.runtime.sendMessage({
        action: 'videoDetected',
        tabId: details.tabId,
        video: videoMetadata
      }).catch(() => {
        // Ignore error if popup is closed
      });
    }
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'other'] },
  ['responseHeaders']
);

/**
 * Clean up video state when a tab is closed
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (videoState.detectedVideos.has(tabId)) {
    videoState.detectedVideos.delete(tabId);
    await persistVideoState();
  }
});

/**
 * Clean up video state when a tab navigates to a new page
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // Tab is navigating to a new URL, clear its videos
    if (videoState.detectedVideos.has(tabId)) {
      videoState.detectedVideos.delete(tabId);
      await persistVideoState();
    }
  }
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

    // Video-related handlers
    case 'getDetectedVideos':
      handleGetDetectedVideos(message.tabId, sendResponse);
      return true;

    case 'saveVideos':
      handleSaveVideos(message.videos, message.folderName, sendResponse);
      return true;

    case 'clearVideos':
      handleClearVideos(message.tabId, sendResponse);
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
    minImageSize: 500
  });

  if (info.menuItemId === 'openImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'openImagesBelow',
        limit: settings.maxTabsToOpen,
        minSize: settings.minImageSize
      });
    } catch (error) {
      console.log('Context menu message failed (likely page needs refresh):', error.message);
    }
  } else if (info.menuItemId === 'downloadImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'downloadImagesBelow',
        minSize: settings.minImageSize
      });
    } catch (error) {
      console.log('Context menu message failed:', error.message);
    }
  } else if (info.menuItemId === 'reviewImagesBelow') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'reviewImagesBelow',
        minSize: settings.minImageSize
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

// ============================================================================
// VIDEO HANDLER FUNCTIONS
// ============================================================================

/**
 * Get detected videos for a specific tab
 * @param {number} tabId - Tab ID to get videos for
 * @param {Function} callback - Function to call with results
 */
async function handleGetDetectedVideos(tabId, callback) {
  try {
    // Restore state if needed (service worker may have restarted)
    if (videoState.detectedVideos.size === 0) {
      await restoreVideoState();
    }

    const tabVideos = videoState.detectedVideos.get(tabId);
    const videos = tabVideos ? Array.from(tabVideos.values()) : [];

    callback({
      success: true,
      videos,
      count: videos.length
    });
  } catch (error) {
    console.error('Error getting detected videos:', error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Download a single video with header replay
 * Uses fetch to replay original headers, then saves via blob URL
 * @param {Object} video - Video metadata
 * @param {string} folderName - Destination folder
 * @returns {Object} - Result with success status
 */
async function downloadVideoWithHeaders(video, folderName) {
  try {
    // Build headers from captured request headers
    const headers = new Headers();
    if (video.requestHeaders) {
      for (const [name, value] of Object.entries(video.requestHeaders)) {
        try {
          headers.set(name, value);
        } catch (e) {
          // Some headers may not be settable, skip them
          console.warn('Could not set header:', name);
        }
      }
    }

    // Fetch the video with original headers
    const response = await fetch(video.url, {
      method: 'GET',
      headers,
      credentials: 'include',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get the video as a blob
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Sanitize filename
    let filename = video.filename || 'video.mp4';
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');

    const fullPath = `${folderName}/${filename}`;

    // Start download
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: fullPath,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    // Schedule blob URL cleanup (after download should have started)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);

    return { success: true, downloadId, filename };
  } catch (error) {
    console.error('Error downloading video:', video.url, error);
    return { success: false, error: error.message, url: video.url };
  }
}

/**
 * Save multiple videos with throttling
 * @param {Array} videos - Array of video metadata objects
 * @param {string} folderName - Destination folder name
 * @param {Function} callback - Function to call with results
 */
async function handleSaveVideos(videos, folderName, callback) {
  try {
    const settings = await chrome.storage.sync.get({ maxConcurrent: 3, notification: true });
    const maxConcurrent = settings.maxConcurrent;

    // Process folder name
    let finalFolderName = folderName.trim();
    if (!finalFolderName) {
      finalFolderName = getTimestampFolder();
    } else if (sessionState.folderUsage[finalFolderName]) {
      sessionState.folderUsage[finalFolderName]++;
      finalFolderName = `${finalFolderName}${sessionState.folderUsage[finalFolderName]}`;
    } else {
      sessionState.folderUsage[finalFolderName] = 0;
    }

    const results = { success: [], failed: [] };
    const total = videos.length;
    let completed = 0;

    // Process in batches
    const queue = [...videos];

    const processBatch = async () => {
      const batch = queue.splice(0, maxConcurrent);
      if (batch.length === 0) return;

      await Promise.all(batch.map(async (video) => {
        const result = await downloadVideoWithHeaders(video, finalFolderName);
        completed++;

        if (result.success) {
          results.success.push(result);
        } else {
          results.failed.push(result);
        }

        // Send progress update
        chrome.runtime.sendMessage({
          action: 'videoDownloadProgress',
          current: completed,
          total
        }).catch(() => { });
      }));

      await processBatch();
    };

    await processBatch();

    // Show notification
    if (settings.notification && results.success.length > 0) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Videos Downloaded',
        message: `Downloaded ${results.success.length}/${total} videos to ${finalFolderName}`
      });
    }

    callback({
      success: true,
      downloaded: results.success.length,
      failed: results.failed.length,
      failedUrls: results.failed.map(f => f.url)
    });
  } catch (error) {
    console.error('Error in handleSaveVideos:', error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Clear detected videos for a tab
 * @param {number} tabId - Tab ID to clear videos for
 * @param {Function} callback - Function to call with results
 */
async function handleClearVideos(tabId, callback) {
  try {
    if (videoState.detectedVideos.has(tabId)) {
      videoState.detectedVideos.delete(tabId);
      await persistVideoState();
    }
    callback({ success: true });
  } catch (error) {
    console.error('Error clearing videos:', error);
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
