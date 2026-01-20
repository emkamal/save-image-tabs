/**
 * Popup Logic for Save Image Tabs
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Application state
 * Store the current state of the popup here
 */
const state = {
  imageTabs: [],
  selectedTabIds: new Set(),
  videos: [],
  selectedVideoUrls: new Set(),
  settings: {},
  loading: true,
  isReviewMode: false,
  activeTab: 'images', // 'images' or 'videos'
  currentTabId: null  // Active browser tab ID
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  // Tab navigation
  imagesTabBtn: document.getElementById('imagesTabBtn'),
  videosTabBtn: document.getElementById('videosTabBtn'),
  imageBadge: document.getElementById('imageBadge'),
  videoBadge: document.getElementById('videoBadge'),

  // Sections
  imagesSection: document.getElementById('imagesSection'),
  videosSection: document.getElementById('videosSection'),

  // Lists
  imagesList: document.getElementById('imagesList'),
  videosList: document.getElementById('videosList'),

  // Buttons and controls
  saveAllBtn: document.getElementById('saveAllBtn'),
  saveButtonText: document.getElementById('saveButtonText'),
  refreshBtn: document.getElementById('refreshBtn'),
  settingsLink: document.getElementById('settingsLink'),
  statusMessage: document.getElementById('statusMessage'),
  folderName: document.getElementById('folderName'),
  closeTabs: document.getElementById('closeTabs'),
  closeTabsGroup: document.getElementById('closeTabsGroup'),
  selectAllImages: document.getElementById('selectAllImages'),
  selectAllVideos: document.getElementById('selectAllVideos'),
  videoHelpLink: document.getElementById('videoHelpLink')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  try {
    // Get current tab ID for video detection
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentTabId = currentTab?.id || null;

    // Load settings and data in parallel
    await Promise.all([
      loadSettings(),
      loadImageTabs(),
      loadVideos()
    ]);

    // Set up event listeners
    setupEventListeners();

    // Update tab badges
    updateTabBadges();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Failed to load extension', 'error');
  }
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadSettings() {
  try {
    const response = await sendMessageToBackground({ action: 'getSettings' });

    if (response.success) {
      state.settings = response.settings;
      console.log('Settings loaded:', state.settings);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Load all image tabs from the background script
 * This queries all tabs and filters for images
 */
async function loadImageTabs() {
  try {
    state.loading = true;
    state.imageTabs = [];
    state.selectedTabIds = new Set();

    // Clear UI and show loading state
    if (elements.tabsList) {
      elements.tabsList.innerHTML = '<div class="loading">Scanning tabs...</div>';
    }
    updateImageCount();
    updateSaveButton();

    // Check for extracted images first (Review Mode)
    const localData = await chrome.storage.local.get(['extractedImages', 'extractorSourceUrl']);

    if (localData.extractedImages && localData.extractedImages.length > 0) {
      state.isReviewMode = true;
      state.imageTabs = localData.extractedImages;
      state.selectedTabIds = new Set(state.imageTabs.map(tab => tab.id));

      console.log('Review mode: loaded extracted images:', state.imageTabs.length);

      // Update UI for Review Mode
      const headerTitle = document.querySelector('h2');
      if (headerTitle) headerTitle.childNodes[0].textContent = 'Extracted Images ';

      if (elements.closeTabs) {
        elements.closeTabs.parentElement.style.display = 'none';
      }

      if (elements.refreshBtn) {
        elements.refreshBtn.textContent = 'Cancel Review';
        elements.refreshBtn.title = 'Clear extracted images and return to tab mode';
      }

      // Render all at once for review mode as they are already in storage
      renderImagesList();
      updateTabBadges();
      updateSaveButton();
    } else {
      state.isReviewMode = false;

      // Normal mode: Query tabs and filter progressively
      const tabs = await chrome.tabs.query({ currentWindow: true });

      if (elements.imagesList) elements.imagesList.innerHTML = '';

      // Batch updates to avoid overwhelming the UI thread
      let batchCount = 0;
      const BATCH_SIZE = 10;

      for (const tab of tabs) {
        if (isImageUrl(tab.url)) {
          const tabData = {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl
          };

          state.imageTabs.push(tabData);
          state.selectedTabIds.add(tab.id);

          // Append to UI immediately
          const tabItem = createTabItem(tabData);
          elements.imagesList.appendChild(tabItem);

          batchCount++;
          if (batchCount >= BATCH_SIZE) {
            updateTabBadges();
            updateSaveButton();
            batchCount = 0;
            // Yield to UI thread
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
        }
      }

      // Final UI updates
      updateTabBadges();
      updateSaveButton();

      if (state.imageTabs.length === 0) {
        renderEmptyState(elements.imagesList, 'No image tabs found');
      }
    }

    if (elements.selectAllImages) elements.selectAllImages.checked = true;

  } catch (error) {
    console.error('Error loading image tabs:', error);
    showStatus('Failed to load image tabs', 'error');
    if (elements.imagesList) {
      renderEmptyState(elements.imagesList, 'Error loading tabs');
    }
  } finally {
    state.loading = false;
  }
}

/**
 * Load detected videos for the current tab
 */
async function loadVideos() {
  try {
    if (!state.currentTabId) {
      console.log('No current tab ID, skipping video load');
      return;
    }

    const response = await sendMessageToBackground({
      action: 'getDetectedVideos',
      tabId: state.currentTabId
    });

    if (response.success && response.videos) {
      state.videos = response.videos;
      state.selectedVideoUrls = new Set(state.videos.map(v => v.url));
      console.log('Loaded videos:', state.videos.length);
    }
  } catch (error) {
    console.error('Error loading videos:', error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Tab navigation
  elements.imagesTabBtn?.addEventListener('click', () => switchTab('images'));
  elements.videosTabBtn?.addEventListener('click', () => switchTab('videos'));

  // Video help link
  elements.videoHelpLink?.addEventListener('click', (e) => {
    e.preventDefault();
    showVideoHelp();
  });

  // Listen for progress updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'downloadProgress') {
      updateProgressUI(message.current, message.total);
    } else if (message.action === 'videoDownloadProgress') {
      updateProgressUI(message.current, message.total);
    } else if (message.action === 'videoDetected') {
      // Reload videos when a new one is detected
      if (message.tabId === state.currentTabId) {
        loadVideos().then(() => {
          renderVideosList();
          updateTabBadges();
        });
      }
    }
  });

  // Save all button
  elements.saveAllBtn?.addEventListener('click', handleSaveAll);

  // Refresh button
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', async () => {
      if (state.isReviewMode) {
        await chrome.storage.local.remove(['extractedImages', 'extractorSourceUrl']);
        state.isReviewMode = false;
        if (elements.closeTabsGroup) elements.closeTabsGroup.style.display = 'flex';
      }

      // Reload based on active tab
      if (state.activeTab === 'images') {
        await loadImageTabs();
      } else {
        await loadVideos();
        renderVideosList();
      }
      updateTabBadges();
    });
  }

  // Settings link
  elements.settingsLink?.addEventListener('click', handleOpenSettings);

  // Select all checkboxes
  elements.selectAllImages?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      state.selectedTabIds = new Set(state.imageTabs.map(tab => tab.id));
    } else {
      state.selectedTabIds.clear();
    }
    renderImagesList();
    updateSaveButton();
  });

  elements.selectAllVideos?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      state.selectedVideoUrls = new Set(state.videos.map(v => v.url));
    } else {
      state.selectedVideoUrls.clear();
    }
    renderVideosList();
    updateSaveButton();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);
}

/**
 * Switch between Images and Videos tabs
 */
function switchTab(tabName) {
  state.activeTab = tabName;

  // Update tab buttons
  elements.imagesTabBtn?.classList.toggle('active', tabName === 'images');
  elements.videosTabBtn?.classList.toggle('active', tabName === 'videos');

  // Update sections
  elements.imagesSection?.classList.toggle('hidden', tabName !== 'images');
  elements.videosSection?.classList.toggle('hidden', tabName !== 'videos');

  // Update save button text
  if (elements.saveButtonText) {
    elements.saveButtonText.textContent = tabName === 'images' ? 'Save All Images' : 'Save All Videos';
  }

  // Update close tabs checkbox visibility (only for images)
  if (elements.closeTabsGroup) {
    elements.closeTabsGroup.style.display = tabName === 'images' ? 'flex' : 'none';
  }

  // Render appropriate list if not already rendered
  if (tabName === 'images') {
    if (!elements.imagesList?.children.length || elements.imagesList?.querySelector('.loading')) {
      renderImagesList();
    }
  } else {
    if (!elements.videosList?.children.length || elements.videosList?.querySelector('.loading')) {
      renderVideosList();
    }
  }

  updateSaveButton();
}

/**
 * Update tab badges with counts
 */
function updateTabBadges() {
  if (elements.imageBadge) {
    const imageCount = state.isReviewMode ? state.imageTabs.length : state.selectedTabIds.size;
    elements.imageBadge.textContent = imageCount.toString();
  }

  if (elements.videoBadge) {
    elements.videoBadge.textContent = state.videos.length.toString();
  }
}

/**
 * Show video help dialog
 */
function showVideoHelp() {
  const help = `Video Detection Help

Videos are automatically detected when they load on a web page.

Supported:
✓ Direct MP4, WebM, MOV files
✓ Videos with referer/cookie protection

Not Supported:
✗ HLS/DASH streaming (.m3u8, .mpd)
✗ DRM-protected videos (Netflix, etc.)
✗ YouTube videos (use youtube-dl instead)

Tip: Play a video on the page to trigger detection!`;

  alert(help);
}

/**
 * Update the save button with progress
 */
function updateProgressUI(current, total) {
  if (elements.saveAllBtn) {
    const percentage = Math.round((current / total) * 100);
    elements.saveAllBtn.style.setProperty('--progress', `${percentage}%`);
    elements.saveAllBtn.textContent = `💾 Saving (${current}/${total})...`;
    elements.saveAllBtn.classList.add('btn-progress');
  }
}

/**
 * Handle select all toggle
 */
function handleSelectAllToggle(event) {
  const isChecked = event.target.checked;
  if (isChecked) {
    state.selectedTabIds = new Set(state.imageTabs.map(tab => tab.id));
  } else {
    state.selectedTabIds.clear();
  }

  // Re-render list to update checkboxes
  renderTabsList();
  updateImageCount();
  updateSaveButton();
}

/**
 * Handle save all button click
 * Sends a message to background script to download all images or videos
 */
async function handleSaveAll() {
  const folderName = elements.folderName?.value.trim() || '';

  try {
    // Handle based on active tab
    if (state.activeTab === 'images') {
      if (state.selectedTabIds.size === 0) {
        showStatus('No images selected', 'error');
        return;
      }

      const selectedTabs = state.imageTabs.filter(tab => state.selectedTabIds.has(tab.id));
      const shouldClose = elements.closeTabs?.checked ?? false;

      // Disable button and show progress
      updateButtonState('saving', 0, selectedTabs.length);

      let response;
      if (state.isReviewMode) {
        // Send selected extracted images to background
        const imagesToSave = selectedTabs.map(tab => ({
          url: tab.url,
          title: tab.title
        }));
        response = await sendMessageToBackground({
          action: 'saveExtractedImages',
          images: imagesToSave,
          folderName: folderName
        });

        // Cleanup review mode on success
        if (response.success) {
          await chrome.storage.local.remove(['extractedImages', 'extractorSourceUrl']);
        }
      } else {
        // Normal tab mode - SEND IDS ONLY to avoid messaging limit
        const selectedTabIds = selectedTabs.map(tab => tab.id);
        response = await sendMessageToBackground({
          action: 'saveImages',
          tabIds: selectedTabIds,
          folderName: folderName,
          closeTabs: shouldClose
        });
      }

      if (response.success) {
        showStatus(`Started downloading ${response.count} image(s)`, 'success');
        elements.saveAllBtn.textContent = '💾 Done!';
        elements.saveAllBtn.style.setProperty('--progress', '100%');

        // Close popup after a short delay if all tabs were closed anyway
        if (elements.closeTabs?.checked) {
          setTimeout(() => window.close(), 1000);
        } else {
          // Reset button after 2 seconds
          setTimeout(() => {
            elements.saveAllBtn.classList.remove('btn-progress');
            elements.saveAllBtn.style.removeProperty('--progress');
            updateSaveButton();
            if (elements.saveButtonText) {
              elements.saveButtonText.textContent = 'Save All Images';
            }
            loadImageTabs(); // Update list in case some tabs were manually closed
          }, 2000);
        }
      } else {
        throw new Error(response.error || 'Failed to save images');
      }
    } else {
      // Videos tab
      if (state.selectedVideoUrls.size === 0) {
        showStatus('No videos selected', 'error');
        return;
      }

      const selectedVideos = state.videos.filter(v => state.selectedVideoUrls.has(v.url));

      // Disable button and show progress
      updateButtonState('saving', 0, selectedVideos.length);

      const response = await sendMessageToBackground({
        action: 'saveVideos',
        videos: selectedVideos,
        folderName: folderName
      });

      if (response.success) {
        const message = response.failed > 0
          ? `Downloaded ${response.downloaded}/${response.downloaded + response.failed} videos`
          : `Downloaded ${response.downloaded} video(s)`;
        showStatus(message, response.failed > 0 ? 'error' : 'success');

        elements.saveAllBtn.textContent = '💾 Done!';
        elements.saveAllBtn.style.setProperty('--progress', '100%');

        // Reset button after 2 seconds
        setTimeout(() => {
          elements.saveAllBtn.classList.remove('btn-progress');
          elements.saveAllBtn.style.removeProperty('--progress');
          updateSaveButton();
          if (elements.saveButtonText) {
            elements.saveButtonText.textContent = 'Save All Videos';
          }
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to save videos');
      }
    }
  } catch (error) {
    console.error('Error saving:', error);
    showStatus(`Failed to save ${state.activeTab}`, 'error');
    elements.saveAllBtn.classList.remove('btn-progress');
    elements.saveAllBtn.disabled = false;
    if (elements.saveButtonText) {
      elements.saveButtonText.textContent = state.activeTab === 'images' ? 'Save All Images' : 'Save All Videos';
    }
  }
}

/**
 * Handle refresh button click
 * Reloads the list of image tabs
 */
async function handleRefresh() {
  console.log('Refresh clicked');

  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = '🔄 Refreshing...';

  try {
    await loadImageTabs();
    showStatus('Refreshed successfully', 'success');
  } catch (error) {
    console.error('Error refreshing:', error);
    showStatus('Failed to refresh', 'error');
  } finally {
    elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span>Refresh';
    elements.refreshBtn.disabled = false;
  }
}

/**
 * Handle settings link click
 * Opens the extension's options page
 */
function handleOpenSettings(event) {
  event.preventDefault();
  console.log('Opening settings');

  // Open options page in a new tab
  chrome.runtime.openOptionsPage();

  // Optional: Close popup after opening settings
  // window.close();
}

/**
 * Handle keyboard shortcuts in the popup
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyPress(event) {
  // Ctrl/Cmd + S: Save all images
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    handleSaveAll();
  }

  // Escape: Close popup
  if (event.key === 'Escape') {
    window.close();
  }

  // F5 or Ctrl/Cmd + R: Refresh
  if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'r')) {
    event.preventDefault();
    handleRefresh();
  }
}

// ============================================================================
// UI RENDERING
// ============================================================================


/**
 * Update the save button state
 * Disable if no items to save based on active tab
 */
function updateSaveButton() {
  if (elements.saveAllBtn) {
    const hasSelection = state.activeTab === 'images'
      ? state.selectedTabIds.size > 0
      : state.selectedVideoUrls.size > 0;
    elements.saveAllBtn.disabled = !hasSelection;
  }
}

/**
 * Render the list of image tabs
 */
function renderImagesList() {
  if (!elements.imagesList) return;

  // Clear existing content
  elements.imagesList.innerHTML = '';

  // Show empty state if no tabs
  if (state.imageTabs.length === 0) {
    renderEmptyState(elements.imagesList, 'No image tabs found');
    return;
  }

  // Create tab items
  state.imageTabs.forEach(tab => {
    const tabItem = createTabItem(tab);
    elements.imagesList.appendChild(tabItem);
  });
}

/**
 * Render the list of detected videos
 */
function renderVideosList() {
  if (!elements.videosList) return;

  // Clear existing content
  elements.videosList.innerHTML = '';

  // Show empty state if no videos
  if (state.videos.length === 0) {
    renderEmptyState(elements.videosList, 'No videos detected yet. Play a video on this page to detect it.');
    return;
  }

  // Create video items
  state.videos.forEach(video => {
    const videoItem = createVideoItem(video);
    elements.videosList.appendChild(videoItem);
  });
}

/**
 * Create a tab item element
 * @param {Object} tab - Tab data
 * @returns {HTMLElement} - Tab item element
 */
function createTabItem(tab) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.title = tab.url;

  // Selection Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-item-checkbox';
  checkbox.checked = state.selectedTabIds.has(tab.id);
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger tab switch
    if (checkbox.checked) {
      state.selectedTabIds.add(tab.id);
    } else {
      state.selectedTabIds.delete(tab.id);
      if (elements.selectAllImages) elements.selectAllImages.checked = false;
    }
    updateTabBadges();
    updateSaveButton();
  });

  // Icon / Preview
  const icon = document.createElement('div');
  icon.className = 'tab-item-icon';

  const img = document.createElement('img');
  img.src = tab.url;
  // Fallback for data URLs that might not render or broken links
  img.onerror = () => { img.src = '../icons/icon48.png'; };
  icon.appendChild(img);

  // Content
  const content = document.createElement('div');
  content.className = 'tab-item-content';

  // Title
  const title = document.createElement('div');
  title.className = 'tab-item-title';
  title.textContent = tab.title || 'Untitled';

  // URL
  const url = document.createElement('div');
  url.className = 'tab-item-url';
  url.textContent = tab.url;

  // Assemble
  content.appendChild(title);
  content.appendChild(url);
  item.appendChild(checkbox);
  item.appendChild(icon);
  item.appendChild(content);

  // Click handler - switch to tab
  item.addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
    window.close();
  });

  return item;
}

/**
 * Create a video item element
 * @param {Object} video - Video metadata
 * @returns {HTMLElement} - Video item element
 */
function createVideoItem(video) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.title = video.url;

  // Selection Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-item-checkbox';
  checkbox.checked = state.selectedVideoUrls.has(video.url);
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    if (checkbox.checked) {
      state.selectedVideoUrls.add(video.url);
    } else {
      state.selectedVideoUrls.delete(video.url);
      if (elements.selectAllVideos) elements.selectAllVideos.checked = false;
    }
    updateSaveButton();
  });

  // Icon - video emoji
  const icon = document.createElement('div');
  icon.className = 'tab-item-icon';
  icon.style.fontSize = '32px';
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.textContent = '🎬';

  // Content
  const content = document.createElement('div');
  content.className = 'tab-item-content';

  // Title with size info
  const title = document.createElement('div');
  title.className = 'tab-item-title';
  const filename = video.filename || 'video.mp4';
  const sizeInfo = video.contentLength ? ` (${formatFileSize(video.contentLength)})` : '';
  title.textContent = filename + sizeInfo;

  // URL
  const url = document.createElement('div');
  url.className = 'tab-item-url';
  url.textContent = video.url;

  // Assemble
  content.appendChild(title);
  content.appendChild(url);
  item.appendChild(checkbox);
  item.appendChild(icon);
  item.appendChild(content);

  // Click handler - copy URL to clipboard
  item.addEventListener('click', () => {
    navigator.clipboard.writeText(video.url).then(() => {
      showStatus('Video URL copied to clipboard', 'success');
    });
  });

  return item;
}

/**
 * Render empty state
 * @param {HTMLElement} container - Container element
 * @param {string} message - Optional custom message
 */
function renderEmptyState(container, message) {
  if (!container) return;

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.textContent = '📂';

  const text = document.createElement('div');
  text.className = 'empty-state-text';
  text.textContent = message || 'No items found';

  emptyState.appendChild(icon);
  emptyState.appendChild(text);
  container.appendChild(emptyState);
}

/**
 * Update the save button state and progress bar
 * @param {string} state - 'idle', 'saving', or 'done'
 * @param {number} current - Current progress
 * @param {number} total - Total items
 */
function updateButtonState(state, current = 0, total = 0) {
  if (!elements.saveAllBtn) return;

  switch (state) {
    case 'saving':
      elements.saveAllBtn.disabled = true;
      elements.saveAllBtn.classList.add('btn-progress');
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      elements.saveAllBtn.style.setProperty('--progress', `${percent}%`);
      elements.saveAllBtn.textContent = `💾 Saving (${current}/${total})...`;
      break;

    case 'done':
      elements.saveAllBtn.disabled = true;
      elements.saveAllBtn.classList.add('btn-progress');
      elements.saveAllBtn.style.setProperty('--progress', '100%');
      elements.saveAllBtn.textContent = '💾 Done!';
      break;

    case 'idle':
    default:
      elements.saveAllBtn.disabled = false;
      elements.saveAllBtn.classList.remove('btn-progress');
      elements.saveAllBtn.style.removeProperty('--progress');
      elements.saveAllBtn.innerHTML = '<span class="btn-icon">💾</span>Save All Images';
      break;
  }
}

/**
 * Show status message to user
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showStatus(message, type = 'success') {
  if (!elements.statusMessage) return;

  // Set message and type
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
  }, 3000);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send a message to the background script
 * Wraps chrome.runtime.sendMessage in a Promise for easier async/await usage
 *
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} - Response from background script
 */
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      // Check for errors
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

/**
 * Send a message to a specific tab's content script
 * @param {number} tabId - ID of the tab
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} - Response from content script
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

/**
 * Check if a URL is an image
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL appears to be an image
 */
function isImageUrl(url) {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
  const urlLower = url.toLowerCase().split('?')[0].split('#')[0];
  return imageExtensions.some(ext => urlLower.endsWith(ext));
}

/**
 * Format a number for display
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Format a file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

/**
 * Log current state for debugging
 * Call this from the browser console: popup.debugState()
 */
window.debugState = function () {
  console.log('Current State:', state);
  console.log('DOM Elements:', elements);
};

/**
 * Export functions for testing (if needed)
 * This allows you to test popup functions from the console
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendMessageToBackground,
    sendMessageToTab,
    formatNumber,
    formatFileSize
  };
}

// ============================================================================
// NOTES FOR DEVELOPERS
// ============================================================================

/**
 * BEST PRACTICES:
 *
 * 1. Keep popup loading fast - minimize external resources and API calls
 * 2. Cache DOM elements - don't query the same element multiple times
 * 3. Use async/await for cleaner asynchronous code
 * 4. Always handle errors - show user-friendly error messages
 * 5. Disable buttons during async operations to prevent double-clicks
 * 6. Use chrome.storage for data that needs to persist between popup opens
 * 7. Test with different states (no tabs, many tabs, slow network, etc.)
 * 8. Make the UI responsive to user actions
 *
 * DEBUGGING:
 *
 * 1. Right-click extension icon -> Inspect popup
 * 2. Console logs appear in popup DevTools
 * 3. Popup closes when DevTools loses focus (can be annoying)
 * 4. Use debugger statements to pause execution
 * 5. Call window.debugState() to inspect current state
 *
 * COMMUNICATION PATTERNS:
 *
 * 1. Popup -> Background: chrome.runtime.sendMessage()
 * 2. Popup -> Content Script: chrome.tabs.sendMessage(tabId, message)
 * 3. Background -> Popup: Not directly possible (popup must request data)
 * 4. Use chrome.storage.onChanged to react to storage updates
 *
 * COMMON ISSUES:
 *
 * 1. "Extension context invalidated" - Happens after extension update/reload
 * 2. Popup doesn't preserve state - Reload data on each open
 * 3. Messages not received - Check that background script is running
 * 4. Async timing issues - Use proper async/await or .then() chains
 */

console.log('Popup script loaded successfully');
