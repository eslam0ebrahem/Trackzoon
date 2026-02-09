#!/bin/bash

# Configuration
SOURCE_EXTENSION_DIR="../extension"
TARGET_OUTPUT_DIR="./Trackzoon Safari"
APP_NAME="Trackzoon Safari"

# Check if Xcode Command Line Tools or Xcode is installed with converter
if ! command -v xcrun &> /dev/null; then
    echo "Error: 'xcrun' command not found."
    echo "Please install Xcode from the Mac App Store to proceed."
    exit 1
fi

# Check if Xcode Command Line Tools or Xcode is installed with converter
if ! command -v xcrun &> /dev/null; then
    echo "Error: 'xcrun' command not found."
    echo "Please install Xcode from the Mac App Store to proceed."
    exit 1
fi

# Try to find converter, checking standard path first, then fallback to /Applications/Xcode.app
CONVERTER_CMD="xcrun safari-web-extension-converter"
if ! $CONVERTER_CMD --help &> /dev/null; then
    # Try with explicit developer path
    export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
    if ! $CONVERTER_CMD --help &> /dev/null; then
        echo "Error: 'safari-web-extension-converter' not found via xcrun."
        echo "Please ensure you have the full Xcode application installed, not just Command Line Tools."
        echo "You can install Xcode from the Mac App Store: https://apps.apple.com/us/app/xcode/id497799835"
        echo "If installed elsewhere, run: sudo xcode-select -s /path/to/Xcode.app/Contents/Developer"
        exit 1
    fi
    echo "Using Xcode at: $DEVELOPER_DIR"
fi

echo "Found safari-web-extension-converter."
echo "Converting Chrome extension from '$SOURCE_EXTENSION_DIR'..."

# Run the converter
# --force to overwrite if exists
# --no-open to prevent opening Xcode immediately (we want to finish script first)
# --app-name to set the name
# --swift to use Swift (default usually)
xcrun safari-web-extension-converter "$SOURCE_EXTENSION_DIR" \
    --project-location . \
    --app-name "$APP_NAME" \
    --force \
    --no-open

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Conversion successful!"
    echo "To build and install:"
    echo "1. Open '$TARGET_OUTPUT_DIR/Trackzoon Safari.xcodeproj' in Xcode."
    echo "2. Select your development team in Signing & Capabilities."
    echo "3. Run the scheme 'Trackzoon Safari (macOS)' found in the top bar."
    echo "4. Enable the extension in Safari Preferences > Extensions."
else
    echo ""
    echo "❌ Conversion failed."
fi
