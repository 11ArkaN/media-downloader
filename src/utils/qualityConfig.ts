import { QualityOption } from '../types/quality';

/**
 * Quality options configuration with resolution values, labels, and yt-dlp format strings
 */
export const QUALITY_OPTIONS: QualityOption[] = [
  {
    value: '2160p',
    label: 'download_section.quality_options.4k',
    resolution: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    isAudioOnly: false
  },
  {
    value: '1440p',
    label: 'download_section.quality_options.1440p',
    resolution: 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
    isAudioOnly: false
  },
  {
    value: '1080p',
    label: 'download_section.quality_options.1080p',
    resolution: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    isAudioOnly: false
  },
  {
    value: '720p',
    label: 'download_section.quality_options.720p',
    resolution: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    isAudioOnly: false
  },
  {
    value: '480p',
    label: 'download_section.quality_options.480p',
    resolution: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
    isAudioOnly: false
  },
  {
    value: '320p',
    label: 'download_section.quality_options.320p',
    resolution: 'bestvideo[height<=320]+bestaudio/best[height<=320]',
    isAudioOnly: false
  },
  {
    value: 'bestaudio',
    label: 'download_section.quality_options.audio_only',
    resolution: 'bestaudio',
    isAudioOnly: true
  }
];

/**
 * Mapping for converting settings values to resolution options
 */
export const DEFAULT_QUALITY_MAP: Record<string, string> = {
  'best': '2160p',      // Map "best" to 4K
  'worst': '320p',      // Map "worst" to 320p
  '1080p': '1080p',     // Direct mapping
  '720p': '720p',       // Direct mapping
  '480p': '480p',       // Direct mapping
  '2160p': '2160p',     // Direct mapping for 4K
  '1440p': '1440p',     // Direct mapping for 1440p
  '320p': '320p'        // Direct mapping for 320p
};