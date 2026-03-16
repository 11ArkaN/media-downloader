# Media Downloader

Desktop media downloader and editor built with Tauri, React, TypeScript, and Rust.

## What It Does

- Downloads media with `yt-dlp`
- Processes and edits media with `FFmpeg`
- Browses local files from inside the app
- Supports English and Polish UI translations
- Checks for required downloader/transcoder dependencies at runtime

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Desktop shell: Tauri 2
- Backend: Rust

## Requirements

- Node.js 18+
- npm
- Rust stable toolchain
- WebView2 on Windows

The app can use system-installed `yt-dlp` and `ffmpeg`. The current codebase also includes runtime dependency checks and managed-install paths for those tools.

## Development

```bash
npm install
npm run tauri dev
```

## Verification

```bash
npm test
```

`npm test` runs the frontend production build and then `cargo test` for the Tauri backend.

## Production Build

```bash
npm run tauri build
```

Build artifacts are written under `src-tauri/target/`.

## Repository Hygiene

- Generated downloads, converted media, local databases, temp folders, and build output are gitignored.
- A tracked generated video artifact was removed as part of release cleanup.
- No repository secrets were found in tracked text files during the release scan.

## Privacy Notes

- App settings are currently stored locally in browser storage.
- Downloaded and converted media stay on the local machine unless the user moves or shares them.
- Respect the terms of service and copyright rules for any source you download from.

## Release Notes

- Replace placeholder repository links with the real public repository URL after publishing.
- Add an explicit license file before release if you want to grant reuse rights.
