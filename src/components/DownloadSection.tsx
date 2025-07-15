import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Download, Play, AlertCircle, Check, Loader2, Link, FolderOpen, Info, Clock, Monitor, HelpCircle, Volume2, VolumeX } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { VideoInfo, VideoInfoRequest, VideoInfoResponse, AudioSettings } from '../types/quality'
import { getAllQualityOptions, mapSettingsToQuality, getDefaultAudioSettings, generateFormatString, isAudioOnlyQuality, generateFallbackFormatString, validateFormatString, validateUrl, checkCompatibility, categorizeError, isResolutionAvailable } from '../utils/qualityUtils'
import Tooltip from './Tooltip'
import HelpText from './HelpText'
import { NotificationContainer } from './NotificationToast'
import { useNotifications } from '../hooks/useNotifications'

interface DownloadProgress {
  id: string
  url: string
  progress: number
  status: 'pending' | 'starting' | 'downloading' | 'completed' | 'error'
  filename?: string
  error?: string
}

const DownloadSection: React.FC = () => {
  const { t } = useTranslation()
  const { notifications, dismissNotification, showSuccess, showWarning } = useNotifications()
  const [url, setUrl] = useState('')
  const [downloads, setDownloads] = useState<DownloadProgress[]>([])
  const [selectedQuality, setSelectedQuality] = useState('1080p')
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ includeAudio: true, isEnabled: true })
  const [outputPath, setOutputPath] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [isLoadingVideoInfo, setIsLoadingVideoInfo] = useState(false)
  const [videoInfoError, setVideoInfoError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Listen for download progress events
    const unlisten = listen('download-progress', (event: any) => {
      const progress: DownloadProgress = event.payload
      setDownloads(prev => {
        const existingIndex = prev.findIndex(d => d.id === progress.id)
        if (existingIndex !== -1) {
          const updated = [...prev]
          updated[existingIndex] = progress
          return updated
        } else {
          return [...prev, progress]
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

  // Load default quality from settings on component mount
  useEffect(() => {
    const loadDefaultQuality = async () => {
      try {
        const settings = await invoke('get_settings')
        if (settings && typeof settings === 'object' && 'default_quality' in settings) {
          const defaultQuality = (settings as any).default_quality
          const mappedQuality = mapSettingsToQuality(defaultQuality)
          setSelectedQuality(mappedQuality)
        }
      } catch (error) {
        console.error('Error loading default quality from settings:', error)
        // Keep default 1080p if settings can't be loaded
      }
    }

    loadDefaultQuality()
  }, [])

  const selectOutputPath = async () => {
    try {
      console.log('Opening folder dialog...')
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('download_section.select_folder_title')
      })

      console.log('Dialog result:', selected)

      if (selected && typeof selected === 'string') {
        setOutputPath(selected)
        console.log('Output path set to:', selected)
      } else if (selected === null) {
        console.log('User cancelled dialog')
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

          console.log(`Fallback: ${selectedQuality} -> ${actualQuality}, format: ${formatString}`)
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
        compatibilityWarnings: compatibilityCheck.warnings,
        videoInfo: videoInfo ? {
          title: videoInfo.title,
          maxResolution: videoInfo.maxResolution,
          hasAudio: videoInfo.hasAudio
        } : null
      })

      // Create download request with enhanced format string
      await invoke('start_download', {
        request: {
          url: url.trim(),
          format: formatString,
          output_path: finalOutputPath
        }
      })

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

      // Show success notification
      showSuccess(
        t('download_section.notifications.download_started_title'),
        t('download_section.notifications.download_started_message')
      )

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
        error: errorMessage
      }

      setDownloads(prev => [...prev, errorDownload])
    }
  }

  const getDefaultDownloadPath = async () => {
    // Try to get default downloads folder or use current directory
    return './downloads'
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
      <NotificationContainer
        notifications={notifications}
        onDismiss={dismissNotification}
      />
      <div className="space-y-6">
        {/* Download Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-lilac-500 to-purple-600 rounded-lg flex items-center justify-center">
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
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
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
                          <Monitor className="w-4 h-4 text-purple-400" />
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
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                                  isCurrentlySelected
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400/50 shadow-lg shadow-purple-500/25'
                                    : isClickable
                                    ? 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-300 border-gray-600/50 hover:border-gray-500/50 hover:from-gray-600 hover:to-gray-500 cursor-pointer'
                                    : 'bg-gradient-to-r from-gray-800 to-gray-700 text-gray-500 border-gray-700/50 cursor-not-allowed opacity-60'
                                }`}
                                whileHover={isClickable ? { scale: 1.05 } : {}}
                                whileTap={isClickable ? { scale: 0.95 } : {}}
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
                    content="Choose where to save downloaded files. Leave empty to use default downloads folder."
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
                    <span className="ml-2 sm:hidden">Browse</span>
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
                        className={`w-6 h-6 rounded-md border-2 transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${audioSettings.isEnabled
                          ? 'border-gray-400 text-purple-600 bg-transparent hover:border-purple-500 checked:bg-purple-600 checked:border-purple-600'
                          : 'border-gray-600 bg-gray-700 cursor-not-allowed opacity-50'
                          }`}
                        aria-describedby="include-audio-description"
                      />
                      {/* Enhanced visual feedback overlay */}
                      {audioSettings.isEnabled && (
                        <motion.div
                          className={`absolute inset-0 rounded-md pointer-events-none ${audioSettings.includeAudio ? 'bg-purple-600/20' : 'bg-transparent'
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
                      ? 'Not applicable'
                      : audioSettings.includeAudio
                        ? 'Audio included'
                        : 'Video only'
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

            {/* Download Button */}
            <motion.button
              onClick={handleDownload}
              disabled={!url.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full md:w-auto flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed glass-effect-strong hover:shadow-purple-500/25"
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
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
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
                  className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-all duration-300"
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
                        <p className="text-white font-medium truncate">{download.url}</p>
                        {download.filename && (
                          <p className="text-gray-400 text-sm">{download.filename}</p>
                        )}
                        {download.error && (
                          <p className="text-red-400 text-sm">{download.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-400">
                        {Math.round(download.progress)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <motion.div
                      className={`h-2 rounded-full ${download.status === 'completed' ? 'bg-green-500' :
                        download.status === 'error' ? 'bg-red-500' :
                          'bg-gradient-to-r from-lilac-500 to-purple-600'
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