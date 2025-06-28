import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Film, Scissors, Volume2, Crop, Filter, Play, RotateCw, 
  Download, Upload, Pause, SkipBack, SkipForward, FileVideo,
  MoreVertical, Maximize2, Minimize2, Music, Palette, Trash2,
  CheckCircle, AlertCircle, Info, X
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'

interface EditOperation {
  id: string
  type: 'trim' | 'crop' | 'volume' | 'filter' | 'rotate' | 'speed' | 'fade' | 'text'
  params: any
  startTime?: number
  endTime?: number
  enabled: boolean
}

interface MediaInfo {
  filename: string
  duration?: string
  resolution?: string
  format: string
  size: number
}

interface VideoLibraryFile {
  id: string
  name: string
  path: string
  duration?: string
  size: string
  thumbnail?: string
  type: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
}

interface EditSectionProps {
  selectedFile?: string
}

const EditSection: React.FC<EditSectionProps> = ({ selectedFile: propSelectedFile }) => {
  const { t } = useTranslation()
  
  // Video states
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [videoSrc, setVideoSrc] = useState<string>('')
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [libraryFiles, setLibraryFiles] = useState<VideoLibraryFile[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  
  // Playback states
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  
  // Timeline states
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  
  // Editing states
  const [editOperations, setEditOperations] = useState<EditOperation[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  
  // UI states
  const [activePanel, setActivePanel] = useState<'tools' | 'effects' | 'audio' | 'export'>('tools')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Modal states
  const [showCropModal, setShowCropModal] = useState(false)
  const [showTextModal, setShowTextModal] = useState(false)
  
  // Crop settings
  const [cropSettings, setCropSettings] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showCropOverlay, setShowCropOverlay] = useState(false)
  
  // Effect settings
  const [effectSettings, setEffectSettings] = useState({
    brightness: 0.2,
    contrast: 1.5,
    saturation: 1.5,
    blur: 2,
    sharpen: 1.0
  })

  // Drag and drop state
  const [draggedOperation, setDraggedOperation] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Text settings
  const [textSettings, setTextSettings] = useState({
    text: '',
    x: 50,
    y: 50,
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Arial',
    duration: 5,
    startTime: 0
  })
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Toast system
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const newToast = { ...toast, id: Date.now().toString() }
    setToasts(prev => [...prev, newToast])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Load library files on component mount
  useEffect(() => {
    loadLibraryFiles()
  }, [])

  // Load video when prop changes
  useEffect(() => {
    if (propSelectedFile && propSelectedFile !== selectedFile) {
      setSelectedFile(propSelectedFile)
      loadVideo(propSelectedFile)
    }
  }, [propSelectedFile])

  // Apply visual effects to preview
  const applyPreviewEffects = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get enabled operations
    const enabledOps = editOperations.filter(op => op.enabled)
    const cropOp = enabledOps.find(op => op.type === 'crop')
    const rotateOps = enabledOps.filter(op => op.type === 'rotate')
    const filterOps = enabledOps.filter(op => op.type === 'filter')
    const textOps = enabledOps.filter(op => op.type === 'text')

    // Calculate total rotation
    let totalRotation = 0
    rotateOps.forEach(op => {
      totalRotation += op.params.angle
    })

    // Set canvas dimensions based on rotation
    let canvasWidth = video.videoWidth
    let canvasHeight = video.videoHeight
    
    if (totalRotation % 180 !== 0) {
      // Swap dimensions for 90° and 270° rotations
      canvasWidth = video.videoHeight
      canvasHeight = video.videoWidth
    }
    
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.objectFit = 'contain'

    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply rotation transformation
    ctx.save()
    if (totalRotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((totalRotation * Math.PI) / 180)
      ctx.translate(-video.videoWidth / 2, -video.videoHeight / 2)
    }

    // Determine source area (for crop)
    let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight
    let destX = 0, destY = 0, destWidth = video.videoWidth, destHeight = video.videoHeight

    if (cropOp) {
      // Use video element dimensions for accurate scaling
      const videoContainer = video.parentElement
      if (videoContainer) {
        const containerRect = videoContainer.getBoundingClientRect()
        const videoAspect = video.videoWidth / video.videoHeight
        const containerAspect = containerRect.width / containerRect.height
        
        let videoDisplayWidth, videoDisplayHeight, videoOffsetX, videoOffsetY
        if (videoAspect > containerAspect) {
          videoDisplayWidth = containerRect.width
          videoDisplayHeight = containerRect.width / videoAspect
          videoOffsetX = 0
          videoOffsetY = (containerRect.height - videoDisplayHeight) / 2
        } else {
          videoDisplayHeight = containerRect.height
          videoDisplayWidth = containerRect.height * videoAspect
          videoOffsetX = (containerRect.width - videoDisplayWidth) / 2
          videoOffsetY = 0
        }
        
        const scaleX = video.videoWidth / videoDisplayWidth
        const scaleY = video.videoHeight / videoDisplayHeight
        
        // Convert screen-space crop area to video-space source area
        sourceX = (cropOp.params.x - videoOffsetX) * scaleX
        sourceY = (cropOp.params.y - videoOffsetY) * scaleY
        sourceWidth = cropOp.params.width * scaleX
        sourceHeight = cropOp.params.height * scaleY

        // The destination should now be the entire canvas to show a zoomed-in preview
        destX = 0
        destY = 0
        destWidth = canvas.width
        destHeight = canvas.height
      }
    }

    // Draw video frame (with crop and rotation applied)
    try {
      ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight)
    } catch (error) {
      console.warn('Error drawing video frame:', error)
      ctx.restore()
      return
    }

    // Apply text overlays
    const currentVideoTime = video.currentTime
    textOps.forEach(textOp => {
      const { text, x, y, fontSize, color, startTime, duration } = textOp.params
      
      // Check if text should be visible at current time
      const endTime = startTime + duration
      if (currentVideoTime >= startTime && currentVideoTime <= endTime) {
        // Calculate text position (percentage-based)
        const textX = (x / 100) * destWidth + destX
        const textY = (y / 100) * destHeight + destY
        
        // Set text style
        ctx.save()
        ctx.font = `${fontSize}px Arial, sans-serif`
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Add text stroke for better visibility
        ctx.strokeStyle = 'black'
        ctx.lineWidth = Math.max(1, fontSize / 12)
        ctx.strokeText(text, textX, textY)
        ctx.fillText(text, textX, textY)
        
        ctx.restore()
      }
    })

    ctx.restore()

    // Apply filter effects
    if (filterOps.length > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      filterOps.forEach(filter => {
        const filterType = filter.params.filterType
        const intensity = filter.params.intensity || 1.0
        
        switch (filterType) {
          case 'brightness':
            const brightValue = intensity * 128 // More visible effect
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, data[i] + brightValue))
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightValue))
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightValue))
            }
            break
          case 'contrast':
            const contrastFactor = intensity
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrastFactor) + 128))
              data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrastFactor) + 128))
              data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrastFactor) + 128))
            }
            break
          case 'saturation':
            const satFactor = intensity
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2]
              const gray = 0.299 * r + 0.587 * g + 0.114 * b
              data[i] = Math.min(255, Math.max(0, gray + satFactor * (r - gray)))
              data[i + 1] = Math.min(255, Math.max(0, gray + satFactor * (g - gray)))
              data[i + 2] = Math.min(255, Math.max(0, gray + satFactor * (b - gray)))
            }
            break
          case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
              data[i] = gray
              data[i + 1] = gray
              data[i + 2] = gray
            }
            break
          case 'sepia':
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2]
              data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))
              data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168))
              data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
            }
            break
          case 'vintage':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, data[i] * 1.2)
              data[i + 1] = Math.min(255, data[i + 1] * 0.9)
              data[i + 2] = Math.min(255, data[i + 2] * 0.8)
            }
            break
          case 'invert':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i]
              data[i + 1] = 255 - data[i + 1]
              data[i + 2] = 255 - data[i + 2]
            }
            break
        }
      })

      ctx.putImageData(imageData, 0, 0)
    }

    // Apply CSS filters for blur and sharpen
    let cssFilters: string[] = []
    filterOps.forEach(filter => {
      const filterType = filter.params.filterType
      const intensity = filter.params.intensity || 1.0
      
      if (filterType === 'blur') {
        cssFilters.push(`blur(${intensity}px)`)
      } else if (filterType === 'sharpen') {
        cssFilters.push(`contrast(${1 + intensity * 0.5})`)
      }
    })
    
    canvas.style.filter = cssFilters.join(' ')

    // Show canvas if there are any effects
    if (enabledOps.length > 0) {
      canvas.style.display = 'block'
      canvas.style.zIndex = '2'
    } else {
      canvas.style.display = 'none'
    }
  }, [editOperations])

  // Listen for processing events
  useEffect(() => {
    const unlisten = listen('processing-progress', (event: any) => {
      const progress = event.payload
      setProcessingProgress(progress.progress)
      if (progress.status === 'completed') {
        setIsProcessing(false)
        addToast({
          type: 'success',
          title: t('editSection.toasts.exportComplete.title'),
          message: t('editSection.toasts.exportComplete.message')
        })
      } else if (progress.status === 'error') {
        setIsProcessing(false)
        console.error('Processing error:', progress.error)
        addToast({
          type: 'error',
          title: t('editSection.toasts.exportFailed.title'),
          message: progress.error || t('editSection.toasts.exportFailed.message')
        })
      }
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [addToast])

  // Setup video event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setTrimStart(0)
      setTrimEnd(video.duration)
    }

    const handleTimeUpdate = () => {
      const video = videoRef.current
      if (!video) return

      setCurrentTime(video.currentTime)

      // When trimming, automatically skip over the removed sections during playback
      const trimOps = editOperations
        .filter(op => op.enabled && op.type === 'trim')
        .sort((a, b) => a.params.start - b.params.start)

      if (trimOps.length === 0 || video.paused || isDraggingTimeline) {
        return
      }

      const currentTime = video.currentTime
      let inValidSegment = false

      for (const op of trimOps) {
        // If current time is within any trim segment, it's valid.
        if (currentTime >= op.params.start && currentTime < op.params.end) {
          inValidSegment = true
          break
        }
      }

      // If playback is in a "gap" between trim segments...
      if (!inValidSegment) {
        let nextSegmentStart = -1
        // Find the start of the very next segment.
        for (const op of trimOps) {
          if (op.params.start > currentTime) {
            nextSegmentStart = op.params.start
            break
          }
        }

        if (nextSegmentStart !== -1) {
          // Jump to the start of that next segment.
          video.currentTime = nextSegmentStart
        } else {
          // We are past the end of the last segment. Stop playback.
          const lastTrim = trimOps[trimOps.length - 1]
          video.currentTime = lastTrim.params.end
          video.pause()
        }
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    const handleSeeked = () => {
      // Apply visual effects when video position changes
      requestAnimationFrame(applyPreviewEffects)
    }

    const handleFrameUpdate = () => {
      // Continuously update preview effects for real-time preview
      if (video.paused || video.ended) return
      requestAnimationFrame(applyPreviewEffects)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('play', handleFrameUpdate)
    video.addEventListener('timeupdate', handleFrameUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('play', handleFrameUpdate)
      video.removeEventListener('timeupdate', handleFrameUpdate)
    }
  }, [videoSrc, editOperations, applyPreviewEffects, isDraggingTimeline])

  // Apply effects when operations change
  useEffect(() => {
    if (videoSrc) {
      requestAnimationFrame(applyPreviewEffects)
    }
  }, [editOperations, applyPreviewEffects, videoSrc])

  // Apply volume, speed, and rotation effects in real-time
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Apply volume operations
    const volumeOp = editOperations.find(op => op.enabled && op.type === 'volume')
    if (volumeOp) {
      video.volume = Math.min(1, Math.max(0, volumeOp.params.level))
    }

    // Apply speed operations  
    const speedOp = editOperations.find(op => op.enabled && op.type === 'speed')
    if (speedOp) {
      video.playbackRate = speedOp.params.speed
    }

    // Apply rotation operations with CSS transforms
    const rotateOps = editOperations.filter(op => op.enabled && op.type === 'rotate')
    let totalRotation = 0
    rotateOps.forEach(op => {
      totalRotation += op.params.angle
    })
    
    if (totalRotation !== 0) {
      video.style.transform = `rotate(${totalRotation}deg)`
    } else {
      video.style.transform = ''
    }
  }, [editOperations])

  const loadLibraryFiles = async () => {
    try {
      const files = await invoke('list_files', { directory: './downloads' }) as any[]
      const videoFiles = await Promise.all(
        files
          .filter(file => ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'].includes(
            file.name.split('.').pop()?.toLowerCase() || ''
          ))
          .map(async (file: any, index: number) => {
            // Generate thumbnail for video
            let thumbnail: string | undefined;
            try {
              thumbnail = await invoke('generate_thumbnail_data', {
                filePath: file.path
              }) as string;
            } catch (error) {
              console.warn('Failed to generate thumbnail for', file.name, error);
            }

            return {
              id: `${index}`,
              name: file.name,
              path: file.path,
              size: formatFileSize(file.size),
              type: 'video',
              thumbnail
            };
          })
      );
      setLibraryFiles(videoFiles)
    } catch (error) {
      console.error('Error loading library files:', error)
      addToast({
        type: 'error',
        title: t('editSection.toasts.libraryError.title'),
        message: t('editSection.toasts.libraryError.message')
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const selectVideoFromLibrary = async (file: VideoLibraryFile) => {
    setSelectedFile(file.path)
    await loadVideo(file.path)
    setShowLibrary(false)
  }

  const selectVideoFile = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: t('editSection.dialogs.selectVideoFile'),
        filters: [{
          name: t('editSection.dialogs.videoFiles'),
          extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv']
        }]
      })
      
      if (selected && typeof selected === 'string') {
        setSelectedFile(selected)
        await loadVideo(selected)
      }
    } catch (error) {
      console.error('Error selecting file:', error)
      addToast({
        type: 'error',
        title: t('editSection.toasts.fileSelectionError.title'),
        message: t('editSection.toasts.fileSelectionError.message')
      })
    }
  }

  const loadVideo = async (filePath: string) => {
    try {
      setIsLoadingVideo(true)
      
      // Get video info
      const info: MediaInfo = await invoke('get_video_info', { filePath })
      setMediaInfo(info)
      
      // Get video URL for playback
      const videoUrl = await invoke('get_video_url', { filePath }) as string
      setVideoSrc(videoUrl)
      
      // Reset editing state
      setEditOperations([])
      setCurrentTime(0)
      
      setIsLoadingVideo(false)

      addToast({
        type: 'success',
        title: t('editSection.toasts.videoLoaded.title'),
        message: t('editSection.toasts.videoLoaded.message', { fileName: info.filename })
      })
    } catch (error) {
      console.error('Error loading video:', error)
      setIsLoadingVideo(false)
      addToast({
        type: 'error',
        title: t('editSection.toasts.videoLoadError.title'),
        message: t('editSection.toasts.videoLoadError.message')
      })
    }
  }

  // Playback controls
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    
    video.currentTime = Math.max(0, Math.min(time, video.duration))
  }

  const skipForward = () => seek(currentTime + 10)
  const skipBackward = () => seek(currentTime - 10)

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current
    if (!video) return
    
    video.volume = newVolume
    setVolume(newVolume)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const changePlaybackSpeed = (speed: number) => {
    const video = videoRef.current
    if (!video) return
    
    video.playbackRate = speed
    setPlaybackSpeed(speed)
  }

  // Timeline functions
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Seek helper (shared by click & drag)
  const seekToPosition = (clientX: number, timelineRect: DOMRect) => {
    const video = videoRef.current
    if (!video) return
    const totalDuration = video.duration || duration
    if (!totalDuration) return

    const x = clientX - timelineRect.left
    const percentage = Math.max(0, Math.min(1, x / timelineRect.width))
    let targetTime = percentage * totalDuration

    // Find which trim segment contains this time (if any)
    const trimOps = editOperations.filter(op => op.enabled && op.type === 'trim')
    if (trimOps.length > 0) {
      // Find the trim segment that contains this time
      const validTrim = trimOps.find(trim => {
        return targetTime >= trim.params.start && targetTime <= trim.params.end
      })
      
      if (validTrim) {
        // already correct
      } else {
        // Find the closest trim segment
        const closestTrim = trimOps.reduce((closest, trim) => {
          const currentDistance = Math.min(
            Math.abs(targetTime - trim.params.start),
            Math.abs(targetTime - trim.params.end)
          )
          const closestDistance = Math.min(
            Math.abs(targetTime - closest.params.start),
            Math.abs(targetTime - closest.params.end)
          )
          return currentDistance < closestDistance ? trim : closest
        })
        
        // Seek to the closest boundary
        if (Math.abs(targetTime - closestTrim.params.start) < Math.abs(targetTime - closestTrim.params.end)) {
          targetTime = closestTrim.params.start
        } else {
          targetTime = closestTrim.params.end
        }
      }
    }

    video.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  const handleTimelineClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const timelineEl = e.currentTarget as HTMLElement
    const rect = timelineEl.getBoundingClientRect()

    // Prefer offsetX which is reliable even inside transforms
    const offsetX = (e.nativeEvent as MouseEvent).offsetX
    if (rect.width === 0) return
    seekToPosition(rect.left + offsetX, rect)
  }

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const timeline = e.currentTarget as HTMLElement
    const downX = e.clientX

    requestAnimationFrame(() => {
      const timelineRect = timeline.getBoundingClientRect()
      if (timelineRect.width === 0) return

      setIsDraggingTimeline(true)
      seekToPosition(downX, timelineRect)

      const moveListener = (ev: MouseEvent) => {
        seekToPosition(ev.clientX, timelineRect)
      }
      const upListener = () => {
        setIsDraggingTimeline(false)
        document.removeEventListener('mousemove', moveListener)
        document.removeEventListener('mouseup', upListener)
      }
      document.addEventListener('mousemove', moveListener)
      document.addEventListener('mouseup', upListener)
    })
  }

  // Edit operations
  const addTrimOperation = () => {
    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'trim',
      params: { start: trimStart, end: trimEnd },
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.trimAdded.title'),
      message: t('editSection.toasts.trimAdded.message', { start: formatTime(trimStart), end: formatTime(trimEnd) })
    })
  }

  const addCropOperation = () => {
    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'crop',
      params: cropSettings,
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    setShowCropModal(false)
    setShowCropOverlay(false)
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.cropAdded.title'),
      message: t('editSection.toasts.cropAdded.message', { width: cropSettings.width, height: cropSettings.height })
    })
  }

  const startVisualCrop = () => {
    setShowCropOverlay(true)
    setShowCropModal(false)
    
    // Initialize crop area to center 50% of the *visible* video (letter-boxed area)
    const video = videoRef.current
    if (video) {
      const container = video.parentElement as HTMLElement | null
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const videoAspect = video.videoWidth / video.videoHeight
      const containerAspect = containerRect.width / containerRect.height

      let displayW: number, displayH: number, offsetX: number, offsetY: number

      if (videoAspect > containerAspect) {
        // Fit to width, pillar-boxed top/bottom
        displayW = containerRect.width
        displayH = containerRect.width / videoAspect
        offsetX = 0
        offsetY = (containerRect.height - displayH) / 2
      } else {
        // Fit to height, letter-boxed left/right
        displayH = containerRect.height
        displayW = containerRect.height * videoAspect
        offsetX = (containerRect.width - displayW) / 2
        offsetY = 0
      }

      const width = displayW * 0.5
      const height = displayH * 0.5
      const x = offsetX + (displayW - width) / 2
      const y = offsetY + (displayH - height) / 2

      setCropSettings({
        x,
        y,
        width,
        height
      })
    }
  }

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingCrop(true)
    
    // Get the current crop area position
    const cropRect = e.currentTarget.getBoundingClientRect()
    setDragStart({
      x: e.clientX - cropRect.left,
      y: e.clientY - cropRect.top
    })
  }

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return
    
    const video = videoRef.current
    if (!video) return
    
    // Get video container bounds
    const videoContainer = video.parentElement
    if (!videoContainer) return
    
    const containerRect = videoContainer.getBoundingClientRect()
    
    // Calculate the display area of the video within its container
    const videoAspect = video.videoWidth / video.videoHeight
    const containerAspect = containerRect.width / containerRect.height
    
    let videoDisplayWidth, videoDisplayHeight, videoOffsetX, videoOffsetY
    
    if (videoAspect > containerAspect) {
      videoDisplayWidth = containerRect.width
      videoDisplayHeight = containerRect.width / videoAspect
      videoOffsetX = 0
      videoOffsetY = (containerRect.height - videoDisplayHeight) / 2
    } else {
      videoDisplayHeight = containerRect.height
      videoDisplayWidth = containerRect.height * videoAspect
      videoOffsetX = (containerRect.width - videoDisplayWidth) / 2
      videoOffsetY = 0
    }
    
    // Raw coords relative to overlay container
    const rawX = e.clientX - containerRect.left - dragStart.x
    const rawY = e.clientY - containerRect.top - dragStart.y

    // Constrain within the visible video display area
    const minX = videoOffsetX
    const maxX = videoOffsetX + videoDisplayWidth - cropSettings.width
    const minY = videoOffsetY
    const maxY = videoOffsetY + videoDisplayHeight - cropSettings.height

    const newX = Math.max(minX, Math.min(rawX, maxX))
    const newY = Math.max(minY, Math.min(rawY, maxY))
    
    setCropSettings(prev => ({
      ...prev,
      x: newX,
      y: newY
    }))
  }

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false)
  }

  const handleCropResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const video = videoRef.current
    if (!video) return
    
    const videoRect = video.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startCrop = { ...cropSettings }
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      
      let newCrop = { ...startCrop }
      
      switch (direction) {
        case 'se': // bottom-right
          newCrop.width = Math.min(videoRect.width - newCrop.x, Math.max(50, startCrop.width + deltaX))
          newCrop.height = Math.min(videoRect.height - newCrop.y, Math.max(50, startCrop.height + deltaY))
          break
        case 'sw': // bottom-left
          const newWidth = Math.max(50, startCrop.width - deltaX)
          newCrop.x = Math.max(0, startCrop.x - (newWidth - startCrop.width))
          newCrop.width = newWidth
          newCrop.height = Math.min(videoRect.height - newCrop.y, Math.max(50, startCrop.height + deltaY))
          break
        case 'ne': // top-right
          const newHeight = Math.max(50, startCrop.height - deltaY)
          newCrop.y = Math.max(0, startCrop.y - (newHeight - startCrop.height))
          newCrop.width = Math.min(videoRect.width - newCrop.x, Math.max(50, startCrop.width + deltaX))
          newCrop.height = newHeight
          break
        case 'nw': // top-left
          const newW = Math.max(50, startCrop.width - deltaX)
          const newH = Math.max(50, startCrop.height - deltaY)
          newCrop.x = Math.max(0, startCrop.x - (newW - startCrop.width))
          newCrop.y = Math.max(0, startCrop.y - (newH - startCrop.height))
          newCrop.width = newW
          newCrop.height = newH
          break
      }
      
      setCropSettings(newCrop)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const addFilterOperation = (filterType: string, intensity?: number) => {
    const params: any = { filterType }
    
    // Add intensity parameters based on effect settings
    switch (filterType) {
      case 'brightness':
        params.intensity = intensity || effectSettings.brightness
        break
      case 'contrast':
        params.intensity = intensity || effectSettings.contrast
        break
      case 'saturation':
        params.intensity = intensity || effectSettings.saturation
        break
      case 'blur':
        params.intensity = intensity || effectSettings.blur
        break
      case 'sharpen':
        params.intensity = intensity || effectSettings.sharpen
        break
    }

    const operation: EditOperation = {
      id: Date.now().toString(),
        type: 'filter',
      params,
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.filterAdded.title'),
      message: t('editSection.toasts.filterAdded.message', { filterType })
    })
  }



  const addVolumeOperation = (volumeLevel: number) => {
    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'volume',
      params: { level: volumeLevel },
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.volumeAdded.title'),
      message: t('editSection.toasts.volumeAdded.message', { volume: Math.round(volumeLevel * 100) })
    })
  }

  const addRotateOperation = (angle: number) => {
    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'rotate',
      params: { angle },
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.rotationAdded.title'),
      message: t('editSection.toasts.rotationAdded.message', { angle })
    })
  }

  const addSpeedOperation = (speed: number) => {
    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'speed',
      params: { speed },
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.speedAdded.title'),
      message: t('editSection.toasts.speedAdded.message', { speed })
    })
  }

  const addTextOperation = () => {
    if (!textSettings.text.trim()) {
      addToast({
        type: 'warning',
        title: t('editSection.toasts.textRequired.title'),
        message: t('editSection.toasts.textRequired.message')
      })
      return
    }

    const operation: EditOperation = {
      id: Date.now().toString(),
      type: 'text',
      params: { ...textSettings },
      enabled: true
    }
    setEditOperations(prev => [...prev, operation])
    setShowTextModal(false)
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.textAdded.title'),
      message: t('editSection.toasts.textAdded.message', { 
        text: textSettings.text.substring(0, 20) + (textSettings.text.length > 20 ? '...' : '')
      })
    })
  }

  const removeOperation = (id: string) => {
    setEditOperations(prev => prev.filter(op => op.id !== id))
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.operationRemoved.title'),
      message: t('editSection.toasts.operationRemoved.message')
    })
  }

  const toggleOperation = (id: string) => {
    setEditOperations(prev => prev.map(op => 
      op.id === id ? { ...op, enabled: !op.enabled } : op
    ))
  }

  // Drag and drop functions
  const handleDragStart = (e: React.DragEvent, operationId: string) => {
    e.dataTransfer.setData('text/plain', operationId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedOperation(operationId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear if we're leaving the container, not moving between children
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId) return
    
    const sourceIndex = editOperations.findIndex(op => op.id === draggedId)
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggedOperation(null)
      setDragOverIndex(null)
      return
    }

    const newOperations = [...editOperations]
    const [movedOperation] = newOperations.splice(sourceIndex, 1)
    newOperations.splice(targetIndex, 0, movedOperation)
    
    setEditOperations(newOperations)
    setDraggedOperation(null)
    setDragOverIndex(null)
    
    addToast({
      type: 'info',
      title: t('editSection.toasts.operationsReordered.title'),
      message: t('editSection.toasts.operationsReordered.message')
    })
  }

  const handleDragEnd = () => {
    setDraggedOperation(null)
    setDragOverIndex(null)
  }

  const exportVideo = async () => {
    if (!selectedFile || editOperations.length === 0) {
      addToast({
        type: 'warning',
        title: t('editSection.toasts.exportWarning.title'),
        message: t('editSection.toasts.exportWarning.message')
      })
      return
    }

    try {
      const outputPath = await save({
        title: t('editSection.dialogs.saveEditedVideo'),
        filters: [{ name: t('editSection.dialogs.videoFiles'), extensions: ['mp4'] }]
      })

      if (!outputPath) return

        setIsProcessing(true)
        setProcessingProgress(0)

      const request = {
            input_path: selectedFile,
            output_path: outputPath,
        operations: editOperations.filter(op => op.enabled).map(op => ({
          operation_type: op.type,
          params: op.params
        }))
      }

      await invoke('process_video', { request })

      addToast({
        type: 'info',
        title: t('editSection.toasts.exportStarted.title'),
        message: t('editSection.toasts.exportStarted.message')
      })
    } catch (error) {
      console.error('Error exporting video:', error)
      setIsProcessing(false)
      addToast({
        type: 'error',
        title: t('editSection.toasts.exportError.title'),
        message: t('editSection.toasts.exportError.message', { error: String(error) })
      })
    }
  }

  const exportToLibrary = async () => {
    if (!selectedFile || editOperations.length === 0) {
      addToast({
        type: 'warning',
        title: t('editSection.toasts.exportWarning.title'),
        message: t('editSection.toasts.exportWarning.message')
      })
      return
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const originalName = mediaInfo?.filename || 'edited_video'
      const baseName = originalName.replace(/\.[^/.]+$/, '') // Remove extension
      const outputPath = `./downloads/edited_${baseName}_${timestamp}.mp4`

      setIsProcessing(true)
      setProcessingProgress(0)

      const request = {
        input_path: selectedFile,
        output_path: outputPath,
        operations: editOperations.filter(op => op.enabled).map(op => ({
          operation_type: op.type,
          params: op.params
        }))
      }

      await invoke('process_video', { request })

      addToast({
        type: 'info',
        title: t('editSection.toasts.exportToLibraryStarted.title'),
        message: t('editSection.toasts.exportToLibraryStarted.message')
      })
    } catch (error) {
      console.error('Error exporting to library:', error)
      setIsProcessing(false)
      addToast({
        type: 'error',
        title: t('editSection.toasts.exportError.title'),
        message: t('editSection.toasts.exportError.message', { error: String(error) })
      })
    }
  }

  const ToastIcon = ({ type }: { type: Toast['type'] }) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'info': return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed top-4 left-4 z-50 space-y-2">
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                className="glass-effect-strong rounded-lg p-4 min-w-80 shadow-xl border border-white/20"
              >
                <div className="flex items-start space-x-3">
                  <ToastIcon type={toast.type} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{toast.title}</h4>
                    <p className="text-sm text-gray-300">{toast.message}</p>
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="glass-button text-gray-400 hover:text-white p-1 rounded hover:scale-110 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
          </div>
            <div>
          <h2 className="text-2xl font-bold text-white">{t('editSection.videoLibrary.title')}</h2>
              <p className="text-gray-400 text-sm">
                {selectedFile ? mediaInfo?.filename || t('editSection.videoLibrary.loading') : t('editSection.videoLibrary.noVideoSelected')}
              </p>
            </div>
        </div>          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="glass-button px-4 py-2 flex items-center space-x-2 hover:scale-105 transition-transform rounded-lg"
            >
              <FileVideo className="w-4 h-4" />
              <span>{t('editSection.videoLibrary.library')}</span>
            </button>
            <button
              onClick={selectVideoFile}
              className="glass-button px-4 py-2 flex items-center space-x-2 bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 hover:from-purple-400/80 hover:to-purple-500/90 hover:shadow-purple-500/25 hover:scale-105 transition-all rounded-lg"
            >
              <Upload className="w-4 h-4" />
              <span>{t('editSection.videoLibrary.import')}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Editor Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Video Preview */}
        <div className="lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-2xl p-4"
          >
            {/* Preview Window */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                  {isLoadingVideo ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                    </div>
                  ) : videoSrc ? (
                <>
                    <video
                      ref={videoRef}
                      src={videoSrc}
                    className="w-full h-full object-contain"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 pointer-events-none w-full h-full object-contain"
                    style={{ 
                      display: editOperations.some(op => 
                        op.enabled && (
                          op.type === 'crop' || 
                          op.type === 'rotate' ||
                          (op.type === 'text' && 
                           currentTime >= op.params.startTime && 
                           currentTime <= op.params.startTime + op.params.duration)
                        )
                      ) ? 'block' : 'none' 
                    }}
                  />
                  
                  {/* Crop Overlay */}
                  {showCropOverlay && (
                    <div 
                      className="absolute inset-0"
                      onMouseMove={handleCropMouseMove}
                      onMouseUp={handleCropMouseUp}
                    >
                      {/* Darkened overlay */}
                      <div className="absolute inset-0 bg-black opacity-50"></div>
                      
                      {/* Crop area */}
                      <div
                        className="absolute border-2 border-yellow-400 bg-transparent cursor-move"
                        style={{
                          left: cropSettings.x,
                          top: cropSettings.y,
                          width: cropSettings.width,
                          height: cropSettings.height,
                        }}
                        onMouseDown={handleCropMouseDown}
                      >
                        {/* Corner handles */}
                        <div 
                          className="absolute -top-1 -left-1 w-3 h-3 bg-yellow-400 cursor-nw-resize hover:bg-yellow-300"
                          onMouseDown={(e) => handleCropResize(e, 'nw')}
                        ></div>
                        <div 
                          className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 cursor-ne-resize hover:bg-yellow-300"
                          onMouseDown={(e) => handleCropResize(e, 'ne')}
                        ></div>
                        <div 
                          className="absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-400 cursor-sw-resize hover:bg-yellow-300"
                          onMouseDown={(e) => handleCropResize(e, 'sw')}
                        ></div>
                        <div 
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-400 cursor-se-resize hover:bg-yellow-300"
                          onMouseDown={(e) => handleCropResize(e, 'se')}
                        ></div>
                        
                        {/* Crop info */}
                        <div className="absolute -top-8 left-0 bg-black text-white text-xs px-2 py-1 rounded">
                          {Math.round(cropSettings.width)} × {Math.round(cropSettings.height)}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                    <FileVideo className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>{t('editSection.videoLibrary.selectVideoMessage')}</p>
                      </div>
                    </div>
                  )}

              {/* Fullscreen toggle */}
              {videoSrc && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="absolute top-4 right-4 glass-button p-2 rounded-lg hover:scale-110 transition-all"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
                </div>

                {/* Controls */}
            {videoSrc && (
              <div className="space-y-4">
                {/* Playback Controls */}
                <div className="flex items-center justify-center space-x-4">
                  <button 
                    onClick={skipBackward}
                    className="glass-button p-2 rounded-lg hover:scale-110 transition-all"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={togglePlay}
                    className="p-3 bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 hover:from-purple-400/80 hover:to-purple-500/90 rounded-lg transition-all glass-effect-strong hover:shadow-purple-500/50 hover:scale-110"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  
                  <button 
                    onClick={skipForward}
                    className="glass-button p-2 rounded-lg hover:scale-110 transition-all"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <div
                    ref={timelineRef}
                    onMouseDown={handleTimelineMouseDown}
                    onClick={handleTimelineClick}
                    className="relative h-3 bg-gray-700 rounded-full cursor-pointer"
                  >
                    {/* Progress bar */}
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                    
                    {/* Trim operation markers */}
                    {editOperations
                      .filter(op => op.enabled && op.type === 'trim')
                      .map((op, index) => (
                        <div
                          key={index}
                          className="absolute top-0 h-full bg-yellow-500 opacity-50 border border-yellow-400"
                          style={{
                            left: `${(op.params.start / duration) * 100}%`,
                            width: `${((op.params.end - op.params.start) / duration) * 100}%`
                          }}
                        />
                      ))
                    }
                    
                    {/* Current time handle */}
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-purple-500 cursor-pointer shadow-lg"
                      style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Additional Controls */}
                <div className="flex items-center justify-between space-x-4">
                  <div className="flex items-center space-x-6">
                    {/* Volume */}
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={toggleMute}
                        className="video-control-button w-10"
                      >
                        <Volume2 className={`w-8 h-8 ${isMuted ? 'text-red-500' : ''}`} />
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-20 slider"
                      />
                    </div>

                    {/* Speed */}
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm min-w-[44px]">{t('editSection.tools.speed')}:</span>
                      <select
                        value={playbackSpeed}
                        onChange={(e) => changePlaybackSpeed(parseFloat(e.target.value))}
                        className="video-control-select min-w-[80px] text-sm"
                      >
                        <option value={0.25}>0.25x</option>
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    </div>
                  </div>

                  {/* Trim Controls */}
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-gray-400 min-w-[32px]">{t('editSection.controls.trim')}:</span>
                    <input
                      type="number"
                      value={Math.round(trimStart)}
                      onChange={(e) => setTrimStart(Number(e.target.value))}
                      className="video-control-input w-16 text-sm"
                      min="0"
                      max={duration}
                    />
                    <span className="text-gray-400 min-w-[20px] text-center">{t('editSection.controls.to')}</span>
                    <input
                      type="number"
                      value={Math.round(trimEnd)}
                      onChange={(e) => setTrimEnd(Number(e.target.value))}
                      className="video-control-input w-16 text-sm"
                      min="0"
                      max={duration}
                    />
                    <button
                      onClick={addTrimOperation}
                      className="video-control-button hover:scale-105 transition-transform"
                    >
                      {t('editSection.tools.addTrim')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Tools Panel */}
        <div className="space-y-4">
          {/* Panel Tabs */}
          <div className="glass-panel rounded-xl p-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'tools', label: t('editSection.panels.tools'), icon: Scissors },
                { id: 'effects', label: t('editSection.panels.effects'), icon: Filter },
                { id: 'audio', label: t('editSection.panels.audio'), icon: Music },
                { id: 'export', label: t('editSection.panels.export'), icon: Download }
              ].map((panel) => {
                const Icon = panel.icon
                return (
                  <button
                    key={panel.id}
                    onClick={() => setActivePanel(panel.id as any)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activePanel === panel.id
                        ? 'bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 text-white shadow-lg shadow-purple-500/25 scale-105'
                        : 'text-gray-400 hover:text-white glass-button'
                    }`}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-2" />
                    <div>{panel.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel Content */}
          <div className="glass-panel rounded-xl p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activePanel === 'tools' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white mb-4">{t('editSection.tools.title')}</h3>
                    
                    <div className="space-y-3">
                      <button
                        onClick={startVisualCrop}
                        disabled={!videoSrc}
                        className="w-full glass-button flex items-center space-x-2 hover:scale-105 transition-transform rounded-lg"
                      >
                        <Crop className="w-4 h-4" />
                        <span>{t('editSection.tools.visualCrop')}</span>
                      </button>
                    </div>

                    {showCropOverlay && (
                      <div className="space-y-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-300 text-sm">{t('editSection.tools.cropInstructions')}</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={addCropOperation}
                            className="flex-1 glass-button py-1 px-3 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
                          >
                            {t('editSection.tools.apply')}
                          </button>
                          <button
                            onClick={() => setShowCropOverlay(false)}
                            className="flex-1 glass-button py-1 px-3 text-sm hover:scale-105 transition-transform rounded-lg"
                          >
                            {t('editSection.tools.cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => addRotateOperation(90)}
                      disabled={!videoSrc}
                      className="w-full glass-button flex items-center space-x-2 hover:scale-105 transition-transform rounded-lg"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>{t('editSection.tools.rotate90')}</span>
                    </button>

                    <button
                      onClick={() => setShowTextModal(true)}
                      disabled={!videoSrc}
                      className="w-full glass-button flex items-center space-x-2 hover:scale-105 transition-transform rounded-lg"
                    >
                      <Palette className="w-4 h-4" />
                      <span>{t('editSection.tools.addText')}</span>
                    </button>

                    <div className="space-y-3 mt-6">
                      <label className="text-sm text-gray-400 font-medium">{t('editSection.tools.speed')}</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[0.5, 1, 2].map(speed => (
                          <button
                            key={speed}
                            onClick={() => addSpeedOperation(speed)}
                            disabled={!videoSrc}
                            className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'effects' && (
                  <div className="space-y-5">
                    <h3 className="font-semibold text-white mb-4">{t('editSection.effects.title')}</h3>
                    
                    {/* Adjustable Effects */}
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="block text-sm text-gray-300 font-medium">
                          {t('editSection.effects.brightness')}: {effectSettings.brightness.toFixed(1)}
                        </label>
                        <div className="slider-container relative">
                          <div 
                            className="slider-progress" 
                            style={{ width: `${((effectSettings.brightness + 1) / 2) * 100}%` }}
                          ></div>
                          <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.1"
                            value={effectSettings.brightness}
                            onChange={(e) => setEffectSettings(prev => ({ ...prev, brightness: parseFloat(e.target.value) }))}
                            className="w-full slider"
                          />
                        </div>
                        <button
                          onClick={() => addFilterOperation('brightness', effectSettings.brightness)}
                          disabled={!videoSrc}
                          className="w-full glass-button text-sm mt-3 rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.applyBrightness')}
                        </button>
                      </div>                      <div className="space-y-3">
                        <label className="block text-sm text-gray-300 font-medium">
                          {t('editSection.effects.contrast')}: {effectSettings.contrast.toFixed(1)}
                        </label>
                        <div className="slider-container relative">
                          <div 
                            className="slider-progress" 
                            style={{ width: `${(effectSettings.contrast / 3) * 100}%` }}
                          ></div>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            step="0.1"
                            value={effectSettings.contrast}
                            onChange={(e) => setEffectSettings(prev => ({ ...prev, contrast: parseFloat(e.target.value) }))}
                            className="w-full slider"
                          />
                        </div>
                        <button
                          onClick={() => addFilterOperation('contrast', effectSettings.contrast)}
                          disabled={!videoSrc}
                          className="w-full glass-button text-sm mt-3 rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.applyContrast')}
                        </button>
                      </div>                      <div className="space-y-3">
                        <label className="block text-sm text-gray-300 font-medium">
                          {t('editSection.effects.saturation')}: {effectSettings.saturation.toFixed(1)}
                        </label>
                        <div className="slider-container relative">
                          <div 
                            className="slider-progress" 
                            style={{ width: `${(effectSettings.saturation / 3) * 100}%` }}
                          ></div>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            step="0.1"
                            value={effectSettings.saturation}
                            onChange={(e) => setEffectSettings(prev => ({ ...prev, saturation: parseFloat(e.target.value) }))}
                            className="w-full slider"
                          />
                        </div>
                        <button
                          onClick={() => addFilterOperation('saturation', effectSettings.saturation)}
                          disabled={!videoSrc}
                          className="w-full glass-button text-sm mt-3 rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.applySaturation')}
                        </button>
                      </div>                      <div className="space-y-3">
                        <label className="block text-sm text-gray-300 font-medium">
                          {t('editSection.effects.blur')}: {effectSettings.blur.toFixed(1)}px
                        </label>
                        <div className="slider-container relative">
                          <div 
                            className="slider-progress" 
                            style={{ width: `${(effectSettings.blur / 10) * 100}%` }}
                          ></div>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={effectSettings.blur}
                            onChange={(e) => setEffectSettings(prev => ({ ...prev, blur: parseFloat(e.target.value) }))}
                            className="w-full slider"
                          />
                        </div>
                        <button
                          onClick={() => addFilterOperation('blur', effectSettings.blur)}
                          disabled={!videoSrc}
                          className="w-full glass-button text-sm mt-3 rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.applyBlur')}
                        </button>
                      </div>                      <div className="space-y-3">
                        <label className="block text-sm text-gray-300 font-medium">
                          {t('editSection.effects.sharpen')}: {effectSettings.sharpen.toFixed(1)}
                        </label>
                        <div className="slider-container relative">
                          <div 
                            className="slider-progress" 
                            style={{ width: `${(effectSettings.sharpen / 3) * 100}%` }}
                          ></div>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            step="0.1"
                            value={effectSettings.sharpen}
                            onChange={(e) => setEffectSettings(prev => ({ ...prev, sharpen: parseFloat(e.target.value) }))}
                            className="w-full slider"
                          />
                        </div>
                        <button
                          onClick={() => addFilterOperation('sharpen', effectSettings.sharpen)}
                          disabled={!videoSrc}
                          className="w-full glass-button text-sm mt-3 rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.applySharpen')}
                        </button>
                      </div>
                    </div>

                    <hr className="border-gray-600 my-6" />
                    
                    {/* Preset Effects */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-300">{t('editSection.effects.presetEffects')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => addFilterOperation('grayscale')}
                          disabled={!videoSrc}
                          className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.grayscale')}
                        </button>
                        
                        <button
                          onClick={() => addFilterOperation('sepia')}
                          disabled={!videoSrc}
                          className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.sepia')}
                        </button>
                        
                        <button
                          onClick={() => addFilterOperation('vintage')}
                          disabled={!videoSrc}
                          className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.vintage')}
                        </button>
                        
                        <button
                          onClick={() => addFilterOperation('invert')}
                          disabled={!videoSrc}
                          className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                        >
                          {t('editSection.effects.invert')}
                        </button>
                      </div>
                    </div>
                </div>
                )}

                {activePanel === 'audio' && (
                  <div className="space-y-5">
                    <h3 className="font-semibold text-white mb-4">{t('editSection.audio.title')}</h3>
                    
                    <div className="space-y-4">
                      <label className="text-sm text-gray-400 font-medium">{t('editSection.audio.volume')}</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[0.5, 1, 2].map(vol => (
                          <button
                            key={vol}
                            onClick={() => addVolumeOperation(vol)}
                            disabled={!videoSrc}
                            className="glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                          >
                            {vol * 100}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => addVolumeOperation(0)}
                      disabled={!videoSrc}
                      className="w-full glass-button text-sm rounded-lg hover:scale-105 transition-transform"
                    >
                      {t('editSection.audio.muteAudio')}
                    </button>
                  </div>
                )}

                {activePanel === 'export' && (
                  <div className="space-y-5">
                    <h3 className="font-semibold text-white mb-4">{t('editSection.export.title')}</h3>
                    
                    <div className="text-sm text-gray-400 mb-4">
                      {t('editSection.export.operationsReady', { count: editOperations.length })}
                    </div>

                    <div className="space-y-4">
                      <button 
                        onClick={exportVideo}
                        disabled={!videoSrc || editOperations.length === 0 || isProcessing}
                        className="w-full glass-button py-3 flex items-center justify-center space-x-2 bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 hover:from-purple-400/80 hover:to-purple-500/90 hover:shadow-purple-500/25 rounded-lg"
                      >
                        {isProcessing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{isProcessing ? `${Math.round(processingProgress)}%` : t('editSection.export.exportToFile')}</span>
                      </button>

                      <button 
                        onClick={exportToLibrary}
                        disabled={!videoSrc || editOperations.length === 0 || isProcessing}
                        className="w-full glass-button py-3 flex items-center justify-center space-x-2 rounded-lg hover:scale-105 transition-transform"
                      >
                        <FileVideo className="w-4 h-4" />
                        <span>{t('editSection.export.exportToLibrary')}</span>
                      </button>
                    </div>

                    {isProcessing && (
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Operations List */}
          {editOperations.length > 0 && (
            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3">{t('editSection.editQueue.title')}</h3>
              <div 
                className="space-y-3 max-h-64 overflow-y-auto hidden-scrollbar"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  e.preventDefault()
                  const draggedId = e.dataTransfer.getData('text/plain')
                  if (draggedId) {
                    // If dropped in empty space, move to end
                    handleDrop(e, editOperations.length - 1)
                  }
                }}
              >
                {editOperations.map((operation, index) => (
                  <div
                    key={operation.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, operation.id)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 rounded-lg border cursor-move transition-all duration-200 ${
                      operation.enabled 
                        ? 'bg-purple-900/20 border-purple-600/30' 
                        : 'bg-gray-800/50 border-gray-600/30'
                    } ${
                      draggedOperation === operation.id 
                        ? 'opacity-50' 
                        : ''
                    } ${
                      dragOverIndex === index && draggedOperation !== operation.id
                        ? 'border-yellow-400 bg-yellow-900/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-white cursor-grab active:cursor-grabbing">
                          <MoreVertical className="w-4 h-4" />
                        </div>
                        <input
                          type="checkbox"
                          checked={operation.enabled}
                          onChange={() => toggleOperation(operation.id)}
                        />
                        <span className="text-sm font-medium capitalize">
                          {t(`editSection.operationTypes.${operation.type}`)}
                        </span>
                      </div>                      <button
                        onClick={() => removeOperation(operation.id)}
                        className="glass-button p-1 text-red-400 hover:text-red-300 rounded-lg hover:scale-110 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                                         <div className="text-xs text-gray-400 mt-1">
                       {operation.type === 'trim' && (
                         <span>
                           {formatTime(operation.params.start)} - {formatTime(operation.params.end)}
                         </span>
                       )}
                       {operation.type === 'crop' && (
                         <span>
                           {operation.params.width} × {operation.params.height} at ({operation.params.x}, {operation.params.y})
                         </span>
                       )}
                       {operation.type === 'filter' && (
                         <span className="capitalize">
                           {operation.params.filterType} {t('editSection.operationDescriptions.filter')}
                         </span>
                       )}
                       {operation.type === 'volume' && (
                         <span>
                           {t('editSection.operationDescriptions.volume')} {Math.round(operation.params.level * 100)}%
                         </span>
                       )}
                       {operation.type === 'speed' && (
                         <span>
                           {t('editSection.operationDescriptions.speed')} {operation.params.speed}x
                         </span>
                       )}
                       {operation.type === 'rotate' && (
                         <span>
                           {t('editSection.operationDescriptions.rotate')} {operation.params.angle}°
                         </span>
                       )}
                       {operation.type === 'text' && (
                         <span>
                           {t('editSection.operationDescriptions.text')} "{operation.params.text}" {t('editSection.operationDescriptions.at')} ({operation.params.x}, {operation.params.y})
                         </span>
                       )}
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Library Modal */}
        {showLibrary && (
      <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLibrary(false)}
          >
              <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl p-8 w-full max-w-4xl max-h-[80vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{t('editSection.modal.videoLibrary.title')}</h2>
                <button
                  onClick={() => setShowLibrary(false)}
                  className="glass-button p-2 text-gray-400 hover:text-white rounded-lg hover:scale-110 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-80 hidden-scrollbar p-6 -m-4">
                {libraryFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    onClick={() => selectVideoFromLibrary(file)}
                    className="glass-card p-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 m-4"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    layout
                  >
                    <div className="aspect-video glass-effect-subtle rounded-lg mb-3 overflow-hidden border border-white/10 relative">
                      {file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to icon if thumbnail fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center ${file.thumbnail ? 'absolute inset-0' : ''}`}
                        style={{ display: file.thumbnail ? 'none' : 'flex' }}
                      >
                        <FileVideo className="w-8 h-8 text-purple-400" />
                      </div>
                      {/* Video play indicator */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-black/50 backdrop-blur-sm rounded-full p-2">
                          <Play className="w-6 h-6 text-white fill-current" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-medium text-white text-sm mb-1 truncate">{file.name}</h3>
                    <p className="text-gray-400 text-xs">{file.size}</p>
                  </motion.div>
                ))}
              </div>

              {libraryFiles.length === 0 && (
                <div className="glass-effect-subtle rounded-xl p-8 text-center py-12 text-gray-400 border border-white/10">
                  <FileVideo className="w-16 h-16 mx-auto mb-4 opacity-50 text-purple-400" />
                  <p>{t('editSection.modal.videoLibrary.noVideosFound')}</p>
                </div>
              )}
      </motion.div>
          </motion.div>
        )}        {/* Crop Modal */}
        {showCropModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCropModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-white mb-4">{t('editSection.modal.cropSettings.title')}</h3>
              
            <div className="space-y-4">
              <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.cropSettings.xPosition')}</label>
                <input
                  type="number"
                    value={cropSettings.x}
                    onChange={(e) => setCropSettings(prev => ({ ...prev, x: Number(e.target.value) }))}
                    className="w-full input-field"
                />
              </div>
              <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.cropSettings.yPosition')}</label>
                <input
                  type="number"
                    value={cropSettings.y}
                    onChange={(e) => setCropSettings(prev => ({ ...prev, y: Number(e.target.value) }))}
                    className="w-full input-field"
                />
              </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.cropSettings.width')}</label>
                  <input
                    type="number"
                    value={cropSettings.width}
                    onChange={(e) => setCropSettings(prev => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full input-field"
                  />
              </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.cropSettings.height')}</label>
                  <input
                    type="number"
                    value={cropSettings.height}
                    onChange={(e) => setCropSettings(prev => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full input-field"
                  />
            </div>
          </div>              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowCropModal(false)}
                  className="flex-1 glass-button py-2 rounded-lg hover:scale-105 transition-transform"
                >
                  {t('editSection.modal.cropSettings.cancel')}
                </button>
                <button
                  onClick={addCropOperation}
                  className="flex-1 glass-button py-2 bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 hover:from-purple-400/80 hover:to-purple-500/90 text-white rounded-lg hover:scale-105 transition-transform"
                >
                  {t('editSection.modal.cropSettings.applyCrop')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Text Modal */}
        {showTextModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTextModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-white mb-4">{t('editSection.modal.addText.title')}</h3>
              
            <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.text')}</label>
                  <input
                    type="text"
                    value={textSettings.text}
                    onChange={(e) => setTextSettings(prev => ({ ...prev, text: e.target.value }))}
                    placeholder={t('editSection.modal.addText.placeholder')}
                    className="w-full input-field"
                  />
                </div>
                
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.xPosition')}</label>
                  <input
                    type="number"
                      value={textSettings.x}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, x: Number(e.target.value) }))}
                      min="0"
                    max="100"
                      className="w-full input-field"
                  />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.yPosition')}</label>
                  <input
                    type="number"
                      value={textSettings.y}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, y: Number(e.target.value) }))}
                      min="0"
                    max="100"
                      className="w-full input-field"
                  />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.fontSize')}</label>
                    <input
                      type="number"
                      value={textSettings.fontSize}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                      min="8"
                      max="72"
                      className="w-full input-field"
                    />
              </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.color')}</label>
                    <input
                      type="color"
                      value={textSettings.color}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, color: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-gray-600"
                    />
            </div>
          </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.fontFamily')}</label>
                  <select
                    value={textSettings.fontFamily}
                    onChange={(e) => setTextSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                    className="dropdown"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                  </select>
        </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.duration')}</label>
                    <input
                      type="number"
                      value={textSettings.duration}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, duration: Number(e.target.value) }))}
                      min="0.1"
                      step="0.1"
                      className="w-full input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('editSection.modal.addText.startTime')}</label>
                    <input
                      type="number"
                      value={textSettings.startTime}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, startTime: Number(e.target.value) }))}
                      min="0"
                      step="0.1"
                      className="w-full input-field"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowTextModal(false)}
                  className="flex-1 glass-button py-2 rounded-lg hover:scale-105 transition-transform"
                >
                  {t('editSection.modal.addText.cancel')}
                </button>
                <button
                  onClick={addTextOperation}
                  className="flex-1 glass-button py-2 bg-gradient-to-br from-purple-500/80 to-purple-600/90 backdrop-blur-md border border-purple-400/30 hover:from-purple-400/80 hover:to-purple-500/90 text-white rounded-lg hover:scale-105 transition-transform"
                >
                  {t('editSection.modal.addText.addText')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EditSection 