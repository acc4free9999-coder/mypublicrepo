# ChatGPT Screenshot Exporter

A Chrome Manifest V3 extension that scrolls through the actual ChatGPT conversation area and downloads numbered PNG screenshots in a ZIP. Chrome captures the rendered page pixels: the chat's theme, typography, tables, code, math, images, and rendered charts are preserved. Messages are no longer rebuilt in a separate clean layout.

## Install

Requires Node.js 20 or newer and Chrome 120 or newer.

```sh
npm install
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this project's **dist** folder. The project root is also supported after building.
3. Pin **ChatGPT Screenshot Exporter**.

After an update, rebuild, click **Reload** on the extension, and refresh the ChatGPT tab.

## Use

1. Open a conversation on `https://chatgpt.com` or `https://chat.openai.com`.
2. Wait for the response to finish and close dialogs. Expand any collapsed content you want captured.
3. Click the extension, then **Capture chat page (ZIP)**.
4. Close the popup and keep the ChatGPT tab selected in its browser window. **Do not scroll, resize, change zoom, minimize the window, or switch tabs during capture.** Window focus is not required; opening the extension popup does not block capture.
5. The extension scrolls from the top to the bottom, waits for visible images, and captures the conversation area. The progress panel and composer are hidden during each capture.
6. Unzip the download to view `conversation-00001.png`, `conversation-00002.png`, etc., in order.

Press **Esc** or use **Cancel** to stop. Your original scroll position and temporary style changes are restored on success, cancellation, or failure.

## Behavior and limitations

- Captures actual page pixels using Chrome's `captureVisibleTab`, not an HTML-to-canvas reconstruction.
- Crops to the conversation column to exclude the sidebar. Overlapping page headers are cropped, and the composer is temporarily hidden so it does not cover messages.
- Recognizes the current ChatGPT thread footer, composer attributes, and scroll-to-bottom arrow (including layouts without `#prompt-textarea`). These overlays stay hidden from the first layout measurement until the export ends, including newly mounted controls. This keeps the capture area consistent instead of switching between a footer-cropped viewport and a full viewport near the end. All changed styles are restored afterward.
- Smooth scrolling and scroll snapping are temporarily disabled so the page does not snap back to an already captured section.
- If the scroll container extends below the browser viewport, reaching its maximum scroll does not mean all content has been captured. The exporter temporarily adds scroll room to expose the remaining tail, without including that extra blank space in the ZIP, and removes it afterward. End detection allows at most one CSS pixel for browser scroll-height rounding. If recovery fails, the error includes geometry measurements rather than silently discarding the remaining content.
- Image dimensions follow your browser viewport, display scaling, and zoom, not an A4 page size. Each screenshot is at most one visible conversation viewport tall.
- Each scroll deliberately revisits 48 CSS pixels; that overlap is removed from the exported crop using transcript coordinates. The exporter waits for layout stability and retries if capture geometry moves, rather than silently skipping content between images. Text or images may span two screenshots at a section boundary.
- Visible loaded images, canvas/SVG charts, and rendered mathematical notation are captured without separate image downloads or image-host permissions.
- Waits up to 15 seconds for each viewport's visible images to load. Broken images, hidden/switched tabs, changed browser size/zoom, and capture failures stop the export with an explicit error.
- Virtualized chat content can load as the page scrolls. The exporter follows the available scroll range; it cannot recover messages ChatGPT does not expose, force open collapsed attachments, or reveal hidden content.
- Captures only what the page displays. Clipped code blocks and horizontally scrolling tables stay clipped as on the page. Animations and video show the frame rendered at capture time.
- Do not type or send messages during export. Dynamic page changes can affect section boundaries. Other page overlays or third-party extension widgets can appear in captures; close them first.
- PNG text is not selectable/searchable and links are not clickable. There are no PDF exports or synthetic headers/footers.
- Screenshot requests are rate-limited below Chrome's two-per-second limit. Long chats take time; PNGs and the ZIP remain in memory until download.

## Privacy and permissions

All capture, cropping, and ZIP processing happens locally. No conversation text or screenshots are uploaded. There is no analytics, export server, API key, or external font request.

Permissions:

- **activeTab** grants temporary access to the tab where you click the extension, including visible-tab capture.
- **scripting** injects the scroll/capture controller after your click.

The extension does not request persistent host access, image-host permissions, cookies, history, or downloads permission. The background worker validates that capture requests come from the top-level ChatGPT tab and verifies the requesting tab is still active before and after capturing. Previously granted optional image-host access is no longer used by this version.

ZIP downloads use a browser-local Blob. The ZIP library, fflate, is bundled at build time with license notices retained. No libraries are loaded from a CDN.

## Development

```sh
npm run check
```

Tests build the extension and check crop geometry, scroll-container detection, overlay restoration, image errors, active-tab checks, archive contents, and popup wiring for both installation folders. Legacy message-extraction fixtures remain covered, including any local saved HTML in `sample/` (excluded from version control).

Browser validation should additionally check actual Chrome captures, scrolling, original styles/images, cancellation, tab switches, and scroll restoration. A normal web page cannot call extension-only Chrome APIs.
