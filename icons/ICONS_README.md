# ICONS_README.md

## Extension Icons

Chrome extensions require icons in multiple sizes:

- **icon16.png** (16×16 pixels) - Shown in the extensions page
- **icon48.png** (48×48 pixels) - Shown in the extensions management page
- **icon128.png** (128×128 pixels) - Shown during installation and in the Chrome Web Store

## Creating Icons

### Option 1: Use Design Tools
- **Figma** (https://www.figma.com/) - Professional design tool
- **GIMP** (https://www.gimp.org/) - Free photo editor
- **Canva** (https://www.canva.com/) - Easy online design tool

### Option 2: Convert SVG to PNG
Use the included `icon.svg` file and convert it to PNG:

```bash
# Using ImageMagick (if installed)
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Option 3: Use Online Tools
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.icoconverter.com/

## Design Guidelines

1. **Keep it simple** - Icons should be recognizable at small sizes
2. **Use consistent colors** - Match your extension's theme
3. **Make it unique** - Stand out from other extensions
4. **Test at all sizes** - Ensure readability at 16×16 pixels
5. **Use transparency** - PNG format with alpha channel
6. **Follow Chrome guidelines** - https://developer.chrome.com/docs/webstore/images/

## Temporary Solution

For testing, you can use emoji or simple colored squares. The extension will work without custom icons, but Chrome will show a default placeholder.
