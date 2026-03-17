import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Download, Play, AlertCircle, Check, Loader2, Link, FolderOpen, Info, Clock, Monitor, HelpCircle, Volume2, VolumeX, Shield, ShieldOff } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { VideoInfo, VideoInfoRequest, VideoInfoResponse, AudioSettings, DownloadRequest } from '../types/quality'
import { getAllQualityOptions, mapSettingsToQuality, getDefaultAudioSettings, generateFormatString, isAudioOnlyQuality, generateFallbackFormatString, validateFormatString, validateUrl, checkCompatibility, categorizeError, isResolutionAvailable } from '../utils/qualityUtils'
import Tooltip from './Tooltip'
import HelpText from './HelpText'

import { useNotifications } from '../hooks/useNotifications'


interface DownloadProgress {
  id: string
  url: string
  progress: number
  status: 'pending' | 'starting' | 'downloading' | 'completed' | 'error'
  filename?: string
  error?: string
  isAnonymized?: boolean
}

interface PersistedAppSettings {
  default_quality: string
  download_path: string
}

const DownloadSection: React.FC = () => {
  const { t } = useTranslation()
  const { showSuccess, showWarning } = useNotifications()
  const [url, setUrl] = useState('')
  const [downloads, setDownloads] = useState<DownloadProgress[]>([])
  const [selectedQuality, setSelectedQuality] = useState('1080p')
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ includeAudio: true, isEnabled: true })
  const [outputPath, setOutputPath] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [isLoadingVideoInfo, setIsLoadingVideoInfo] = useState(false)
  const [videoInfoError, setVideoInfoError] = useState<string | null>(null)
  const [anonymizeFilenames, setAnonymizeFilenames] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [anonymizedDownloads, setAnonymizedDownloads] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Listen for download progress events
    const unlisten = listen('download-progress', (event: any) => {
      const progress: DownloadProgress = event.payload
      setDownloads(prev => {
        const existingIndex = prev.findIndex(d => d.id === progress.id)
        if (existingIndex !== -1) {
          const updated = [...prev]
          updated[existingIndex] = {
            ...progress,
            // Preserve anonymization status if it was set locally
            isAnonymized: updated[existingIndex].isAnonymized ?? progress.isAnonymized
          }
          return updated
        } else {
          return [...prev, {
            ...progress,
            // Check if this download was initiated with anonymization
            isAnonymized: anonymizedDownloads.has(progress.id) || progress.isAnonymized
          }]
        }
      })
    })

    return () => {
      unlisten.then(fn => fn())
      // Clean up timeout on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Load persisted download defaults on component mount
  useEffect(() => {
    const loadDownloadDefaults = async () => {
      try {
        const settings = await invoke<PersistedAppSettings>('get_settings')
        setSelectedQuality(mapSettingsToQuality(settings.default_quality))
        setOutputPath(settings.download_path || '')
      } catch (error) {
        console.error('Error loading download defaults:', error)
      }
    }

    loadDownloadDefaults()
  }, [])

  const selectOutputPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('download_section.select_folder_title')
      })

      if (selected && typeof selected === 'string') {
        setOutputPath(selected)
      }
    } catch (error) {
      console.error('Error selecting path:', error)
      alert(t('download_section.failed_to_open_dialog') + error)
    }
  }

  const handleDownload = async () => {
    if (!url.trim()) return

    try {
      // Enhanced URL validation before download
      const urlValidation = validateUrl(url.trim())
      if (!urlValidation.isValid) {
        const errorKey = urlValidation.error || 'invalid_url'
        throw new Error(t(`download_section.errors.${errorKey}`))
      }

      // Enhanced compatibility check
      const compatibilityCheck = checkCompatibility(selectedQuality, audioSettings, videoInfo || undefined)

      if (!compatibilityCheck.isCompatible) {
        // Handle critical compatibility issues
        const errorKey = compatibilityCheck.warnings[0] || 'compatibility_issue'
        throw new Error(t(`download_section.errors.${errorKey}`))
      }

      // Log compatibility warnings for user awareness
      if (compatibilityCheck.warnings.length > 0) {
        console.warn('Compatibility warnings:', compatibilityCheck.warnings)
        compatibilityCheck.warnings.forEach(warning => {
          console.warn(`Warning: ${t(`download_section.errors.${warning}`)}`);
        })
      }

      // Generate the appropriate format string based on quality and audio settings
      let formatString = generateFormatString(selectedQuality, audioSettings)
      let actualQuality = selectedQuality

      // If video info is available, use enhanced fallback logic
      if (videoInfo && videoInfo.availableResolutions && videoInfo.availableResolutions.length > 0) {
        // Check if selected resolution is available
        if (!checkResolutionAvailability(selectedQuality)) {
          console.warn(`Selected resolution ${selectedQuality} not available, using fallback format`)

          // Use fallback format string that considers available resolutions
          formatString = generateFallbackFormatString(selectedQuality, audioSettings, videoInfo.availableResolutions)

          // Determine actual quality that will be used for user notification
          const availableHeights = videoInfo.availableResolutions
            .map(res => {
              const match = res.match(/(\d+)p/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter(height => height > 0)
            .sort((a, b) => b - a);

          const requestedHeight = parseInt(selectedQuality.replace('p', ''));
          const bestAvailableHeight = availableHeights.find(height => height <= requestedHeight) || availableHeights[availableHeights.length - 1];

          if (bestAvailableHeight) {
            actualQuality = `${bestAvailableHeight}p`;
          }

        }
      }

      // Validate the final format string
      const validation = validateFormatString(formatString)
      if (!validation.isValid) {
        throw new Error(t('download_section.errors.format_invalid') + ': ' + validation.warnings.join(', '))
      }

      // Log format validation warnings
      if (validation.warnings.length > 0) {
        console.warn('Format string warnings:', validation.warnings)
        validation.warnings.forEach(warning => {
          console.warn(`Format warning: ${warning}`)
        })
      }

      // Ensure we have a valid output path
      const finalOutputPath = outputPath || await getDefaultDownloadPath()

      console.log('Starting download with enhanced validation:', {
        url: url.trim(),
        format: formatString,
        requestedQuality: selectedQuality,
        actualQuality: actualQuality,
        audioSettings,
        outputPath: finalOutputPath,
        anonymizeFilename: anonymizeFilenames,
        compatibilityWarnings: compatibilityCheck.warnings,
        videoInfo: videoInfo ? {
          title: videoInfo.title,
          maxResolution: videoInfo.maxResolution,
          hasAudio: videoInfo.hasAudio
        } : null
      })

      // Create download request with enhanced format string and anonymization setting
      const downloadRequest: DownloadRequest = {
        url: url.trim(),
        format: formatString,
        output_path: finalOutputPath,
        anonymize_filename: anonymizeFilenames
      }

      const downloadId = await invoke<string>('start_download', { request: downloadRequest })

      // Track anonymized downloads for proper UI feedback
      if (anonymizeFilenames && downloadId) {
        setAnonymizedDownloads(prev => new Set(prev).add(downloadId))
      }

      // Show fallback notification if quality was changed
      if (actualQuality !== selectedQuality) {
        showWarning(
          t('download_section.notifications.quality_fallback_title'),
          t('download_section.notifications.quality_fallback', {
            requestedQuality: selectedQuality,
            actualQuality: actualQuality
          })
        )
      }

      // Show compatibility warnings as notifications
      if (compatibilityCheck.warnings.length > 0) {
        compatibilityCheck.warnings.forEach(warning => {
          if (warning !== 'quality_unavailable') { // Don't duplicate quality fallback warning
            showWarning(
              t('download_section.notifications.compatibility_warning_title'),
              t(`download_section.errors.${warning}`)
            )
          }
        })
      }

      // Show success notification with anonymization-specific message
      if (anonymizeFilenames) {
        showSuccess(
          t('download_section.notifications.download_with_anonymization_title'),
          t('download_section.notifications.download_with_anonymization_message')
        )
      } else {
        showSuccess(
          t('download_section.notifications.download_without_anonymization_title'),
          t('download_section.notifications.download_without_anonymization_message')
        )
      }

      // Clear URL after successful download initiation
      setUrl('')

      // Clear video info to prepare for next download
      setVideoInfo(null)
      setVideoInfoError(null)

    } catch (error) {
      console.error('Error starting download:', error)

      // Enhanced error categorization for better user feedback
      const errorInfo = categorizeError(error)
      let errorMessage = t(`download_section.errors.${errorInfo.userMessage}`)

      // If it's a custom error message (already translated), use it directly
      if (error instanceof Error && error.message.includes('download_section.errors.')) {
        errorMessage = error.message
      }

      // Add technical details for debugging if available
      if (errorInfo.technicalDetails) {
        console.error('Technical details:', errorInfo.technicalDetails)
      }

      // Add the error to downloads list for user visibility
      const errorDownload: DownloadProgress = {
        id: Date.now().toString(),
        url: url.trim(),
        progress: 0,
        status: 'error',
        error: errorMessage,
        isAnonymized: anonymizeFilenames
      }

      setDownloads(prev => [...prev, errorDownload])
    }
  }

  const getDefaultDownloadPath = async () => {
    try {
      const settings = await invoke<PersistedAppSettings>('get_settings')
      return settings.download_path || './downloads'
    } catch (error) {
      console.error('Error loading default download path:', error)
      return './downloads'
    }
  }

  const fetchVideoInfo = async (videoUrl: string) => {
    if (!videoUrl.trim()) {
      setVideoInfo(null)
      setVideoInfoError(null)
      return
    }

    // Enhanced URL validation before attempting to fetch video info
    const urlValidation = validateUrl(videoUrl.trim())
    if (!urlValidation.isValid) {
      const errorKey = urlValidation.error || 'invalid_url'
      setVideoInfoError(t(`download_section.errors.${errorKey}`))
      return
    }

    setIsLoadingVideoInfo(true)
    setVideoInfoError(null)
    setVideoInfo(null)

    // Set timeout for video info loading
    const timeoutId = setTimeout(() => {
      if (isLoadingVideoInfo) {
        console.warn('Video info loading is taking longer than expected')
        // Don't set error, just log warning - let the request complete
      }
    }, 10000) // 10 second timeout warning

    try {
      const request: VideoInfoRequest = { url: videoUrl.trim() }
      const response = await invoke<VideoInfoResponse>('fetch_video_info', { request })

      const videoInfo: VideoInfo = {
        title: response.title,
        duration: response.duration,
        availableResolutions: response.available_resolutions,
        maxResolution: response.max_resolution,
        hasAudio: response.has_audio,
        thumbnail: response.thumbnail
      }

      setVideoInfo(videoInfo)
      clearTimeout(timeoutId)
    } catch (error) {
      console.error('Error fetching video info:', error)
      clearTimeout(timeoutId)

      // Enhanced error categorization for better user feedback
      const errorInfo = categorizeError(error)
      setVideoInfoError(t(`download_section.errors.${errorInfo.userMessage}`))
    } finally {
      setIsLoadingVideoInfo(false)
    }
  }

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Clear previous video info and errors when URL changes
    setVideoInfo(null)
    setVideoInfoError(null)

    // Debounce video info fetching with enhanced URL validation
    timeoutRef.current = setTimeout(() => {
      if (newUrl.trim()) {
        // Use enhanced URL validation instead of simple string matching
        const urlValidation = validateUrl(newUrl.trim())
        if (urlValidation.isValid) {
          fetchVideoInfo(newUrl)
        } else {
          // Don't show error immediately for partial URLs while user is typing
          // Only show error if URL looks complete but is invalid
          if (newUrl.includes('.') && newUrl.length > 10) {
            const errorKey = urlValidation.error || 'invalid_url'
            setVideoInfoError(t(`download_section.errors.${errorKey}`))
          }
        }
      }
    }, 1000)
  }

  // Handle quality selection change
  const handleQualityChange = (newQuality: string) => {
    setSelectedQuality(newQuality)

    // Update audio settings based on the new quality selection
    const newAudioSettings = getDefaultAudioSettings(newQuality)

    // If switching from audio-only to video, restore previous audio inclusion state
    // Otherwise, use the default settings for the new quality
    if (isAudioOnlyQuality(selectedQuality) && !isAudioOnlyQuality(newQuality)) {
      // Restore audio inclusion when switching from audio-only to video
      setAudioSettings({
        includeAudio: true, // Default to including audio when switching to video
        isEnabled: true
      })
    } else {
      setAudioSettings(newAudioSettings)
    }
  }

  // Handle audio inclusion toggle
  const handleAudioToggle = (includeAudio: boolean) => {
    setAudioSettings(prev => ({
      ...prev,
      includeAudio
    }))
  }

  // Handle filename anonymization toggle
  const handleAnonymizeToggle = (anonymize: boolean) => {
    setAnonymizeFilenames(anonymize)

    // Show notification to inform user about the change
    if (anonymize) {
      showSuccess(
        t('download_section.notifications.filename_anonymized_title'),
        t('download_section.notifications.filename_anonymized_message')
      )
    }
  }

  // Generate preview filename for anonymization
  const generatePreviewFilename = () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const randomString = Math.random().toString(36).substring(2, 8)
    return `video_${timestamp}_${randomString}.mp4`
  }

  // Get quality options from configuration
  const qualityOptions = getAllQualityOptions()

  // Helper function to check if a resolution is available based on video info
  const checkResolutionAvailability = (qualityValue: string) => {
    if (!videoInfo || !videoInfo.availableResolutions) return true
    return isResolutionAvailable(qualityValue, videoInfo.availableResolutions, videoInfo.hasAudio)
  }

  // Function to map available resolution strings to quality option values
  const mapResolutionToQuality = (resolution: string): string | null => {
    const resolutionLower = resolution.toLowerCase()

    // Extract numeric resolution from various formats
    // Handle formats like "720p (HD)", "1080p (Full HD)", "720p (HD) (720x1280 Vertical)", etc.
    const heightMatch = resolution.match(/(\d+)p/)
    if (heightMatch) {
      const height = heightMatch[1]
      const qualityValue = `${height}p`

      // Check if this quality value exists in our quality options
      const qualityOption = qualityOptions.find(option => option.value === qualityValue)
      if (qualityOption) {
        return qualityValue
      }
    }

    // Handle descriptive quality names
    if (resolutionLower.includes('4k') || resolutionLower.includes('uhd') || resolutionLower.includes('2160')) {
      return '2160p'
    }
    if (resolutionLower.includes('qhd') || resolutionLower.includes('1440')) {
      return '1440p'
    }
    if (resolutionLower.includes('full hd') || resolutionLower.includes('fhd') || resolutionLower.includes('1080')) {
      return '1080p'
    }
    if (resolutionLower.includes('hd') && resolutionLower.includes('720')) {
      return '720p'
    }
    if (resolutionLower.includes('sd') && resolutionLower.includes('480')) {
      return '480p'
    }
    if (resolutionLower.includes('360')) {
      return '320p'
    }
    if (resolutionLower.includes('320')) {
      return '320p'
    }

    return null
  }

  // Handle clicking on available resolution
  const handleResolutionClick = (resolution: string) => {
    const qualityValue = mapResolutionToQuality(resolution)
    if (qualityValue) {
      handleQualityChange(qualityValue)
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Download Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">{t('download_section.title')}</h2>
          </div>

          <div className="space-y-6">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('download_section.url_label')}
              </label>
              <div className="relative">
                <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={t('download_section.url_placeholder')}
                  className="input-field w-full pl-14"
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                />
              </div>
            </div>

            {/* Enhanced Video Information Display */}
            {(isLoadingVideoInfo || videoInfo || videoInfoError) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Info className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t('download_section.video_info.title')}</h3>
                  </div>

                  <Tooltip
                    content={t('download_section.tooltips.video_info_card')}
                    position="left"
                  >
                    <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>

                {isLoadingVideoInfo && (
                  <motion.div
                    className="flex items-center space-x-3 text-gray-300 py-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span>{t('download_section.video_info.loading')}</span>
                  </motion.div>
                )}

                {videoInfoError && (
                  <motion.div
                    className="flex items-center space-x-3 text-red-400 py-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span>{t('download_section.video_info.error')}: {videoInfoError}</span>
                  </motion.div>
                )}

                {videoInfo && !isLoadingVideoInfo && (
                  <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {videoInfo.title && (
                      <div className="pb-2 border-b border-gray-700/50">
                        <h4 className="text-white font-medium text-base leading-relaxed">{videoInfo.title}</h4>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      {videoInfo.duration && (
                        <motion.div
                          className="flex items-center space-x-2 text-gray-300 p-2 rounded-lg bg-gray-800/30"
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Clock className="w-4 h-4 text-blue-400" />
                          <div>
                            <div className="text-xs text-gray-400">{t('download_section.video_info.duration')}</div>
                            <div className="font-medium">{videoInfo.duration}</div>
                          </div>
                        </motion.div>
                      )}

                      {videoInfo.maxResolution && (
                        <motion.div
                          className="flex items-center space-x-2 text-gray-300 p-2 rounded-lg bg-gray-800/30"
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Monitor className="w-4 h-4 text-blue-400" />
                          <div>
                            <div className="text-xs text-gray-400">{t('download_section.video_info.max_resolution')}</div>
                            <div className="font-medium">{videoInfo.maxResolution}</div>
                          </div>
                        </motion.div>
                      )}

                      <motion.div
                        className="flex items-center space-x-2 text-gray-300 p-2 rounded-lg bg-gray-800/30"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 border-gray-600 flex items-center justify-center ${videoInfo.hasAudio ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                          {videoInfo.hasAudio ? (
                            <Volume2 className="w-2 h-2 text-white" />
                          ) : (
                            <VolumeX className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">{t('download_section.video_info.has_audio')}</div>
                          <div className={`font-medium ${videoInfo.hasAudio ? 'text-green-400' : 'text-red-400'}`}>
                            {videoInfo.hasAudio ? t('download_section.ui.available') : t('download_section.ui.not_available')}
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {videoInfo.availableResolutions && videoInfo.availableResolutions.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-gray-400 text-sm font-medium">{t('download_section.video_info.available_resolutions')}:</p>
                        <div className="flex flex-wrap gap-2">
                          {videoInfo.availableResolutions.map((resolution, index) => {
                            const qualityValue = mapResolutionToQuality(resolution)
                            const isCurrentlySelected = qualityValue === selectedQuality
                            const isClickable = qualityValue !== null

                            return (
                              <motion.button
                                key={index}
                                onClick={() => isClickable && handleResolutionClick(resolution)}
                                disabled={!isClickable}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 ${isCurrentlySelected
                                  ? 'bg-blue-500 text-white border-blue-400/50'
                                  : isClickable
                                    ? 'bg-white/[0.06] text-gray-300 border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.1] cursor-pointer'
                                    : 'bg-white/[0.03] text-gray-500 border-white/[0.06] cursor-not-allowed opacity-60'
                                  }`}
                                transition={{ duration: 0.1 }}
                                title={isClickable ? t('download_section.ui.click_to_select_quality', { quality: qualityValue }) : t('download_section.ui.resolution_cannot_be_mapped')}
                              >
                                {resolution}
                                {isCurrentlySelected && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="ml-1 inline-block"
                                  >
                                    ✓
                                  </motion.span>
                                )}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Video information help text */}
                    <div className="pt-2 border-t border-gray-700/50">
                      <HelpText
                        title={t('download_section.help_text.video_information_help_title')}
                        content={t('download_section.help_text.video_information')}
                        compact={true}
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Quality and Audio Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t('download_section.quality_label')}
                  </label>
                  <Tooltip
                    content={t('download_section.tooltips.quality_selector')}
                    position="top"
                  >
                    <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>

                <div className="relative">
                  <select
                    value={selectedQuality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                    className="w-full dropdown pr-12"
                    aria-describedby="quality-help"
                  >
                    {qualityOptions.map(option => {
                      const isAvailable = checkResolutionAvailability(option.value)
                      const isOptimal = videoInfo?.maxResolution && (
                        (option.value === '2160p' && videoInfo.maxResolution.includes('2160')) ||
                        (option.value === '1440p' && videoInfo.maxResolution.includes('1440')) ||
                        (option.value === '1080p' && videoInfo.maxResolution.includes('1080')) ||
                        (option.value === '720p' && videoInfo.maxResolution.includes('720'))
                      )

                      // Get tooltip content for each quality option
                      const getQualityTooltip = (value: string) => {
                        const tooltipMap: Record<string, string> = {
                          '2160p': 'download_section.tooltips.quality_4k',
                          '1440p': 'download_section.tooltips.quality_1440p',
                          '1080p': 'download_section.tooltips.quality_1080p',
                          '720p': 'download_section.tooltips.quality_720p',
                          '480p': 'download_section.tooltips.quality_480p',
                          '320p': 'download_section.tooltips.quality_320p',
                          'bestaudio': 'download_section.tooltips.quality_audio_only'
                        }
                        return tooltipMap[value] || ''
                      }

                      return (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={!isAvailable && videoInfo !== null}
                          title={t(getQualityTooltip(option.value))}
                        >
                          {t(option.label)}
                          {isOptimal ? ` (${t('download_section.video_info.optimal_quality')})` : ''}
                          {!isAvailable && videoInfo ? ` (${t('download_section.ui.not_available')})` : ''}
                        </option>
                      )
                    })}
                  </select>

                  {/* Enhanced visual indicator for quality availability */}
                  {videoInfo && (
                    <Tooltip
                      content={checkResolutionAvailability(selectedQuality)
                        ? t('download_section.tooltips.quality_availability')
                        : t('download_section.tooltips.quality_unavailable')
                      }
                      position="left"
                    >
                      <div className="absolute right-12 top-1/2 transform -translate-y-1/2 cursor-help">
                        <div className={`w-3 h-3 rounded-full border-2 border-gray-800 transition-all duration-200 ${checkResolutionAvailability(selectedQuality)
                          ? 'bg-green-500 shadow-green-500/50 shadow-sm'
                          : 'bg-red-500 shadow-red-500/50 shadow-sm'
                          }`} />
                      </div>
                    </Tooltip>
                  )}
                </div>

                {/* Enhanced quality selection feedback */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {videoInfo && (
                    <div className="text-xs">
                      {checkResolutionAvailability(selectedQuality) ? (
                        <motion.span
                          className="text-green-400 flex items-center space-x-1"
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('download_section.ui.quality_available_from_source')}</span>
                        </motion.span>
                      ) : (
                        <motion.span
                          className="text-yellow-400 flex items-center space-x-1"
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{t('download_section.ui.will_use_best_available_quality')}</span>
                        </motion.span>
                      )}
                    </div>
                  )}

                  {/* Quality selection help text */}
                  <HelpText
                    title={t('download_section.help_text.quality_selection_help_title')}
                    content={t('download_section.help_text.quality_selection')}
                    compact={true}
                  />
                </motion.div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t('download_section.output_folder_label')}
                  </label>
                  <Tooltip
                    content={t('download_section.ui.choose_output_folder')}
                    position="top"
                  >
                    <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder={t('download_section.output_folder_placeholder')}
                    className="input-field flex-1 min-w-0"
                  />
                  <motion.button
                    onClick={selectOutputPath}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="glass-button px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center sm:w-auto w-full"
                  >
                    <FolderOpen className="w-5 h-5" />
                    <span className="ml-2 sm:hidden">{t('download_section.ui.browse')}</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Enhanced Audio Inclusion Toggle */}
            <motion.div
              className="space-y-4 p-4 glass-card rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        id="include-audio"
                        checked={audioSettings.includeAudio}
                        disabled={!audioSettings.isEnabled}
                        onChange={(e) => handleAudioToggle(e.target.checked)}
                        className={`w-6 h-6 rounded-md border-2 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${audioSettings.isEnabled
                          ? 'border-gray-400 text-blue-600 bg-transparent hover:border-blue-500 checked:bg-blue-600 checked:border-blue-600'
                          : 'border-gray-600 bg-gray-700 cursor-not-allowed opacity-50'
                          }`}
                        aria-describedby="include-audio-description"
                      />
                      {/* Enhanced visual feedback overlay */}
                      {audioSettings.isEnabled && (
                        <motion.div
                          className={`absolute inset-0 rounded-md pointer-events-none ${audioSettings.includeAudio ? 'bg-blue-600/20' : 'bg-transparent'
                            }`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{
                            scale: audioSettings.includeAudio ? 1 : 0.8,
                            opacity: audioSettings.includeAudio ? 1 : 0
                          }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <label
                        htmlFor="include-audio"
                        className={`text-sm font-medium transition-colors duration-200 ${audioSettings.isEnabled
                          ? 'text-gray-300 cursor-pointer hover:text-white'
                          : 'text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        {t('download_section.audio_label')}
                      </label>

                      <Tooltip
                        content={t('download_section.tooltips.audio_toggle')}
                        position="top"
                      >
                        <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Enhanced visual feedback for audio inclusion state */}
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!audioSettings.isEnabled ? (
                      <VolumeX className="w-4 h-4 text-gray-500" />
                    ) : audioSettings.includeAudio ? (
                      <Volume2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Monitor className="w-4 h-4 text-orange-500" />
                    )}

                    <div className={`w-3 h-3 rounded-full border-2 border-gray-800 transition-all duration-200 ${!audioSettings.isEnabled
                      ? 'bg-gray-600'
                      : audioSettings.includeAudio
                        ? 'bg-green-500 shadow-green-500/50 shadow-sm'
                        : 'bg-orange-500 shadow-orange-500/50 shadow-sm'
                      }`} />
                  </motion.div>

                  <motion.span
                    className={`text-sm font-medium transition-colors duration-200 ${!audioSettings.isEnabled
                      ? 'text-gray-500'
                      : audioSettings.includeAudio
                        ? 'text-green-400'
                        : 'text-orange-400'
                      }`}
                    key={`${audioSettings.isEnabled}-${audioSettings.includeAudio}`}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!audioSettings.isEnabled
                      ? t('download_section.ui.not_applicable')
                      : audioSettings.includeAudio
                        ? t('download_section.ui.audio_included')
                        : t('download_section.ui.video_only')
                    }
                  </motion.span>
                </div>
              </div>

              {/* Audio toggle description and help */}
              <div className="space-y-2">
                <div className="text-sm text-gray-400" id="include-audio-description">
                  {t('download_section.audio_description')}
                </div>

                <HelpText
                  title={t('download_section.help_text.audio_settings_help_title')}
                  content={t('download_section.help_text.audio_inclusion')}
                  compact={true}
                />
              </div>
            </motion.div>

            {/* Filename Anonymization Toggle */}
            <motion.div
              className="space-y-4 p-4 glass-card rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        id="anonymize-filename"
                        checked={anonymizeFilenames}
                        onChange={(e) => handleAnonymizeToggle(e.target.checked)}
                        className="w-6 h-6 rounded-md border-2 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 border-gray-400 text-blue-600 bg-transparent hover:border-blue-500 checked:bg-blue-600 checked:border-blue-600"
                        aria-describedby="anonymize-filename-description"
                      />
                      {/* Enhanced visual feedback overlay */}
                      <motion.div
                        className={`absolute inset-0 rounded-md pointer-events-none ${anonymizeFilenames ? 'bg-blue-600/20' : 'bg-transparent'}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                          scale: anonymizeFilenames ? 1 : 0.8,
                          opacity: anonymizeFilenames ? 1 : 0
                        }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <label
                        htmlFor="anonymize-filename"
                        className="text-sm font-medium transition-colors duration-200 text-gray-300 cursor-pointer hover:text-white"
                      >
                        {t('download_section.anonymize_filename_label')}
                      </label>

                      <Tooltip
                        content={t('download_section.tooltips.anonymize_filename_toggle')}
                        position="top"
                      >
                        <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Enhanced visual feedback for anonymization state */}
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {anonymizeFilenames ? (
                      <Shield className="w-4 h-4 text-green-500" />
                    ) : (
                      <ShieldOff className="w-4 h-4 text-orange-500" />
                    )}

                    <div className={`w-3 h-3 rounded-full border-2 border-gray-800 transition-all duration-200 ${anonymizeFilenames
                      ? 'bg-green-500 shadow-green-500/50 shadow-sm'
                      : 'bg-orange-500 shadow-orange-500/50 shadow-sm'
                      }`} />
                  </motion.div>

                  <motion.span
                    className={`text-sm font-medium transition-colors duration-200 ${anonymizeFilenames
                      ? 'text-green-400'
                      : 'text-orange-400'
                      }`}
                    key={anonymizeFilenames.toString()}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {anonymizeFilenames
                      ? t('download_section.notifications.anonymization_enabled')
                      : t('download_section.notifications.anonymization_disabled')
                    }
                  </motion.span>
                </div>
              </div>

              {/* Anonymization description and help */}
              <div className="space-y-2">
                <div className="text-sm text-gray-400" id="anonymize-filename-description">
                  {t('download_section.anonymize_filename_description')}
                </div>

                {/* Dynamic filename preview */}
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: anonymizeFilenames ? 1 : 0.6,
                    height: 'auto'
                  }}
                  className={`text-xs rounded-lg p-3 border transition-all duration-300 ${anonymizeFilenames
                    ? 'bg-blue-800/30 border-blue-600/50 text-blue-100'
                    : 'bg-gray-800/30 border-gray-700/50 text-gray-400'
                    }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className={`w-3 h-3 ${anonymizeFilenames ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className={`font-medium ${anonymizeFilenames ? 'text-blue-400' : 'text-gray-500'}`}>
                      {anonymizeFilenames ? t('download_section.ui.filename_preview') : t('download_section.ui.original_filename')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {anonymizeFilenames ? (
                      <>
                        <code className="text-blue-200 block">
                          {generatePreviewFilename()}
                        </code>
                        <div className="text-xs text-blue-300/70 mt-1">
                          {t('download_section.ui.filename_format')}
                        </div>
                      </>
                    ) : (
                      <>
                        <code className="text-gray-300 block">
                          {videoInfo?.title ?
                            `${videoInfo.title.substring(0, 50)}${videoInfo.title.length > 50 ? '...' : ''}.mp4` :
                            'Original Video Title.mp4'
                          }
                        </code>
                        <div className="text-xs text-gray-400 mt-1">
                          {t('download_section.ui.uses_original_title')}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Enhanced help text component */}
                <HelpText
                  title={t('download_section.help_text.filename_anonymization_help_title')}
                  content={t('download_section.help_text.filename_anonymization')}
                  compact={true}
                />
              </div>
            </motion.div>

            {/* Download Button */}
            <motion.button
              onClick={handleDownload}
              disabled={!url.trim()}
              className="btn-primary w-full md:w-auto flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>{t('download_section.start_download_button')}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Download Queue */}
        {downloads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-2xl p-8"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span>{t('download_section.download_queue_title')}</span>
            </h3>

            <div className="space-y-4">
              {downloads.map((download, index) => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card rounded-xl p-4 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${download.status === 'completed' ? 'bg-green-500' :
                        download.status === 'downloading' ? 'bg-blue-500' :
                          download.status === 'error' ? 'bg-red-500' :
                            'bg-gray-500'
                        }`}>
                        {download.status === 'completed' && <Check className="w-4 h-4 text-white" />}
                        {(download.status === 'downloading' || download.status === 'starting') && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                        {download.status === 'error' && <AlertCircle className="w-4 h-4 text-white" />}
                        {download.status === 'pending' && <Download className="w-4 h-4 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-white font-medium truncate">{download.url}</p>
                          {/* Anonymization status indicator */}
                          {download.isAnonymized && (
                            <Tooltip
                              content={t('download_section.ui.anonymized_filename_tooltip')}
                              position="top"
                            >
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex items-center space-x-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full"
                              >
                                <Shield className="w-3 h-3 text-blue-400" />
                                <span className="text-xs text-purple-300 font-medium">{t('download_section.ui.anonymous')}</span>
                              </motion.div>
                            </Tooltip>
                          )}
                        </div>
                        {download.filename && (
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-gray-400 text-sm">{download.filename}</p>
                            {download.isAnonymized && (
                              <span className="text-xs text-blue-400 bg-purple-900/30 px-2 py-0.5 rounded">
                                {t('download_section.ui.anonymized')}
                              </span>
                            )}
                          </div>
                        )}
                        {download.error && (
                          <p className="text-red-400 text-sm">{download.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Enhanced status indicator with anonymization feedback */}
                      <div className="flex items-center space-x-2">
                        {download.isAnonymized && (
                          <Tooltip
                            content={t('download_section.ui.file_saved_anonymized')}
                            position="left"
                          >
                            <div className="w-2 h-2 bg-blue-400 rounded-full" />
                          </Tooltip>
                        )}
                        <span className="text-sm text-gray-400">
                          {Math.round(download.progress)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <motion.div
                      className={`h-2 rounded-full ${download.status === 'completed' ? 'bg-green-500' :
                        download.status === 'error' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${download.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  )
}

export default DownloadSection
