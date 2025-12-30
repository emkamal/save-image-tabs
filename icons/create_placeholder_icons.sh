#!/bin/bash
# This script creates simple placeholder PNG icons
# For production, create proper icons using design tools

# Check if ImageMagick is available
if command -v convert &> /dev/null; then
    echo "Creating icons with ImageMagick..."
    
    # Create 16x16 icon
    convert -size 16x16 xc:#4285f4 \
            -gravity center -pointsize 12 -fill white -annotate +0+0 "📷" \
            icon16.png 2>/dev/null || echo "Note: Emoji might not render"
    
    # Create 48x48 icon
    convert -size 48x48 xc:#4285f4 \
            -gravity center -pointsize 32 -fill white -annotate +0+0 "📷" \
            icon48.png 2>/dev/null || echo "Note: Emoji might not render"
    
    # Create 128x128 icon
    convert -size 128x128 xc:#4285f4 \
            -gravity center -pointsize 80 -fill white -annotate +0+0 "📷" \
            icon128.png 2>/dev/null || echo "Note: Emoji might not render"
    
    # Fallback: Create simple colored squares if emoji rendering fails
    if [ ! -f icon16.png ]; then
        convert -size 16x16 xc:#4285f4 icon16.png
        convert -size 48x48 xc:#4285f4 icon48.png
        convert -size 128x128 xc:#4285f4 icon128.png
    fi
    
    echo "Icons created successfully!"
else
    echo "ImageMagick not found. Creating minimal placeholder icons..."
    
    # Create minimal 1x1 PNG files (Chrome will scale them)
    # PNG header for 1x1 blue pixel
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa8\xbf\x00\x00\x00\x04\x00\x03\x8e\x1a\xe8\x3b\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > icon16.png
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa8\xbf\x00\x00\x00\x04\x00\x03\x8e\x1a\xe8\x3b\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > icon48.png
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\x60\xa8\xbf\x00\x00\x00\x04\x00\x03\x8e\x1a\xe8\x3b\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > icon128.png
    
    echo "Minimal placeholder icons created."
    echo "These will work but replace with proper icons for production!"
fi
