/**
 * Options Page JavaScript
 * 
 * This script handles the options/settings page functionality.
 * The options page allows users to configure extension behavior.
 * 
 * KEY DIFFERENCES FROM POPUP:
 * - Opens in full tab (more space for complex settings)
 * - Persists while open (unlike popup which closes easily)
 * - Changes are typically saved explicitly with a "Save" button
 * - Can have multiple sections and complex forms
 * 
 * STORAGE:
 * - Use chrome.storage.sync for settings that sync across devices
 * - Use chrome.storage.local for device-specific settings
 * - Always provide default values for all settings
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
  maxConcurrent: 3,
  fileNaming: '{name}_{date}'
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
  fileNaming: document.getElementById('fileNaming'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
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
    if (elements.fileNaming) {
      elements.fileNaming.value = settings.fileNaming;
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
      fileNaming: elements.fileNaming?.value ?? DEFAULT_SETTINGS.fileNaming
    };
    
    // Validate settings
    if (settings.maxConcurrent < 1 || settings.maxConcurrent > 10) {
      throw new Error('Max concurrent downloads must be between 1 and 10');
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
window.debugState = async function() {
  const settings = await chrome.storage.sync.get(null);
  console.log('Current settings:', settings);
  console.log('Form elements:', elements);
};

// ============================================================================
// NOTES FOR DEVELOPERS
// ============================================================================

/**
 * BEST PRACTICES:
 * 
 * 1. Always provide default values for all settings
 * 2. Validate user input before saving
 * 3. Show clear feedback when settings are saved
 * 4. Consider auto-save vs manual save based on use case
 * 5. Support import/export for advanced users
 * 6. Organize settings into logical sections
 * 7. Provide helpful descriptions for each setting
 * 8. Test with extreme values and edge cases
 * 
 * STORAGE TIPS:
 * 
 * 1. chrome.storage.sync: Max 100KB, syncs across devices
 * 2. chrome.storage.local: Max 5MB, local to device
 * 3. Use storage.sync for user preferences
 * 4. Use storage.local for large data or device-specific data
 * 5. Always handle storage errors gracefully
 * 6. Consider migration strategy for setting changes
 * 
 * FORM VALIDATION:
 * 
 * 1. Validate on client side before saving
 * 2. Provide clear error messages
 * 3. Use HTML5 input types and attributes (min, max, pattern)
 * 4. Disable save button if form is invalid
 * 5. Highlight invalid fields
 * 
 * ACCESSIBILITY:
 * 
 * 1. Use proper label elements
 * 2. Ensure keyboard navigation works
 * 3. Provide ARIA labels where needed
 * 4. Test with screen readers
 * 5. Ensure sufficient color contrast
 */

console.log('Options page script loaded successfully');
