# Save Media Tabs

A powerful Chrome extension for bulk downloading images and videos from tabs and web pages with smart filtering, network interception, and throttled downloads.

## Features

- **Bulk Save Image Tabs**: Instantly identifies tabs displaying images (including `data:image` and `base64`) and saves them to a custom folder.
- **Video Download Support**:
    - **Network Interception**: Automatically detects videos playing on pages by intercepting network requests.
    - **Header Replay**: Uses `fetch` to download videos with original headers (`Referer`, `Cookie`, `User-Agent`), bypassing protection on many sites.
    - **Bulk Video Downloading**: Select multiple detected videos and download them all at once.
- **Extractor Mode**:
    - **Download Images Below**: Right-click anywhere to download all images below the cursor position.
    - **Review & Download**: Extract images to the extension popup for manual review before saving.
- **Smart Filtering**:
    - **Min Image/Video Size**: Automatically skip icons, ads, and small files.
    - **Active Tab Deduplication**: Skips images already open in your tabs to prevent redundant downloads.
- **Throttled Downloads**: Configurable concurrency limit (1-20) to prevent browser lag or server blocks.
- **Enhanced UI**:
    - Tabbed navigation for separate Image and Video management.
    - Real-time download progress bar and status updates.
    - Media thumbnails and selective save checkboxes.

## Video Download Limitations

Due to browser and security constraints, the following limitations apply:
- **DRM Protected Content**: Videos from services like Netflix, Hulu, or Amazon Prime are encrypted and cannot be downloaded.
- **Streaming Protocols**: HLS (`.m3u8`) and DASH (`.mpd`) streaming formats are currently not supported.
- **YouTube**: As per Chrome Web Store policies, YouTube video downloading is restricted.
- **Detection**: Videos are only detected when they are actually loaded or played by the browser on a web page.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the extension folder.

## Configuration

Access the **Options** page to configure:
- **Video Detection**: Enable/disable video interceptor.
- **Minimum Sizes**: Filter out small images (px) or videos (MB).
- **Max concurrency**: Throttle downloads.
- **Notifications**: Enable download completion alerts.

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
