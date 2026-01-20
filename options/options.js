/**
 * Options Page Logic for Save Image Tabs
 * Manages configuration and settings persistence.
 */

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Default settings for the extension
 * These are used when the extension is first installed or settings are reset
 */
const DEFAULT_SETTINGS = {
  autoDownload: false,
  downloadFormat: 'original',
  saveLocation: 'downloads',
  notification: true,
  maxConcurrent: 5,
  maxTabsToOpen: 30,
  minImageSize: 500,
  fileNaming: '{name}_{date}',
  // Video settings
  minVideoSize: 1, // Minimum video size in MB
  enableVideoDetection: true
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/**
 * Cache DOM element references
 */
const elements = {
  autoDownload: document.getElementById('autoDownload'),
  downloadFormat: document.getElementById('downloadFormat'),
  saveLocation: document.getElementById('saveLocation'),
  notification: document.getElementById('notification'),
  maxConcurrent: document.getElementById('maxConcurrent'),
  minImageSize: document.getElementById('minImageSize'),
  maxTabsToOpen: document.getElementById('maxTabsToOpen'),
  fileNaming: document.getElementById('fileNaming'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  closeTabs: document.getElementById('closeTabs'),
  enableVideoDetection: document.getElementById('enableVideoDetection'),
  minVideoSize: document.getElementById('minVideoSize'),
  importFile: document.getElementById('importFile'),
  statusMessage: document.getElementById('statusMessage')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the options page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Options page loaded');

  try {
    // Load current settings
    await loadSettings();

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Error initializing options page:', error);
    showStatus('Failed to load settings', 'error');
  }
});

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Load settings from chrome.storage and populate form
 */
async function loadSettings() {
  try {
    // Get settings from storage (will use defaults for missing values)
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    console.log('Settings loaded:', settings);

    // Populate form with settings
    if (elements.autoDownload) {
      elements.autoDownload.checked = settings.autoDownload;
    }
    if (elements.downloadFormat) {
      elements.downloadFormat.value = settings.downloadFormat;
    }
    if (elements.saveLocation) {
      elements.saveLocation.value = settings.saveLocation;
    }
    if (elements.notification) {
      elements.notification.checked = settings.notification;
    }
    if (elements.maxConcurrent) {
      elements.maxConcurrent.value = settings.maxConcurrent;
    }
    if (elements.minImageSize) {
      elements.minImageSize.value = settings.minImageSize;
    }
    if (elements.maxTabsToOpen) {
      elements.maxTabsToOpen.value = settings.maxTabsToOpen;
    }
    if (elements.fileNaming) {
      elements.fileNaming.value = settings.fileNaming;
    }
    if (elements.enableVideoDetection) {
      elements.enableVideoDetection.checked = settings.enableVideoDetection;
    }
    if (elements.minVideoSize) {
      elements.minVideoSize.value = settings.minVideoSize;
    }

  } catch (error) {
    console.error('Error loading settings:', error);
    throw error;
  }
}

/**
 * Save settings to chrome.storage
 */
async function saveSettings() {
  try {
    // Collect settings from form
    const settings = {
      autoDownload: elements.autoDownload?.checked ?? DEFAULT_SETTINGS.autoDownload,
      downloadFormat: elements.downloadFormat?.value ?? DEFAULT_SETTINGS.downloadFormat,
      saveLocation: elements.saveLocation?.value ?? DEFAULT_SETTINGS.saveLocation,
      notification: elements.notification?.checked ?? DEFAULT_SETTINGS.notification,
      maxConcurrent: parseInt(elements.maxConcurrent?.value) ?? DEFAULT_SETTINGS.maxConcurrent,
      minImageSize: parseInt(elements.minImageSize?.value) ?? DEFAULT_SETTINGS.minImageSize,
      maxTabsToOpen: parseInt(elements.maxTabsToOpen?.value) ?? DEFAULT_SETTINGS.maxTabsToOpen,
      fileNaming: elements.fileNaming?.value ?? DEFAULT_SETTINGS.fileNaming,
      enableVideoDetection: elements.enableVideoDetection?.checked ?? DEFAULT_SETTINGS.enableVideoDetection,
      minVideoSize: parseFloat(elements.minVideoSize?.value) ?? DEFAULT_SETTINGS.minVideoSize
    };

    // Validate settings
    if (settings.maxConcurrent < 1 || settings.maxConcurrent > 20) {
      throw new Error('Max concurrent downloads must be between 1 and 20');
    }

    // Save to chrome.storage.sync
    await chrome.storage.sync.set(settings);

    console.log('Settings saved:', settings);
    showStatus('Settings saved successfully!', 'success');

  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus(`Failed to save settings: ${error.message}`, 'error');
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
  try {
    // Confirm with user
    const confirmed = confirm('Are you sure you want to reset all settings to defaults?');
    if (!confirmed) return;

    // Set default settings
    await chrome.storage.sync.set(DEFAULT_SETTINGS);

    // Reload the form with defaults
    await loadSettings();

    console.log('Settings reset to defaults');
    showStatus('Settings reset to defaults', 'success');

  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('Failed to reset settings', 'error');
  }
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export settings to a JSON file
 */
async function exportSettings() {
  try {
    // Get current settings
    const settings = await chrome.storage.sync.get(null);

    // Create JSON string
    const json = JSON.stringify(settings, null, 2);

    // Create blob and download link
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temporary download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-settings-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Settings exported');
    showStatus('Settings exported successfully!', 'success');

  } catch (error) {
    console.error('Error exporting settings:', error);
    showStatus('Failed to export settings', 'error');
  }
}

/**
 * Import settings from a JSON file
 */
async function importSettings() {
  try {
    // Trigger file input click
    elements.importFile?.click();

  } catch (error) {
    console.error('Error importing settings:', error);
    showStatus('Failed to import settings', 'error');
  }
}

/**
 * Handle file selection for import
 * @param {Event} event - File input change event
 */
async function handleFileImport(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;

    // Read file
    const text = await file.text();
    const settings = JSON.parse(text);

    // Validate settings object
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Invalid settings file');
    }

    // Merge with defaults to ensure all required fields exist
    const validatedSettings = { ...DEFAULT_SETTINGS, ...settings };

    // Save to storage
    await chrome.storage.sync.set(validatedSettings);

    // Reload the form
    await loadSettings();

    console.log('Settings imported:', validatedSettings);
    showStatus('Settings imported successfully!', 'success');

  } catch (error) {
    console.error('Error handling file import:', error);
    showStatus(`Failed to import settings: ${error.message}`, 'error');
  } finally {
    // Clear file input
    if (elements.importFile) {
      elements.importFile.value = '';
    }
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Save button
  elements.saveBtn?.addEventListener('click', saveSettings);

  // Reset button
  elements.resetBtn?.addEventListener('click', resetSettings);

  // Export button
  elements.exportBtn?.addEventListener('click', exportSettings);

  // Import button
  elements.importBtn?.addEventListener('click', importSettings);

  // File input for import
  elements.importFile?.addEventListener('change', handleFileImport);

  // Auto-save on change (optional - comment out if you prefer manual save)
  /*
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      saveSettings();
    });
  });
  */

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyPress(event) {
  // Ctrl/Cmd + S: Save settings
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveSettings();
  }

  // Ctrl/Cmd + E: Export settings
  if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
    event.preventDefault();
    exportSettings();
  }

  // Ctrl/Cmd + I: Import settings
  if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
    event.preventDefault();
    importSettings();
  }
}

// ============================================================================
// UI UTILITIES
// ============================================================================

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
// STORAGE LISTENERS
// ============================================================================

/**
 * Listen for storage changes
 * This allows the options page to update if settings are changed elsewhere
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', changes, 'in', areaName);

  // Reload settings if changed in sync storage
  if (areaName === 'sync') {
    loadSettings();
  }
});

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {boolean} - True if valid
 */
function validateSetting(key, value) {
  switch (key) {
    case 'maxConcurrent':
      return typeof value === 'number' && value >= 1 && value <= 10;

    case 'downloadFormat':
      return ['original', 'png', 'jpg'].includes(value);

    case 'autoDownload':
    case 'notification':
      return typeof value === 'boolean';

    case 'saveLocation':
    case 'fileNaming':
      return typeof value === 'string' && value.length > 0;

    default:
      return true;
  }
}

// ============================================================================
// DEBUGGING
// ============================================================================

/**
 * Debug function to log current state
 * Call from console: options.debugState()
 */
window.debugState = async function () {
  const settings = await chrome.storage.sync.get(null);
  console.log('Current settings:', settings);
  console.log('Form elements:', elements);
};


console.log('Options page script loaded successfully');
