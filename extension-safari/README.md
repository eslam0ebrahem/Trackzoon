# Trackzoon Safari Extension

This directory contains instructions and a helper script to build the Safari version of the Trackzoon extension.

## Prerequisites

To build a Safari Web Extension, you **must** have:

1.  **macOS 10.14.6 or later**.
2.  **Xcode 12 or later** installed. You can download it from the [Mac App Store](https://apps.apple.com/us/app/xcode/id497799835).
    *   *Note: Just "Command Line Tools" is not enough. You need the full Xcode app.*

## How to Build

We have provided a script `setup_safari_extension.sh` to automate the conversion process using Apple's official `xcrun safari-web-extension-converter` tool.

1.  **Ensure you have Xcode installed.**
2.  Open Terminal in this directory.
3.  Run the setup script:
    ```bash
    chmod +x setup_safari_extension.sh
    ./setup_safari_extension.sh
    ```

If successful, this will generate a `Trackzoon Safari` directory containing the Xcode project.

## Opening in Xcode

1.  Double-click `Trackzoon Safari/Trackzoon Safari.xcodeproj` to open it in Xcode.
2.  In Xcode, click on the project root in the left sidebar ("Trackzoon Safari").
3.  Select the **Trackzoon Safari (macOS)** target.
4.  Go to the **Signing & Capabilities** tab.
5.  Select your **Team**. If you don't have one, you can add your Apple ID in Xcode preferences (Accounts tab) and select your "Personal Team".
6.  Press **Cmd + R** (or click the Play button) to build and run.

## Enabling in Safari

1.  When the app launches, click "Quit and Open Safari Settings...".
2.  Safari Extensions settings will open.
3.  Find **Trackzoon Safari** and check the box to enable it.
4.  You may need to grant it permissions for `amazon.eg`.

## Distribution

To distribute this extension to others:
*   **Mac App Store:** You can archive the app in Xcode (`Product > Archive`) and upload it to App Store Connect.
*   **Outside App Store:** You can export the archived app and distribute it, but it must be notarized by Apple to run on other users' Macs.
