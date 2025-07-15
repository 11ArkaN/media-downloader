export interface QualityOption {
  value: string;           // e.g., '2160p', '1080p', 'bestaudio'
  label: string;           // Translation key for display name
  resolution: string;      // yt-dlp format string
  isAudioOnly: boolean;    // Whether this option is audio-only
}

export interface AudioSettings {
  includeAudio: boolean;   // Whether to include audio with video
  isEnabled: boolean;      // Whether the checkbox is enabled
}

export interface VideoInfo {
  title?: string;          // Video title
  duration?: string;       // Video duration
  availableResolutions: string[];  // Available resolutions from source
  maxResolution?: string;  // Highest available resolution
  hasAudio: boolean;       // Whether source has audio track
  thumbnail?: string;      // Video thumbnail URL
}

export interface VideoInfoRequest {
  url: string;
}

export interface VideoInfoResponse {
  title?: string;
  duration?: string;
  available_resolutions: string[];
  max_resolution?: string;
  has_audio: boolean;
  thumbnail?: string;
}