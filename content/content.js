/**
 * Content Script
 *
 * Content scripts run in the context of web pages, allowing you to read and modify
 * the DOM of web pages the user visits. They run in an isolated world, meaning:
 *
 * - They can access and modify the DOM
 * - They can't access variables or functions from the page's JavaScript
 * - They can't access variables or functions from the background script
 * - They must use message passing to communicate with background script
 *
 * WHEN TO USE CONTENT SCRIPTS:
 * - Extract data from web pages
 * - Modify the appearance or behavior of web pages
 * - Detect certain patterns or content on pages
 * - Inject UI elements into pages
 * - Monitor user interactions with the page
 *
 * IMPORTANT NOTES:
 * - Content scripts run on pages matching patterns in manifest.json
 * - They're injected into existing tabs when the extension is installed/updated
 * - They run in a separate JavaScript context from the page
 * - Use chrome.storage for persistence (not localStorage)
 * - Be careful about performance impact on page load
 */

// ============================================================================
// STATE
// ============================================================================

let lastRightClickY = 0;

// Listen for right-click to store coordinates
document.addEventListener('contextmenu', (e) => {
  lastRightClickY = e.pageY;
  console.log('Last right-click Y stored:', lastRightClickY);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize content script
 * This runs immediately when the script is injected
 */
(function () {
  'use strict';

  console.log('Content script loaded on:', window.location.href);

  // Check if this is an image page
  if (isImagePage()) {
    console.log('Image page detected');
    initializeImagePageFeatures();
  }

  // Initialize message listeners
  setupMessageListeners();

  // Initialize page observers (if needed)
  // observePageChanges();
})();

// ============================================================================
// IMAGE PAGE DETECTION
// ============================================================================

/**
 * Check if the current page is displaying a single image
 * Chrome displays images in a special viewer when you navigate directly to an image URL
 *
 * @returns {boolean} - True if this is an image page
 */
function isImagePage() {
  // Check if the document only contains an image element
  const body = document.body;

  if (!body) return false;

  // Chrome's image viewer has very specific structure
  if (body.children.length === 1 && body.children[0].tagName === 'IMG') {
    return true;
  }

  // Also check content type
  const contentType = document.contentType || '';
  return contentType.startsWith('image/');
}

/**
 * Get the image URL from the current page
 * @returns {string|null} - Image URL or null if not found
 */
function getImageUrl() {
  // For direct image pages
  if (document.body.children.length === 1 && document.body.children[0].tagName === 'IMG') {
    return document.body.children[0].src;
  }

  // Fallback to current URL
  return window.location.href;
}

// ============================================================================
// IMAGE PAGE FEATURES
// ============================================================================

/**
 * Initialize features for image pages
 * Add UI elements, keyboard shortcuts, etc.
 */
function initializeImagePageFeatures() {
  // Add download button overlay (optional)
  // addDownloadButton();

  // Add keyboard shortcuts
  addKeyboardShortcuts();

  // Add image info panel (optional)
  // addImageInfoPanel();
}

/**
 * Add a download button overlay to image pages
 * This is an example of injecting UI into a web page
 */
function addDownloadButton() {
  // Create button element
  const button = document.createElement('button');
  button.id = 'ext-download-btn';
  button.textContent = '💾 Download Image';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 10px 20px;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: all 0.2s ease;
  `;

  // Hover effect
  button.addEventListener('mouseenter', () => {
    button.style.background = '#3367d6';
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#4285f4';
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  });

  // Click handler
  button.addEventListener('click', () => {
    const imageUrl = getImageUrl();
    if (imageUrl) {
      downloadImage(imageUrl);
    }
  });

  // Add to page
  document.body.appendChild(button);
}

/**
 * Add keyboard shortcuts for image pages
 */
function addKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + S: Download image
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();

      const imageUrl = getImageUrl();
      if (imageUrl) {
        downloadImage(imageUrl);
      }
    }
  });
}

/**
 * Download an image
 * Sends a message to the background script to handle the download
 *
 * @param {string} url - Image URL to download
 */
function downloadImage(url) {
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'saveImages',
    urls: [url]
  }, (response) => {
    if (response && response.success) {
      console.log('Image download started');
      showNotification('Download started', 'success');
    } else {
      console.error('Failed to download image');
      showNotification('Failed to download', 'error');
    }
  });
}

// ============================================================================
// PAGE ANALYSIS
// ============================================================================

/**
 * Find all images on the current page
 * This can be used to extract images from any web page
 *
 * @param {Object} options - Filter options
 * @returns {Array<Object>} - Array of image objects
 */
function findImagesOnPage(options = {}) {
  const {
    minWidth = 0,
    minHeight = 0,
    includeBackgrounds = false
  } = options;

  const images = [];

  // Get all <img> elements
  const imgElements = document.querySelectorAll('img');

  imgElements.forEach((img, index) => {
    // Skip if too small
    if (img.naturalWidth < minWidth || img.naturalHeight < minHeight) {
      return;
    }

    images.push({
      type: 'img',
      url: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      element: img,
      index: index
    });
  });

  // Optionally find background images
  if (includeBackgrounds) {
    const elementsWithBg = document.querySelectorAll('*');

    elementsWithBg.forEach((element) => {
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        // Extract URL from background-image CSS property
        const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          images.push({
            type: 'background',
            url: urlMatch[1],
            element: element
          });
        }
      }
    });
  }

  return images;
}

/**
 * Get metadata about the current page
 * @returns {Object} - Page metadata
 */
function getPageMetadata() {
  return {
    title: document.title,
    url: window.location.href,
    description: document.querySelector('meta[name="description"]')?.content || '',
    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
    ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
    favicon: document.querySelector('link[rel="icon"]')?.href ||
      document.querySelector('link[rel="shortcut icon"]')?.href || '',
    imageCount: document.querySelectorAll('img').length
  };
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Set up listeners for messages from background script or popup
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);

    switch (message.action) {
      case 'getImages':
        handleGetImages(message, sendResponse);
        return true; // Will respond asynchronously

      case 'getPageInfo':
        handleGetPageInfo(sendResponse);
        return true;

      case 'highlightImages':
        handleHighlightImages(message, sendResponse);
        return true;

      case 'openImagesBelow':
        console.log('Received openImagesBelow request');
        handleOpenImagesBelow(message.limit);
        sendResponse({ success: true });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  });
}

/**
 * Handle request to get images from the page
 * @param {Object} message - Message with options
 * @param {Function} sendResponse - Response callback
 */
function handleGetImages(message, sendResponse) {
  try {
    const images = findImagesOnPage(message.options || {});
    sendResponse({ success: true, images: images });
  } catch (error) {
    console.error('Error getting images:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle request to get page information
 * @param {Function} sendResponse - Response callback
 */
function handleGetPageInfo(sendResponse) {
  try {
    const metadata = getPageMetadata();
    sendResponse({ success: true, metadata: metadata });
  } catch (error) {
    console.error('Error getting page info:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle request to highlight images on the page
 * @param {Object} message - Message with options
 * @param {Function} sendResponse - Response callback
 */
function handleHighlightImages(message, sendResponse) {
  try {
    const images = document.querySelectorAll('img');

    images.forEach((img) => {
      img.style.outline = '3px solid #4285f4';
      img.style.outlineOffset = '2px';
    });

    // Remove highlight after 2 seconds
    setTimeout(() => {
      images.forEach((img) => {
        img.style.outline = '';
        img.style.outlineOffset = '';
      });
    }, 2000);

    sendResponse({ success: true, count: images.length });
  } catch (error) {
    console.error('Error highlighting images:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// DOM MANIPULATION
// ============================================================================

/**
 * Observe changes to the page DOM
 * Use this to react to dynamic content loading
 */
function observePageChanges() {
  // Create a MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check for added nodes
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Check if added node is an image
          if (node.nodeName === 'IMG') {
            console.log('New image added to page:', node.src);
            // You could notify the background script here
          }
        });
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('Started observing page changes');
}

// ============================================================================
// UI UTILITIES
// ============================================================================

/**
 * Show a notification on the page
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    padding: 12px 24px;
    background: ${type === 'success' ? '#34a853' : type === 'error' ? '#ea4335' : '#4285f4'};
    color: white;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideDown 0.3s ease;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // Add to page
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideDown 0.3s ease reverse';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 3000);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element is visible in viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - True if element is visible
 */
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>} - The element when found
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    // Set up observer
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// ============================================================================
// NOTES FOR DEVELOPERS
// ============================================================================

/**
 * BEST PRACTICES:
 *
 * 1. Minimize impact on page performance
 * 2. Use event delegation for dynamic content
 * 3. Clean up event listeners and observers when done
 * 4. Be careful with CSS injection (might conflict with page styles)
 * 5. Test on various websites with different structures
 * 6. Handle cases where expected elements don't exist
 * 7. Use MutationObserver for watching dynamic content
 * 8. Avoid blocking the main thread with heavy operations
 *
 * DEBUGGING:
 *
 * 1. Open DevTools on the page (F12)
 * 2. Content script logs appear in page console
 * 3. Check "Content scripts" in Sources tab
 * 4. Use debugger statement to pause execution
 * 5. Check chrome://extensions/ for errors
 *
 * COMMUNICATION:
 *
 * 1. Content -> Background: chrome.runtime.sendMessage()
 * 2. Background -> Content: chrome.tabs.sendMessage(tabId, message)
 * 3. Content -> Page: window.postMessage() [use with caution]
 * 4. Page -> Content: window.addEventListener('message') [validate origin!]
 *
 * SECURITY:
 *
 * 1. Never trust data from web pages
 * 2. Sanitize any HTML you inject
 * 3. Validate message origins when using postMessage
 * 4. Be careful with eval() and innerHTML
 * 5. Follow Content Security Policy (CSP) rules
 * 6. Don't expose sensitive data to the page
 *
 * COMMON ISSUES:
 *
 * 1. Content script not loading - Check manifest.json patterns
 * 2. Can't access page variables - Use window.postMessage bridge
 * 3. Element not found - Wait for DOM ready or use MutationObserver
 * 4. Styles conflict - Use specific class names or shadow DOM
 * 5. Memory leaks - Clean up observers and listeners
 */

console.log('Content script initialization complete');

/**
 * Handle message to open all images below the right-click position
 * @param {number} limit - Max tabs to open
 */
async function handleOpenImagesBelow(limit) {
  console.log('Opening images below Y:', lastRightClickY, 'Limit:', limit);

  // Find all images in the document
  const images = Array.from(document.querySelectorAll('img'));

  // Filter for images below the right-click position and with valid sources
  const imagesBelow = images
    .filter(img => {
      const rect = img.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const isBelow = absoluteTop >= lastRightClickY;
      console.log('Checking image:', img.src, 'at Y:', absoluteTop, 'isBelow:', isBelow);
      return isBelow && img.src && !img.src.startsWith('data:image/svg'); // Filter out tiny icons/SVGs if needed
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return (rectA.top + window.scrollY) - (rectB.top + window.scrollY);
    });

  if (imagesBelow.length === 0) {
    console.log('No images found below the cursor.');
    return;
  }

  // Slice to limit
  const toOpen = imagesBelow.slice(0, limit);
  const urls = toOpen.map(img => img.src);

  // Send to background to open tabs
  chrome.runtime.sendMessage({ action: 'openTabs', urls });

  // Highlight the last image
  const lastImage = toOpen[toOpen.length - 1];
  if (lastImage) {
    highlightLastImage(lastImage);
  }
}

/**
 * Visually highlight the last opened image
 * @param {HTMLImageElement} img
 */
function highlightLastImage(img) {
  // Remove existing highlights
  const existing = document.querySelector('.last-opened-image-highlight');
  if (existing) {
    existing.style.outline = '';
    existing.classList.remove('last-opened-image-highlight');
  }
  const existingLabel = document.querySelector('.last-opened-image-label');
  if (existingLabel) existingLabel.remove();

  // Add highlight style
  img.style.outline = '5px solid #4285f4'; // Chrome blue
  img.style.outlineOffset = '2px';
  img.classList.add('last-opened-image-highlight');

  // Add label
  const label = document.createElement('div');
  label.className = 'last-opened-image-label';
  label.textContent = 'Last opened image';
  label.style.position = 'absolute';
  label.style.backgroundColor = '#4285f4';
  label.style.color = 'white';
  label.style.padding = '2px 8px';
  label.style.borderRadius = '4px';
  label.style.fontSize = '12px';
  label.style.fontWeight = 'bold';
  label.style.zIndex = '999999';
  label.style.pointerEvents = 'none';
  label.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

  // Position label
  document.body.appendChild(label);
  const updatePosition = () => {
    const rect = img.getBoundingClientRect();
    label.style.top = `${rect.top + window.scrollY - 25}px`;
    label.style.left = `${rect.left + window.scrollX}px`;
  };
  updatePosition();

  // Scroll last image into view (center)
  img.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Update position on scroll/resize as it's absolute
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition, { passive: true });
}
