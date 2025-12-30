# Quick Start Guide

Get up and running with the Chrome Extension template in 5 minutes!

## Prerequisites

- Chrome browser (or Chromium-based browser)
- Text editor (VS Code, Sublime Text, etc.)
- Basic HTML/CSS/JavaScript knowledge

## Step 1: Get the Code (30 seconds)

```bash
# Clone the repository
git clone https://github.com/emkamal/save-image-tabs.git
cd save-image-tabs
```

Or download the ZIP and extract it.

## Step 2: Load in Chrome (1 minute)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top-right)
4. Click **"Load unpacked"**
5. Select the `save-image-tabs` folder
6. Done! The extension is now installed

## Step 3: Test It (2 minutes)

1. **Open some image tabs:**
   - Right-click any image → "Open image in new tab"
   - Or visit: `https://picsum.photos/200`

2. **Click the extension icon** (puzzle piece if not visible, then pin it)

3. **You should see:**
   - Number of image tabs detected
   - List of image tabs
   - "Save All Images" button

4. **Click "Save All Images"**
   - Downloads should start

5. **Try the settings:**
   - Right-click extension icon → Options
   - Change settings → Click Save
   - Settings are now saved!

## Step 4: Start Customizing (1 minute)

Open the project in your editor:

```bash
code .  # If using VS Code
```

**Key files to edit:**

- `manifest.json` - Extension metadata and permissions
- `popup/popup.html` - Popup UI structure
- `popup/popup.js` - Popup logic
- `background/background.js` - Background event handling

**Make a simple change:**

1. Open `popup/popup.html`
2. Change the `<h1>` text to "My Awesome Extension"
3. Go to `chrome://extensions/`
4. Click the refresh icon on your extension
5. Click the extension icon - see your change!

## What's Next?

### Learn the Architecture
Read [README.md](README.md) for a comprehensive overview

### Deep Dive into Development
See [DEVELOPMENT.md](DEVELOPMENT.md) for advanced patterns

### Test Thoroughly
Follow [TESTING.md](TESTING.md) for testing guidelines

## Common Customizations

### Change Extension Name
Edit `manifest.json`:
```json
{
  "name": "Your Extension Name",
  "description": "Your description"
}
```

### Add a New Permission
Edit `manifest.json`:
```json
{
  "permissions": [
    "tabs",
    "downloads",
    "storage",
    "notifications"  // Add this
  ]
}
```

### Add a Button to Popup
Edit `popup/popup.html`:
```html
<button id="myButton" class="btn btn-primary">My Action</button>
```

Edit `popup/popup.js`:
```javascript
document.getElementById('myButton').addEventListener('click', () => {
  console.log('Clicked!');
});
```

### Change Color Scheme
Edit `popup/popup.css`:
```css
:root {
  --primary-color: #ff6b6b;  /* Change to your color */
}
```

## Need Help?

- 📖 Read the [full README](README.md)
- 🔧 Check [DEVELOPMENT.md](DEVELOPMENT.md) for details
- 🐛 See [TESTING.md](TESTING.md) for debugging
- 💬 Create an issue on GitHub

## Tips

- **Use DevTools**: Right-click extension icon → Inspect popup
- **Check Console**: Look for errors in different contexts
- **Reload Often**: After changes, reload extension
- **Test in Incognito**: Ensure it works in private mode

---

**You're ready to build! 🚀**
