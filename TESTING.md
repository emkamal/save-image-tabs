# Testing Guide

This guide walks you through testing the Chrome extension placeholder.

## Quick Test Steps

### 1. Load the Extension

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Toggle "Developer mode" ON (top-right corner)
4. Click "Load unpacked"
5. Select the `save-image-tabs` folder
6. Extension should load successfully

**Expected Result:** Extension appears in the list with the name "Save Image Tabs - Chrome Extension Template"

### 2. Test the Popup

1. Click the extension icon in your Chrome toolbar
   - If you don't see it, click the puzzle piece icon and pin the extension
2. The popup should open showing:
   - Header: "Save Image Tabs"
   - Image count: "0" (if no image tabs are open)
   - Empty state message: "No image tabs found"
   - Save All button (disabled)
   - Refresh button

**Expected Result:** Popup displays correctly with no errors in console

### 3. Test with Image Tabs

1. Open some image URLs in new tabs, for example:
   - Right-click any image on a webpage → "Open image in new tab"
   - Or directly open URLs like:
     - `https://picsum.photos/200`
     - `https://via.placeholder.com/300.png`

2. Click the extension icon again
3. The popup should now show:
   - Image count updated (e.g., "2")
   - List of image tabs with thumbnails
   - Save All button enabled

**Expected Result:** Extension detects image tabs correctly

### 4. Test Download Functionality

1. With image tabs open, click "Save All Images" button
2. Chrome should prompt for download location (unless auto-download is enabled)
3. Images should start downloading

**Expected Result:** Downloads start successfully

### 5. Test Options Page

1. Right-click the extension icon → "Options"
   - Or go to `chrome://extensions/` → Extension details → "Extension options"
2. Options page should open in a new tab showing:
   - Download settings section
   - Notification settings
   - Advanced settings
   - Data management options

3. Try changing a setting and clicking "Save Settings"
4. You should see a success message: "Settings saved successfully!"

**Expected Result:** Options page works and saves settings

### 6. Test Keyboard Shortcut

1. Open some image tabs
2. Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
3. Downloads should start automatically

**Expected Result:** Keyboard shortcut triggers download

### 7. Check Console for Errors

Open DevTools for each component:

**Background Service Worker:**
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "service worker" link
4. Check console for errors

**Popup:**
1. Right-click extension icon → "Inspect popup"
2. Check console for errors

**Content Script:**
1. Open any web page
2. Press F12 to open DevTools
3. Check console for messages from content script

**Expected Result:** No errors in any console

## Common Issues and Solutions

### Issue: Extension won't load
**Solution:** Check that all required files exist and manifest.json is valid

### Issue: Icons not showing
**Solution:** Icons are minimal placeholders. Create proper icons for production.

### Issue: "Service worker registration failed"
**Solution:** Check background.js for syntax errors

### Issue: Popup is blank
**Solution:** Check popup.js console for errors. Ensure all HTML/CSS/JS files are present.

### Issue: No image tabs detected
**Solution:** Make sure you're opening direct image URLs (ending in .jpg, .png, etc.)

### Issue: Downloads don't start
**Solution:** Check that "downloads" permission is in manifest.json

## Debugging Tips

1. **Use console.log()** - Add logging to trace execution
2. **Check Network tab** - Verify downloads are initiating
3. **Reload extension** - After code changes, reload from chrome://extensions/
4. **Disable other extensions** - Test with minimal interference
5. **Check permissions** - Ensure all required permissions are granted

## Next Steps

After testing:

1. ✅ Verify all features work
2. ✅ Check for console errors
3. ✅ Test on different websites
4. ✅ Review documentation for customization ideas
5. ✅ Start building your custom functionality!

## Automated Testing (Optional)

For automated testing, consider:

- **Jest** for unit testing JavaScript functions
- **Puppeteer** for end-to-end testing
- **Chrome Extension Testing Library** for component testing

See DEVELOPMENT.md for more testing strategies.

## Reporting Issues

If you find issues with the template:
1. Note the exact steps to reproduce
2. Check browser console for error messages
3. Verify Chrome/browser version
4. Create an issue on GitHub with details

---

**Happy testing! 🎉**
