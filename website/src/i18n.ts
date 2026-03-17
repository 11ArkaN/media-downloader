import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Navigation
      nav: {
        features: 'Features',
        download: 'Download',
        about: 'About',
        support: 'Support'
      },
      // Hero section
      hero: {
        title: 'Media Downloader',
        subtitle: 'Download and edit media from 500+ websites',
        description: 'A modern, feature-rich desktop application for downloading and editing media files using yt-dlp and FFmpeg. Built with Tauri, React, and TypeScript.',
        downloadButton: 'Download Free',
        learnMore: 'Learn More',
        freeForever: 'Free Forever',
        crossPlatform: 'Cross Platform',
        openSource: 'Open Source'
      },
      // Features section
      features: {
        title: 'Powerful Features',
        subtitle: 'Everything you need for media downloading and editing',
        download: {
          title: 'Download Media',
          description: 'Support for 500+ websites including YouTube, Vimeo, TikTok, and more with multiple format options'
        },
        edit: {
          title: 'Video Editing',
          description: 'Trim, crop, resize, and apply effects to your videos with our built-in editor'
        },
        manage: {
          title: 'File Management',
          description: 'Organize your downloads with our intuitive file explorer and preview system'
        },
        quality: {
          title: 'Quality Control',
          description: 'Choose from 4K, 1080p, 720p, or audio-only downloads with custom quality settings'
        },
        batch: {
          title: 'Batch Processing',
          description: 'Download multiple files simultaneously with queue management and progress tracking'
        },
        secure: {
          title: 'Secure & Private',
          description: 'Your data stays on your device. No cloud processing, no data collection'
        }
      },
      // Screenshots section
      screenshots: {
        title: 'See It In Action',
        subtitle: 'Beautiful interface meets powerful functionality',
        mainInterface: 'Main Interface - Clean and intuitive design with glass morphism effects',
        downloadSection: 'Download Section - Paste URLs and select quality options',
        editingTools: 'Video Editor - Professional editing tools with real-time preview',
        fileManager: 'File Manager - Organize and preview your downloaded media'
      },
      // Download section
      downloadSection: {
        title: 'Download Now',
        subtitle: 'Available for Windows, macOS, and Linux',
        systemRequirements: 'System Requirements',
        requirements: {
          os: 'Windows 10+, macOS 10.15+, or Linux',
          memory: '4GB RAM minimum, 8GB recommended',
          storage: '500MB free space',
          dependencies: 'FFmpeg and yt-dlp (auto-installed)'
        },
        downloadWindows: 'Download for Windows',
        downloadMac: 'Download for macOS',
        downloadLinux: 'Download for Linux',
        viewOnGithub: 'View on GitHub'
      },
      // Footer
      footer: {
        description: 'A free, open-source media downloader and editor',
        links: {
          documentation: 'Documentation',
          github: 'GitHub',
          issues: 'Report Issues',
          releases: 'Releases'
        },
        legal: {
          license: 'MIT License',
          copyright: '© 2024 Media Downloader. All rights reserved.',
          disclaimer: 'This application is for personal use only. Respect copyright laws and website terms of service.'
        }
      },
      // Common
      common: {
        loading: 'Loading...',
        error: 'An error occurred',
        retry: 'Retry',
        close: 'Close'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;