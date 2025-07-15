import { QualityOption, AudioSettings } from '../types/quality';
import { QUALITY_OPTIONS, DEFAULT_QUALITY_MAP } from './qualityConfig';

/**
 * Get quality option by value
 */
export function getQualityOption(value: string): QualityOption | undefined {
  return QUALITY_OPTIONS.find(option => option.value === value);
}

/**
 * Get all available quality options
 */
export function getAllQualityOptions(): QualityOption[] {
  return QUALITY_OPTIONS;
}

/**
 * Get video quality options (excluding audio-only)
 */
export function getVideoQualityOptions(): QualityOption[] {
  return QUALITY_OPTIONS.filter(option => !option.isAudioOnly);
}

/**
 * Get audio-only quality option
 */
export function getAudioOnlyOption(): QualityOption | undefined {
  return QUALITY_OPTIONS.find(option => option.isAudioOnly);
}

/**
 * Map settings default quality value to resolution option value
 */
export function mapSettingsToQuality(settingsQuality: string): string {
  return DEFAULT_QUALITY_MAP[settingsQuality] || '1080p'; // Default fallback to 1080p
}

/**
 * Generate yt-dlp format string based on quality selection and audio settings
 */
export function generateFormatString(qualityValue: string, audioSettings: AudioSettings): string {
  const qualityOption = getQualityOption(qualityValue);
  
  if (!qualityOption) {
    // Fallback to 1080p if quality option not found
    return generateFormatString('1080p', audioSettings);
  }

  // If audio-only is selected, return audio format regardless of audio settings
  if (qualityOption.isAudioOnly) {
    return qualityOption.resolution;
  }

  // For video options, generate format string based on audio inclusion setting
  const heightLimit = qualityValue.replace('p', ''); // Extract height value (e.g., '1080' from '1080p')
  
  if (audioSettings.includeAudio) {
    // Video with audio - use format that combines best video and audio within height limit
    // This provides fallback if exact resolution isn't available
    return `bestvideo[height<=${heightLimit}]+bestaudio/best[height<=${heightLimit}]`;
  } else {
    // Video only - download best video within height limit without audio
    // This ensures no audio track is included and provides fallback
    return `bestvideo[height<=${heightLimit}]`;
  }
}

/**
 * Check if a quality value represents audio-only download
 */
export function isAudioOnlyQuality(qualityValue: string): boolean {
  const qualityOption = getQualityOption(qualityValue);
  return qualityOption?.isAudioOnly || false;
}

/**
 * Get default audio settings based on quality selection
 */
export function getDefaultAudioSettings(qualityValue: string): AudioSettings {
  const isAudioOnly = isAudioOnlyQuality(qualityValue);
  
  return {
    includeAudio: !isAudioOnly, // Default to true unless audio-only is selected
    isEnabled: !isAudioOnly     // Disable checkbox for audio-only selection
  };
}

/**
 * Validate if a quality value is supported
 */
export function isValidQualityValue(qualityValue: string): boolean {
  return QUALITY_OPTIONS.some(option => option.value === qualityValue);
}

/**
 * Get quality option label for display (returns translation key)
 */
export function getQualityLabel(qualityValue: string): string {
  const qualityOption = getQualityOption(qualityValue);
  return qualityOption?.label || 'download_section.quality_options.1080p';
}

/**
 * Generate fallback format string when selected quality is not available
 */
export function generateFallbackFormatString(qualityValue: string, audioSettings: AudioSettings, availableResolutions?: string[]): string {
  // If no video info available, use the standard format
  if (!availableResolutions || availableResolutions.length === 0) {
    return generateFormatString(qualityValue, audioSettings);
  }

  // For audio-only, no fallback needed
  if (qualityValue === 'bestaudio') {
    return 'bestaudio';
  }

  // Find the best available resolution that's lower than or equal to requested
  const requestedHeight = parseInt(qualityValue.replace('p', ''));
  const availableHeights = availableResolutions
    .map(res => {
      const match = res.match(/(\d+)p/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter(height => height > 0)
    .sort((a, b) => b - a); // Sort descending

  // Find the best available resolution <= requested resolution
  const bestAvailableHeight = availableHeights.find(height => height <= requestedHeight) || availableHeights[availableHeights.length - 1];

  if (bestAvailableHeight) {
    const fallbackQuality = `${bestAvailableHeight}p`;
    return generateFormatString(fallbackQuality, audioSettings);
  }

  // Ultimate fallback
  return generateFormatString(qualityValue, audioSettings);
}

/**
 * Validate format string and provide recommendations
 */
export function validateFormatString(formatString: string): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check for common format string patterns
  if (!formatString || formatString.trim() === '') {
    return { isValid: false, warnings: ['Format string is empty'] };
  }

  // Check for audio-only format
  if (formatString === 'bestaudio') {
    return { isValid: true, warnings: [] };
  }

  // Check for video format patterns
  const hasVideoFormat = formatString.includes('bestvideo') || formatString.includes('best[height');

  if (!hasVideoFormat && formatString !== 'bestaudio') {
    warnings.push('Format string may not contain valid video format');
  }

  // Check for potential issues with combined formats
  if (formatString.includes('+') && !formatString.includes('bestaudio')) {
    warnings.push('Combined format detected but no audio format specified');
  }

  return { isValid: true, warnings };
}

/**
 * Get recommended quality based on video info
 */
export function getRecommendedQuality(videoInfo: { maxResolution?: string; availableResolutions: string[] }): string {
  if (!videoInfo.maxResolution) {
    return '1080p'; // Default recommendation
  }

  // Extract resolution from max resolution string
  const maxResMatch = videoInfo.maxResolution.match(/(\d+)p/);
  if (!maxResMatch) {
    return '1080p';
  }

  const maxHeight = parseInt(maxResMatch[1]);

  // Recommend the highest quality that doesn't exceed source resolution
  if (maxHeight >= 2160) return '2160p';
  if (maxHeight >= 1440) return '1440p';
  if (maxHeight >= 1080) return '1080p';
  if (maxHeight >= 720) return '720p';
  if (maxHeight >= 480) return '480p';
  return '320p';
}

/**
 * Validate URL format and supported platforms
 */
export function validateUrl(url: string): { isValid: boolean; error?: string; platform?: string } {
  if (!url || url.trim() === '') {
    return { isValid: false, error: 'invalid_url' };
  }

  const trimmedUrl = url.trim();

  // Basic URL format validation
  try {
    new URL(trimmedUrl);
  } catch {
    return { isValid: false, error: 'invalid_url' };
  }

  // Check for supported platforms
  const supportedPlatforms = [
    { pattern: /(?:youtube\.com|youtu\.be)/i, name: 'YouTube' },
    { pattern: /vimeo\.com/i, name: 'Vimeo' },
    { pattern: /twitch\.tv/i, name: 'Twitch' },
    { pattern: /dailymotion\.com/i, name: 'Dailymotion' },
    { pattern: /facebook\.com/i, name: 'Facebook' },
    { pattern: /instagram\.com/i, name: 'Instagram' },
    { pattern: /tiktok\.com/i, name: 'TikTok' },
    { pattern: /twitter\.com|x\.com/i, name: 'Twitter/X' },
    { pattern: /reddit\.com/i, name: 'Reddit' },
    { pattern: /soundcloud\.com/i, name: 'SoundCloud' }
  ];

  const matchedPlatform = supportedPlatforms.find(platform => 
    platform.pattern.test(trimmedUrl)
  );

  if (!matchedPlatform) {
    return { isValid: false, error: 'unsupported_url' };
  }

  return { isValid: true, platform: matchedPlatform.name };
}

/**
 * Check for audio/video compatibility issues
 */
export function checkCompatibility(
  qualityValue: string, 
  audioSettings: AudioSettings, 
  videoInfo?: { hasAudio: boolean; availableResolutions: string[] }
): { isCompatible: boolean; warnings: string[]; suggestions: string[] } {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check audio-only selection with no audio available
  if (qualityValue === 'bestaudio' && videoInfo && !videoInfo.hasAudio) {
    return {
      isCompatible: false,
      warnings: ['audio_not_available'],
      suggestions: ['Select a video quality instead of audio-only']
    };
  }

  // Check video selection with audio enabled but no audio available
  if (qualityValue !== 'bestaudio' && audioSettings.includeAudio && videoInfo && !videoInfo.hasAudio) {
    warnings.push('compatibility_issue');
    suggestions.push('Audio will be excluded from download as it is not available');
  }

  // Check if selected resolution is available
  if (videoInfo && videoInfo.availableResolutions.length > 0 && qualityValue !== 'bestaudio') {
    const isAvailable = isResolutionAvailable(qualityValue, videoInfo.availableResolutions, videoInfo.hasAudio);
    
    if (!isAvailable) {
      warnings.push('quality_unavailable');
      
      // Check if there are higher quality options available
      const requestedHeight = parseInt(qualityValue.replace('p', ''));
      const availableHeights = videoInfo.availableResolutions
        .map(res => {
          const match = res.match(/(\d+)p/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(height => height > 0);

      const hasBetterQuality = availableHeights.some(height => height > requestedHeight);
      
      if (hasBetterQuality) {
        suggestions.push('Consider selecting a higher quality that is available');
      } else {
        suggestions.push('Will fallback to the best available quality');
      }
    }
  }

  return {
    isCompatible: warnings.length === 0 || !warnings.includes('audio_not_available'),
    warnings,
    suggestions
  };
}

/**
 * Check if a resolution is available in the list of available resolutions
 * Handles various resolution string formats including vertical videos
 * (e.g., "1080p", "1080p (Full HD)", "1080p (Full HD) (1080x1920 Vertical)")
 */
export function isResolutionAvailable(qualityValue: string, availableResolutions: string[], hasAudio: boolean = true): boolean {
  if (!availableResolutions || availableResolutions.length === 0) return true

  // For audio-only, check if audio is available
  if (qualityValue === 'bestaudio') {
    return hasAudio
  }

  // Extract the numeric height from the quality value (e.g., '1080' from '1080p')
  const requestedHeight = parseInt(qualityValue.replace('p', ''))
  if (isNaN(requestedHeight)) return true

  // Check if any available resolution matches the requested height
  return availableResolutions.some(available => {
    const availableLower = available.toLowerCase()
    
    // Direct string matching for common patterns
    if (availableLower.includes(`${requestedHeight}p`)) {
      return true
    }
    
    // Check for quality descriptors
    const qualityDescriptors: Record<number, string[]> = {
      2160: ['4k', 'uhd', '2160p'],
      1440: ['1440p', 'qhd', '2k'],
      1080: ['1080p', 'full hd', 'fhd'],
      720: ['720p', 'hd'],
      480: ['480p', 'sd'],
      320: ['320p']
    }
    
    const descriptors = qualityDescriptors[requestedHeight] || []
    if (descriptors.some(desc => availableLower.includes(desc))) {
      return true
    }
    
    // Handle vertical video format: "1080p (Full HD) (1080x1920 Vertical)"
    // Extract dimensions from strings like "(1080x1920 Vertical)" or "(1920x1080)"
    const dimensionMatch = available.match(/\((\d+)x(\d+)(?:\s+vertical)?\)/i)
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1])
      const height = parseInt(dimensionMatch[2])
      
      // For vertical videos, the quality is determined by the smaller dimension (width)
      // For horizontal videos, the quality is determined by height
      const qualityDimension = height > width ? width : height
      
      if (qualityDimension === requestedHeight) {
        return true
      }
    }
    
    // Extract all numeric values from the resolution string as fallback
    const heightMatches = available.match(/(\d+)p?/g)
    if (!heightMatches) return false

    // Check if any of the extracted heights match our requested height
    return heightMatches.some(match => {
      const height = parseInt(match.replace('p', ''))
      return height === requestedHeight
    })
  })
}

/**
 * Enhanced error categorization for better user feedback
 */
export function categorizeError(error: unknown): { category: string; userMessage: string; technicalDetails?: string } {
  if (!error) {
    return { category: 'unknown', userMessage: 'download_failed' };
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network-related errors
  if (errorMessage.includes('network') || errorMessage.includes('connection') || 
      errorMessage.includes('timeout') || errorMessage.includes('dns') ||
      errorMessage.includes('unreachable') || errorMessage.includes('offline')) {
    return {
      category: 'network',
      userMessage: 'network_error',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // URL/Video availability errors
  if (errorMessage.includes('private') || errorMessage.includes('unavailable') ||
      errorMessage.includes('not found') || errorMessage.includes('removed') ||
      errorMessage.includes('deleted') || errorMessage.includes('blocked')) {
    return {
      category: 'availability',
      userMessage: 'video_info_failed',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // Format/Quality errors
  if (errorMessage.includes('format') || errorMessage.includes('quality') ||
      errorMessage.includes('resolution') || errorMessage.includes('codec')) {
    return {
      category: 'format',
      userMessage: 'format_invalid',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // Permission/Access errors
  if (errorMessage.includes('permission') || errorMessage.includes('access') ||
      errorMessage.includes('denied') || errorMessage.includes('forbidden') ||
      errorMessage.includes('unauthorized')) {
    return {
      category: 'permission',
      userMessage: 'permission_denied',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // Server errors
  if (errorMessage.includes('server') || errorMessage.includes('5') ||
      errorMessage.includes('internal') || errorMessage.includes('service')) {
    return {
      category: 'server',
      userMessage: 'server_error',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return {
      category: 'timeout',
      userMessage: 'timeout_error',
      technicalDetails: error instanceof Error ? error.message : String(error)
    };
  }

  // Default fallback
  return {
    category: 'unknown',
    userMessage: 'download_failed',
    technicalDetails: error instanceof Error ? error.message : String(error)
  };
}