/**
 * Popup JavaScript
 *
 * This script handles the popup UI logic and user interactions.
 * The popup has its own JavaScript context, separate from content scripts and background.
 *
 * POPUP LIFECYCLE:
 * - Opens when user clicks extension icon
 * - Closes when user clicks outside or switches tabs
 * - State is not preserved between opens (reload each time)
 *
 * COMMUNICATION:
 * - Use chrome.runtime.sendMessage() to communicate with background script
 * - Use chrome.tabs.sendMessage() to communicate with content scripts
 * - Use chrome.storage to persist data between popup sessions
 *
 * TIPS:
 * - Keep popup loading fast (minimize external requests)
 * - Cache data when possible
 * - Show loading states for async operations
 * - Handle errors gracefully (network, permissions, etc.)
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
  settings: {},
  loading: true
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/**
 * Cache DOM element references for better performance
 * Always check if elements exist before using them
 */
const elements = {
  imageCount: document.getElementById('imageCount'),
  tabsList: document.getElementById('tabsList'),
  saveAllBtn: document.getElementById('saveAllBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  settingsLink: document.getElementById('settingsLink'),
  statusMessage: document.getElementById('statusMessage'),
  folderName: document.getElementById('folderName'),
  closeTabs: document.getElementById('closeTabs'),
  selectAll: document.getElementById('selectAll')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the popup when the DOM is loaded
 * This is the entry point for the popup script
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  try {
    // Load settings and image tabs in parallel
    await Promise.all([
      loadSettings(),
      loadImageTabs()
    ]);

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Failed to load extension', 'error');
  }
});

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load user settings from storage
 * Settings are stored in chrome.storage.sync and synced across devices
 */
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

    // Request image tabs from background script
    const response = await sendMessageToBackground({ action: 'getImageTabs' });

    if (response.success) {
      state.imageTabs = response.tabs;
      console.log('Image tabs loaded:', state.imageTabs.length);

      // Initialize selection: select all by default
      state.selectedTabIds = new Set(state.imageTabs.map(tab => tab.id));
      if (elements.selectAll) elements.selectAll.checked = true;

      // Update UI
      updateImageCount();
      renderTabsList();
      updateSaveButton();
    } else {
      throw new Error(response.error || 'Failed to load image tabs');
    }
  } catch (error) {
    console.error('Error loading image tabs:', error);
    showStatus('Failed to load image tabs', 'error');
    renderEmptyState('Error loading tabs');
  } finally {
    state.loading = false;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Set up all event listeners for user interactions
 */
function setupEventListeners() {
  // Save all images button
  elements.saveAllBtn?.addEventListener('click', handleSaveAll);

  // Refresh button
  elements.refreshBtn?.addEventListener('click', handleRefresh);

  // Settings link
  elements.settingsLink?.addEventListener('click', handleOpenSettings);

  // Select all checkbox
  elements.selectAll?.addEventListener('change', handleSelectAllToggle);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);

  // Listen for progress updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'downloadProgress') {
      updateProgressUI(message.current, message.total);
    }
  });
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
 * Sends a message to background script to download all images
 */
async function handleSaveAll() {
  console.log('Save all clicked');

  if (state.imageTabs.length === 0) {
    showStatus('No image tabs to save', 'error');
    return;
  }

  try {
    // Extract selected tabs
    const selectedTabs = state.imageTabs.filter(tab => state.selectedTabIds.has(tab.id));

    if (selectedTabs.length === 0) {
      showStatus('No items selected', 'error');
      return;
    }

    // Disable button while saving
    elements.saveAllBtn.disabled = true;
    elements.saveAllBtn.classList.add('btn-progress');
    elements.saveAllBtn.style.setProperty('--progress', '0%');
    elements.saveAllBtn.textContent = '💾 Starting...';

    // Send message to background script to save images
    const response = await sendMessageToBackground({
      action: 'saveImages',
      tabs: selectedTabs.map(tab => ({ id: tab.id, url: tab.url, title: tab.title })),
      folderName: elements.folderName?.value || '',
      closeTabs: elements.closeTabs?.checked || false
    });

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
          elements.saveAllBtn.innerHTML = '<span class="btn-icon">💾</span>Save All Images';
          handleRefresh(); // Update list in case some tabs were manually closed
        }, 2000);
      }
    } else {
      throw new Error(response.error || 'Failed to save images');
    }
  } catch (error) {
    console.error('Error saving images:', error);
    showStatus('Failed to save images', 'error');
    elements.saveAllBtn.classList.remove('btn-progress');
    elements.saveAllBtn.disabled = false;
    elements.saveAllBtn.innerHTML = '<span class="btn-icon">💾</span>Save All Images';
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
 * Update the image count display
 */
function updateImageCount() {
  if (elements.imageCount) {
    const selectedCount = state.selectedTabIds.size;
    const totalCount = state.imageTabs.length;
    elements.imageCount.textContent = totalCount > 0 ? `${selectedCount} / ${totalCount}` : '0';
  }
}

/**
 * Update the save button state
 * Disable if no images to save
 */
function updateSaveButton() {
  if (elements.saveAllBtn) {
    elements.saveAllBtn.disabled = state.selectedTabIds.size === 0;
  }
}

/**
 * Render the list of image tabs
 */
function renderTabsList() {
  if (!elements.tabsList) return;

  // Clear existing content
  elements.tabsList.innerHTML = '';

  // Show empty state if no tabs
  if (state.imageTabs.length === 0) {
    renderEmptyState();
    return;
  }

  // Create tab items
  state.imageTabs.forEach(tab => {
    const tabItem = createTabItem(tab);
    elements.tabsList.appendChild(tabItem);
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
      if (elements.selectAll) elements.selectAll.checked = false;
    }
    updateImageCount();
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
 * Render empty state when no image tabs found
 * @param {string} message - Optional custom message
 */
function renderEmptyState(message) {
  if (!elements.tabsList) return;

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-state-icon';
  icon.textContent = '📂';

  const text = document.createElement('div');
  text.className = 'empty-state-text';
  text.textContent = message || 'No image tabs found';

  emptyState.appendChild(icon);
  emptyState.appendChild(text);
  elements.tabsList.appendChild(emptyState);
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
