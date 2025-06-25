# Media Downloader

A modern, feature-rich desktop application for downloading and editing media files using yt-dlp and FFmpeg. Built with Tauri, React, and TypeScript.

![Media Downloader](https://via.placeholder.com/800x400/0a0a0a/9575ff?text=Media+Downloader)

## Features

### 🎬 **Download Media**
- Support for 500+ websites (YouTube, Vimeo, TikTok, and more)
- Multiple format options (MP4, WebM, MP3, etc.)
- Quality selection (4K, 1080p, 720p, audio-only)
- Batch downloads with queue management
- Real-time progress tracking
- Custom output folders

### ✂️ **Video Editing**
- Trim and cut video segments
- Crop and resize videos
- Audio control and effects
- Filters and color grading
- Rotate and flip operations
- Export in multiple formats

### 📁 **File Management**
- Built-in file explorer
- Grid and list view modes
- Search and filter files
- Bulk operations
- File preview and information

### ⚙️ **Settings & Customization**
- Dark theme with lilac accents
- Configurable download paths
- Concurrent download limits
- Custom yt-dlp and FFmpeg paths
- Notification preferences

## Prerequisites

### Required Dependencies

1. **yt-dlp** - For downloading media
   ```bash
   # Windows (using pip)
   pip install yt-dlp
   
   # macOS (using brew)
   brew install yt-dlp
   
   # Or download from: https://github.com/yt-dlp/yt-dlp/releases
   ```

2. **FFmpeg** - For video processing
   ```bash
   # Windows (using chocolatey)
   choco install ffmpeg
   
   # macOS (using brew)
   brew install ffmpeg
   
   # Or download from: https://ffmpeg.org/download.html
   ```

### Development Dependencies

- **Node.js** (v16 or higher)
- **Rust** (latest stable)
- **npm** or **yarn**

## Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/media-downloader.git
   cd media-downloader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run tauri dev
   ```

### Building for Production

1. **Build the application**
   ```bash
   npm run tauri build
   ```

2. **Find the built application in:**
   - Windows: `src-tauri/target/release/bundle/msi/`
   - macOS: `src-tauri/target/release/bundle/dmg/`
   - Linux: `src-tauri/target/release/bundle/deb/` or `src-tauri/target/release/bundle/appimage/`

## Usage

### Downloading Media

1. **Navigate to the Download tab**
2. **Paste a video URL** from any supported site
3. **Select format and quality** preferences
4. **Choose output folder** (optional)
5. **Click "Start Download"**

The download will appear in the queue with real-time progress updates.

### Editing Videos

1. **Navigate to the Edit tab**
2. **Upload or select a video file**
3. **Use the editing tools:**
   - **Trim:** Cut specific segments
   - **Crop:** Adjust video dimensions
   - **Volume:** Control audio levels
   - **Filters:** Apply effects and color grading
   - **Rotate:** Change video orientation
4. **Apply quick filters** for common adjustments
5. **Export the edited video**

### Managing Files

1. **Navigate to the Files tab**
2. **Browse downloaded files** in grid or list view
3. **Search and filter** by filename
4. **Select multiple files** for bulk operations
5. **Preview, edit, or delete** files as needed

## Configuration

### Settings Panel

Access the settings through the Settings tab to configure:

- **Download preferences** (path, concurrent downloads, default quality)
- **Application behavior** (theme, language, notifications)
- **Advanced options** (custom tool paths, command-line arguments)

### Custom Tool Paths

If yt-dlp or FFmpeg are not in your PATH, specify custom paths in Settings > Advanced:

- **yt-dlp Path:** `/usr/local/bin/yt-dlp`
- **FFmpeg Path:** `/usr/local/bin/ffmpeg`

## Supported Formats

### Download Formats
- **Video:** MP4, WebM, MKV, AVI, MOV
- **Audio:** MP3, AAC, FLAC, OGG, M4A
- **Quality:** 4K, 1440p, 1080p, 720p, 480p, Audio-only

### Export Formats
- **Video:** MP4, WebM, AVI, MOV, MKV
- **Audio:** MP3, AAC, WAV, FLAC

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + D` | Go to Download tab |
| `Ctrl/Cmd + E` | Go to Edit tab |
| `Ctrl/Cmd + F` | Go to Files tab |
| `Ctrl/Cmd + ,` | Open Settings |
| `Space` | Play/Pause video preview |
| `Ctrl/Cmd + Enter` | Start download |
| `Delete` | Delete selected files |

## Troubleshooting

### Common Issues

**"yt-dlp not found" error:**
- Ensure yt-dlp is installed and in your PATH
- Or specify custom path in Settings > Advanced

**"FFmpeg not found" error:**
- Ensure FFmpeg is installed and in your PATH
- Or specify custom path in Settings > Advanced

**Download fails:**
- Check if the URL is supported
- Verify internet connection
- Try updating yt-dlp: `pip install --upgrade yt-dlp`

**Video processing fails:**
- Ensure the input file is not corrupted
- Check available disk space
- Verify FFmpeg installation

### Logs

Application logs can be found at:
- **Windows:** `%APPDATA%/media-downloader/logs/`
- **macOS:** `~/Library/Application Support/media-downloader/logs/`
- **Linux:** `~/.config/media-downloader/logs/`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Technology Stack

- **Frontend:** React, TypeScript, TailwindCSS
- **Backend:** Rust, Tauri
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Build Tool:** Vite

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Amazing tool for downloading media
- [FFmpeg](https://ffmpeg.org/) - Powerful multimedia framework
- [Tauri](https://tauri.app/) - Build secure, fast desktop apps
- [React](https://reactjs.org/) - UI library
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework

## Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Search existing [GitHub issues](https://github.com/your-username/media-downloader/issues)
3. Create a new issue with detailed information

---

**Note:** This application is for personal use only. Respect copyright laws and website terms of service when downloading content.
