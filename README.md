<p align="center"><img src="icons/icon128.png" width="96" alt="Paste Image to Drive icon"></p>

<h1 align="center">Paste Image to Drive</h1>

<p align="center">Press <b>Ctrl+V</b> in a Google Drive folder and the clipboard image uploads to that folder.<br>No more saving the screenshot to disk and uploading it.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/permissions-none-brightgreen.svg" alt="No permissions">
</p>

---

## Features

- **Ctrl+V to upload.** Works with screenshots (Win+Shift+S, PrtSc, Cmd+Ctrl+Shift+4), "Copy image" from any browser, and image files copied from your file manager.
- **Lands in the open folder.** Uses Drive's own uploader, so progress shows in Drive's normal upload panel.
- **Clear file names.** Screenshots are saved as `Pasted image 2026-11-02 14.30.12.png`. Copied files keep their own name.
- **Leaves Drive's own paste alone.** Text fields (search, rename) and non-image pastes work as usual.
- **Private by design.** No permissions, no network calls, no analytics. It's about 120 lines of plain JavaScript, so you can read it all.

## Install

### Chrome, Brave, Opera, Vivaldi (load unpacked)

1. Download `paste-image-to-drive-vX.Y.Z.zip` from the [latest release](../../releases/latest) and unzip it.
2. Go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.
4. Reload any open Google Drive tabs.

> Chrome may show a "Disable developer mode extensions" notice at startup. Click the ✕ to dismiss it. This happens with any extension installed outside the Web Store.

### Microsoft Edge

Install it from the Edge Add-ons store (link coming soon), or load it unpacked at `edge://extensions` using the same steps.

## Usage

1. Copy an image.
2. Open the target folder in Google Drive.
3. Click an empty area of the file list (not a text field) and press **Ctrl+V** (**Cmd+V** on Mac).

## How it works

The content script catches Ctrl/Cmd+V on drive.google.com and reads the image from the clipboard (Chrome asks once for clipboard permission). It then opens Drive's own **New → File upload** menu and intercepts the file picker Drive tries to open, giving it the pasted image instead. Drive uploads the file into the current folder exactly as if you'd picked it yourself. No Google API access or OAuth is involved.

## Limitations

- It depends on Drive's "New → File upload" menu, and the menu text must be in English for now. If Google changes the menu, uploads may stop working. Please [open an issue](../../issues) if that happens.
- Firefox isn't supported yet, because it lacks MV3 `"world": "MAIN"` content scripts.

## Troubleshooting

If a paste doesn't upload, open the DevTools console on Drive (Cmd+Option+J or Ctrl+Shift+J) and look for `[Paste Image to Drive]` warnings. For step-by-step logs, run this in the console and reload:

```js
localStorage.pasteToDriveDebug = '1'
```

To turn them off again, run `localStorage.removeItem('pasteToDriveDebug')`.

The `Refused to set unsafe header "content-length"` error comes from Drive's own upload code and is harmless.

## Contributing

Issues and PRs are welcome. To develop, load the folder unpacked, edit `content.js`, and click the reload icon on the extension card.

## Privacy

This extension collects, stores and transmits nothing. Images go straight from your clipboard to Google Drive's own uploader in your browser.

## License

[MIT](LICENSE) © 2026 Saimum Islam

*Not affiliated with or endorsed by Google. Google Drive is a trademark of Google LLC.*
