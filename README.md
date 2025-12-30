# Save Image Tabs

A simple Chrome extension for bulk downloading images from tabs and directly from web pages with smart filtering and throttled downloads.

## Features

- **Bulk Save Image Tabs**: Instantly identifies tabs displaying images (including `data:image` and `base64`) and saves them to a custom folder.
- **Extractor Mode**:
    - **Download Images Below**: Right-click anywhere to download all images below the cursor position.
    - **Review & Download**: Extract images to the extension popup for manual review before saving.
- **Smart Filtering**:
    - **Min Image Size**: Automatically skip icons, spacers, and tiny images (default 500px).
    - **Active Tab Deduplication**: Skips images already open in your tabs to prevent redundant downloads.
- **Throttled Downloads**: Configurable concurrency limit (1-20) to prevent browser lag or server blocks.
- **Enhanced UI**:
    - Real-time download progress bar.
    - Image thumbnails and selective save checkboxes.
    - Intelligent auto-scrolling to the last processed image.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the extension folder.

## Configuration

Access the **Options** page to configure:
- Max tabs to open at once.
- Minimum image size for extraction.
- Concurrent download limits.
- Notification preferences.

## License

MIT
