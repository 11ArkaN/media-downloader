import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder, File, Eye, Edit, Trash2, MoreVertical,
  Grid, List, Search, RefreshCw, Play, FileVideo, Music,
  Image, FolderOpen, ExternalLink, Check, Copy
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import Portal from './Portal'

import { useNotifications } from '../hooks/useNotifications'


interface MediaFile {
  id: string
  name: string
  type: 'video' | 'audio' | 'image' | 'other' | 'directory'
  size: string
  duration?: string
  path: string
  dateAdded: string
  sizeBytes: number
  extension: string
  isDirectory?: boolean
}

interface FileExplorerProps {
  onSelectVideo?: (file: MediaFile) => void
  selectedFile?: string
}

interface VideoPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  videoUrl: string
  fileName: string
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onClose, videoUrl, fileName }) => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const clearMediaSession = () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null
        const actions = ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const
        actions.forEach(action => {
          try {
            navigator.mediaSession.setActionHandler(action, null)
          } catch (e) {
            // Ignore errors
          }
        })
      }
    }

    if (isOpen) {
      clearMediaSession()
      video.addEventListener('play', clearMediaSession)
      video.addEventListener('loadedmetadata', clearMediaSession)
      
      // Programmatically play video
      video.play().catch(error => {
        console.error("Autoplay was prevented:", error)
      });
    } else {
      video.pause()
    }

    return () => {
      video.removeEventListener('play', clearMediaSession)
      video.removeEventListener('loadedmetadata', clearMediaSession)
    }
  }, [isOpen, videoUrl])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative max-w-6xl max-h-screen p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-effect-strong rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white truncate mr-4">{fileName}</h3>
            <button
              onClick={onClose}
              className="glass-button px-3 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
            >
              <span>✕</span>
              <span>{t('file_explorer.video_player_close_button')}</span>
            </button>
          </div>

          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-h-[70vh] rounded-lg shadow-2xl"
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            playsInline
            data-no-media-session="true"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

// Simple global thumbnail cache
const thumbnailCache = new Map<string, string>()

const ThumbnailPreview = ({ file, size, generateThumbnail, getFileIcon }: {
  file: MediaFile;
  size: 'sm' | 'md' | 'lg';
  generateThumbnail: (file: MediaFile) => Promise<string | null>;
  getFileIcon: (type: string, size: 'sm' | 'md' | 'lg') => JSX.Element;
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (file.type === 'video' || file.type === 'image') {
      // Check cache first
      const cached = thumbnailCache.get(file.path)
      if (cached) {
        setThumbnailUrl(cached)
        return
      }

      let isMounted = true

      const loadThumbnail = async () => {
        setIsLoading(true)
        setLoadError(false)

        try {
          const url = await generateThumbnail(file)
          if (isMounted && url) {
            setThumbnailUrl(url)
            // Cache for future use
            thumbnailCache.set(file.path, url)
          }
        } catch (error) {
          console.error('Error loading thumbnail:', error)
          if (isMounted) {
            setLoadError(true)
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      }

      loadThumbnail()

      return () => {
        isMounted = false
      }
    }
  }, [file.path, file.type])

  const containerClass = size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-full h-32'
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'

  if (file.type !== 'video' && file.type !== 'image') {
    return (
      <div className={`${containerClass} bg-gray-900/50 rounded-lg flex items-center justify-center`}>
        {getFileIcon(file.type, size)}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`${containerClass} bg-gray-900/50 rounded-lg flex items-center justify-center`}>
        <div className="animate-spin">
          <RefreshCw className={iconSize + ' text-gray-400'} />
        </div>
      </div>
    )
  }

  if (loadError || !thumbnailUrl) {
    return (
      <div className={`${containerClass} bg-gray-900/50 rounded-lg flex items-center justify-center`}>
        {getFileIcon(file.type, size)}
      </div>
    )
  }

  return (
    <div className={`${containerClass} bg-gray-900/50 rounded-lg overflow-hidden relative`}>
      <img
        src={thumbnailUrl}
        alt={file.name}
        className="w-full h-full object-cover"
        onError={() => setLoadError(true)}
      />
      {file.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center z-1">
          <div className="bg-black/50 rounded-full p-1">
            <Play className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  )
}

const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  files: MediaFile[];
  onConfirm: () => void;
  onCancel: () => void;
  generateThumbnail: (file: MediaFile) => Promise<string | null>;
  getFileIcon: (type: string, size: 'sm' | 'md' | 'lg') => JSX.Element;
}> = ({ isOpen, files, onConfirm, onCancel, generateThumbnail, getFileIcon }) => {
  const { t } = useTranslation()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isSingleFile = files.length === 1
  const maxDisplayFiles = 5

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-effect rounded-2xl p-6 border border-red-500/30">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {isSingleFile
                  ? t('file_explorer.confirm_delete_single')
                  : t('file_explorer.confirm_delete_multiple', { count: files.length })
                }
              </h3>
              <p className="text-sm text-gray-400">
                {t('file_explorer.delete_warning_modal')}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-gray-900/50 rounded-lg p-3 max-h-40 overflow-y-auto hidden-scrollbar">
              {files.slice(0, maxDisplayFiles).map((file) => (
                <div key={file.id} className="flex items-center space-x-2 py-1">
                  <ThumbnailPreview
                    file={file}
                    size="sm"
                    generateThumbnail={generateThumbnail}
                    getFileIcon={getFileIcon}
                  />
                  <span className="text-white text-sm truncate">{file.name}</span>
                </div>
              ))}
              {files.length > maxDisplayFiles && (
                <div className="text-gray-400 text-sm py-1">
                  {t('file_explorer.and_more_files', { count: files.length - maxDisplayFiles })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onCancel}
              className="glass-button px-4 py-2 rounded-lg hover:scale-105 transition-transform"
            >
              {t('file_explorer.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="glass-button bg-red-500/20 hover:bg-red-500/40 border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-red-200 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
            >
              {isSingleFile
                ? t('file_explorer.delete_file')
                : t('file_explorer.delete_files', { count: files.length })
              }
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectVideo }) => {
  const { t } = useTranslation()
  const { showSuccess, showError } = useNotifications()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [files, setFiles] = useState<MediaFile[]>([])
  const [currentDirectory, setCurrentDirectory] = useState<string>('./downloads')
  const [directoryHistory, setDirectoryHistory] = useState<string[]>(['./downloads'])
  const [isLoading, setIsLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'dateAdded' | 'name' | 'sizeBytes'>('dateAdded')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio' | 'image' | 'directory'>('all')
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; file: MediaFile; position: 'down' | 'up' } | null>(null)
  const [videoPlayer, setVideoPlayer] = useState<{ isOpen: boolean; videoUrl: string; fileName: string }>({
    isOpen: false,
    videoUrl: '',
    fileName: ''
  })
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    files: MediaFile[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    files: [],
    onConfirm: () => { }
  })

  useEffect(() => {
    // Clear thumbnail cache when directory changes
    thumbnailCache.clear()
    loadFiles(currentDirectory)
  }, [currentDirectory])

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        selectAllFiles()
      } else if (e.key === 'Escape') {
        clearSelection()
      } else if (e.key === 'Delete' && selectedFiles.length > 0) {
        deleteSelectedFiles()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFiles])

  const loadFiles = async (directory: string) => {
    setIsLoading(true)
    try {
      const fileList = await invoke('list_files', { directory }) as any[]
      const mediaFiles = fileList.map((file: any, index: number) => {
        const fileType = file.is_directory ? 'directory' : getFileType(file.name)
        return {
          id: `${index}`,
          name: file.name,
          type: fileType,
          size: file.is_directory ? '' : formatFileSize(file.size),
          sizeBytes: file.size,
          path: file.path,
          dateAdded: new Date(file.modified * 1000).toLocaleDateString(),
          extension: file.is_directory ? '' : (file.name.split('.').pop()?.toLowerCase() || ''),
          isDirectory: file.is_directory
        }
      })
      setFiles(mediaFiles)
    } catch (error) {
      console.error('Error loading files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  const getFileType = (filename: string): 'video' | 'audio' | 'image' | 'other' | 'directory' => {
    const ext = filename.split('.').pop()?.toLowerCase()

    if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext || '')) return 'video'
    if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'].includes(ext || '')) return 'audio'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext || '')) return 'image'
    return 'other'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const selectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('file_explorer.select_directory_title')
      })

      if (selected && typeof selected === 'string') {
        setCurrentDirectory(selected)
      }
    } catch (error) {
      console.error('Error selecting directory:', error)
    }
  }

  const refreshFiles = () => {
    // Clear thumbnail cache when refreshing files
    thumbnailCache.clear()
    loadFiles(currentDirectory)
  }

  const navigateToDirectory = (directoryPath: string) => {
    setCurrentDirectory(directoryPath)
    setDirectoryHistory(prev => [...prev, directoryPath])
  }

  const navigateBack = () => {
    if (directoryHistory.length > 1) {
      const newHistory = [...directoryHistory]
      newHistory.pop()
      const previousDirectory = newHistory[newHistory.length - 1]
      setDirectoryHistory(newHistory)
      setCurrentDirectory(previousDirectory)
    }
  }

  const createNewFolder = async () => {
    const folderName = prompt(t('file_explorer.create_folder_prompt'))
    if (folderName && folderName.trim()) {
      try {
        // Use proper path joining - let the backend handle path separators
        const newFolderPath = currentDirectory.endsWith('/') || currentDirectory.endsWith('\\')
          ? `${currentDirectory}${folderName.trim()}`
          : `${currentDirectory}/${folderName.trim()}`
        await invoke('create_directory', { directoryPath: newFolderPath })
        await refreshFiles()
      } catch (error) {
        console.error('Error creating folder:', error)
        alert(t('file_explorer.failed_to_create_folder') + error)
      }
    }
  }

  const previewFile = async (file: MediaFile) => {
    try {
      await invoke('open_file', { filePath: file.path })
    } catch (error) {
      console.error('Error previewing file:', error)
      alert(t('file_explorer.failed_to_open_file') + error)
    }
  }

  const editFile = (file: MediaFile) => {
    if (file.type === 'directory') {
      navigateToDirectory(file.path)
    } else if (file.type === 'video' && onSelectVideo) {
      onSelectVideo(file)
    } else {
      alert(t('file_explorer.edit_warning'))
    }
  }

  const deleteFile = async (file: MediaFile) => {
    setDeleteConfirmation({
      isOpen: true,
      files: [file],
      onConfirm: async () => {
        try {
          if (file.type === 'directory') {
            await invoke('delete_directory', { directoryPath: file.path })
          } else {
            await invoke('delete_file', { filePath: file.path })
          }
          await refreshFiles()
          setDeleteConfirmation({ isOpen: false, files: [], onConfirm: () => { } })
        } catch (error) {
          console.error('Error deleting item:', error)
          alert(t('file_explorer.failed_to_delete_file') + error)
        }
      }
    })
  }

  const getFileIcon = (type: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'

    switch (type) {
      case 'directory':
        return <Folder className={`${iconSize} text-yellow-400`} />
      case 'video':
        return <FileVideo className={`${iconSize} text-purple-400`} />
      case 'audio':
        return <Music className={`${iconSize} text-green-400`} />
      case 'image':
        return <Image className={`${iconSize} text-blue-400`} />
      default:
        return <File className={`${iconSize} text-gray-400`} />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'directory': return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30'
      case 'video': return 'bg-purple-600/20 text-purple-300 border-purple-500/30'
      case 'audio': return 'bg-green-600/20 text-green-300 border-green-500/30'
      case 'image': return 'bg-blue-600/20 text-blue-300 border-blue-500/30'
      default: return 'bg-gray-600/20 text-gray-300 border-gray-500/30'
    }
  }

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = filterType === 'all' || file.type === filterType
      return matchesSearch && matchesFilter
    })

    return filtered.sort((a, b) => {
      // Always sort directories first
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1

      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'dateAdded':
          comparison = new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
          break
        case 'sizeBytes':
          comparison = b.sizeBytes - a.sizeBytes
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [files, searchTerm, sortBy, sortOrder, filterType])

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    )
  }

  const handleContextMenu = (e: React.MouseEvent, file: MediaFile) => {
    e.preventDefault()
    e.stopPropagation()

    const menuHeight = 220;
    const menuWidth = 200;

    // Get viewport coordinates
    const x = Math.min(e.clientX, window.innerWidth - menuWidth);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight);

    const position = y > window.innerHeight - menuHeight ? 'up' : 'down';

    setShowContextMenu({ x, y, file, position })
  }

  const showInExplorer = async (file: MediaFile) => {
    try {
      await invoke('show_in_explorer', { filePath: file.path });
    } catch (err) {
      console.error("Failed to show in folder:", err);
    }
  };

  const playVideoInApp = async (file: MediaFile) => {
    try {
      const url = await invoke('get_video_url', { filePath: file.path });
      setVideoPlayer({
        isOpen: true,
        videoUrl: url as string,
        fileName: file.name
      });
    } catch (error) {
      console.error('Error getting video URL:', error);
      alert(t('file_explorer.failed_to_start_video_player'));
    }
  }

  const closeVideoPlayer = () => {
    setVideoPlayer({ isOpen: false, videoUrl: '', fileName: '' })
  }

  const cancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, files: [], onConfirm: () => { } })
  }

  const generateThumbnail = async (file: MediaFile): Promise<string | null> => {
    if (file.type !== 'video' && file.type !== 'image') return null

    // Check cache first
    const cached = thumbnailCache.get(file.path)
    if (cached) {
      return cached
    }

    try {
      // Use the new thumbnail data command that returns base64 data URLs
      const thumbnailDataUrl = await invoke('generate_thumbnail_data', {
        filePath: file.path
      }) as string

      // Cache the result
      thumbnailCache.set(file.path, thumbnailDataUrl)
      return thumbnailDataUrl
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      return null
    }
  }

  const selectAllFiles = () => {
    setSelectedFiles(filteredAndSortedFiles.map(file => file.id))
  }

  const clearSelection = () => {
    setSelectedFiles([])
  }

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return

    const selectedFileObjects = selectedFiles.map(id => files.find(f => f.id === id)).filter(Boolean) as MediaFile[]

    setDeleteConfirmation({
      isOpen: true,
      files: selectedFileObjects,
      onConfirm: async () => {
        try {
          for (const file of selectedFileObjects) {
            await invoke('delete_file', { filePath: file.path })
          }
          setSelectedFiles([])
          await refreshFiles()
          setDeleteConfirmation({ isOpen: false, files: [], onConfirm: () => { } })
        } catch (error) {
          console.error('Error deleting files:', error)
          alert(t('file_explorer.failed_to_delete_files') + error)
        }
      }
    })
  }

  const playSelectedVideos = async () => {
    const selectedVideoFiles = selectedFiles
      .map(id => files.find(f => f.id === id))
      .filter(file => file && file.type === 'video')

    if (selectedVideoFiles.length === 0) {
      alert(t('file_explorer.no_videos_selected'))
      return
    }

    // Play the first video
    if (selectedVideoFiles[0]) {
      await playVideoInApp(selectedVideoFiles[0])
    }
  }

  const showSelectedInExplorer = async () => {
    const selectedFileObjects = selectedFiles
      .map(id => files.find(f => f.id === id))
      .filter(Boolean)

    if (selectedFileObjects.length === 0) return

    try {
      // Show the first file's folder (they should all be in the same directory)
      await invoke('show_in_explorer', { filePath: selectedFileObjects[0]!.path })
    } catch (err) {
      console.error("Failed to show in folder:", err)
    }
  }

  const copyFileToClipboard = async (file: MediaFile) => {
    try {
      await invoke('copy_file_to_clipboard', { filePath: file.path })
      showSuccess(t('file_explorer.copy_success'), `${file.name}`)
    } catch (error) {
      console.error('Error copying file to clipboard:', error)
      showError(t('file_explorer.copy_failed'), `${file.name}`)
    }
  }

  const renderSelectionToolbar = () => {
    if (selectedFiles.length === 0) return null

    const selectedVideoCount = selectedFiles
      .map(id => files.find(f => f.id === id))
      .filter(file => file && file.type === 'video').length

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="glass-effect rounded-xl p-4 mb-6 border border-lilac-500/30"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-lilac-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold">
                {t('file_explorer.selection_count', { count: selectedFiles.length })}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={selectAllFiles}
                className="glass-button text-sm px-3 py-1 rounded-lg hover:scale-105 transition-transform"
              >
                {t('file_explorer.select_all')}
              </button>
              <button
                onClick={clearSelection}
                className="glass-button text-sm px-3 py-1 rounded-lg hover:scale-105 transition-transform"
              >
                {t('file_explorer.clear_selection')}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {selectedVideoCount > 0 && (
              <button
                onClick={playSelectedVideos}
                className="glass-button text-sm px-3 py-1 rounded-lg flex items-center space-x-2 text-purple-400 hover:text-purple-300 hover:scale-105 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>{t('file_explorer.play_selected_videos', { count: selectedVideoCount })}</span>
              </button>
            )}
            <button
              onClick={showSelectedInExplorer}
              className="glass-button text-sm px-3 py-1 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t('file_explorer.show_in_folder')}</span>
            </button>
            <button
              onClick={deleteSelectedFiles}
              className="glass-button text-sm px-3 py-1 rounded-lg flex items-center space-x-2 text-red-400 hover:text-red-300 hover:scale-105 transition-all border-red-500/30 hover:border-red-400/50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('file_explorer.delete_selected')}</span>
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const FileCard = ({ file }: { file: MediaFile }) => (
    <div
      onContextMenu={(e) => handleContextMenu(e, file)}
      className={
        viewMode === 'grid'
          ? `relative group glass-card rounded-2xl p-4 flex flex-col justify-between cursor-pointer
             border-2 ${selectedFiles.includes(file.id) ? 'border-lilac-500 shadow-lg shadow-lilac-500/25' : 'border-transparent'}
             hover:scale-[1.02] transition-all duration-200`
          : `relative group glass-card rounded-xl p-3 flex items-center space-x-4 cursor-pointer
             border-2 ${selectedFiles.includes(file.id) ? 'border-lilac-500 shadow-lg shadow-lilac-500/25' : 'border-transparent'}
             hover:scale-[1.01] transition-all duration-200`
      }
      onClick={() => toggleFileSelection(file.id)}
      onDoubleClick={() => {
        if (file.type === 'directory') {
          navigateToDirectory(file.path)
        } else {
          editFile(file)
        }
      }}
    >
      <AnimatePresence>
        {selectedFiles.includes(file.id) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-2 right-2 w-5 h-5 bg-lilac-500 rounded-full flex items-center justify-center border-2 border-gray-800 z-20"
          >
            <Check className="w-3 h-3 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {viewMode === 'grid' ? (
        <>
          <ThumbnailPreview
            file={file}
            size="lg"
            generateThumbnail={generateThumbnail}
            getFileIcon={getFileIcon}
          />
          <div className="flex-1 min-w-0 mt-3">
            <p className="text-white font-semibold truncate">{file.name}</p>
            <p className="text-sm text-gray-400">{file.size}</p>
          </div>
        </>
      ) : (
        <>
          <ThumbnailPreview
            file={file}
            size="md"
            generateThumbnail={generateThumbnail}
            getFileIcon={getFileIcon}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{file.name}</p>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{file.size}</span>
              <span className="text-gray-600">•</span>
              <span>{file.dateAdded}</span>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(file.type)}`}>
            {file.type === 'directory' ? 'folder' : file.type}
          </div>
          <button onClick={(e) => handleContextMenu(e, file)} className="glass-button p-2 rounded-full hover:scale-110 transition-transform">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center z-10">
        <div className="flex space-x-2">
          {file.type === 'directory' ? (
            <button onClick={(e) => { e.stopPropagation(); navigateToDirectory(file.path); }} className="glass-button p-3 rounded-full hover:scale-110 transition-transform border-yellow-500/30" title={t('file_explorer.file_actions.open_folder')}>
              <FolderOpen className="w-5 h-5 text-yellow-300" />
            </button>
          ) : file.type === 'video' ? (
            <button onClick={(e) => { e.stopPropagation(); playVideoInApp(file); }} className="glass-button p-3 rounded-full hover:scale-110 transition-transform border-purple-500/30" title={t('file_explorer.file_actions.play_in_app')}>
              <Play className="w-5 h-5 text-purple-300" />
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); previewFile(file); }} className="glass-button p-3 rounded-full hover:scale-110 transition-transform" title={t('file_explorer.file_actions.preview')}>
              <Eye className="w-5 h-5 text-white" />
            </button>
          )}
          {file.type === 'video' && onSelectVideo && (
            <button onClick={(e) => { e.stopPropagation(); editFile(file); }} className="glass-button p-3 rounded-full hover:scale-110 transition-transform" title={t('file_explorer.file_actions.edit')}>
              <Edit className="w-5 h-5 text-white" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="glass-button p-3 rounded-full hover:scale-110 transition-transform border-red-500/30" title={file.type === 'directory' ? t('file_explorer.file_actions.delete_folder') : t('file_explorer.file_actions.delete')}>
            <Trash2 className="w-5 h-5 text-red-300" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderToolbar = () => (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 my-6">
      <div className="flex-1 flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('file_explorer.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pl-12"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center glass-effect-subtle rounded-lg p-1">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-lilac-500 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10'}`} title={t('file_explorer.view_mode_grid')}>
            <Grid className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-lilac-500 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10'}`} title={t('file_explorer.view_mode_list')}>
            <List className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-400">{t('file_explorer.sort_by_label')}:</label>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-40 dropdown"
            >
              <option value="dateAdded">{t('file_explorer.sort_options.date')}</option>
              <option value="name">{t('file_explorer.sort_options.name')}</option>
              <option value="sizeBytes">{t('file_explorer.sort_options.size')}</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-32 dropdown"
            >
              <option value="desc">{t('file_explorer.sort_order.desc')}</option>
              <option value="asc">{t('file_explorer.sort_order.asc')}</option>
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-400">{t('file_explorer.filter_by_label')}:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="dropdown">
            <option value="all">{t('file_explorer.filter_options.all')}</option>
            <option value="directory">{t('file_explorer.filter_options.folders')}</option>
            <option value="video">{t('file_explorer.filter_options.video')}</option>
            <option value="audio">{t('file_explorer.filter_options.audio')}</option>
            <option value="image">{t('file_explorer.filter_options.image')}</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-20">
      <FolderOpen className="mx-auto w-24 h-24 text-gray-600" />
      <h3 className="mt-4 text-xl font-semibold text-white">{t('file_explorer.no_files_found')}</h3>
    </div>
  );

  const renderLoadingState = () => (
    <div className="text-center py-20">
      <RefreshCw className="mx-auto w-24 h-24 text-gray-600 animate-spin" />
      <h3 className="mt-4 text-xl font-semibold text-white">{t('file_explorer.loading_files')}</h3>
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <AnimatePresence>
        {filteredAndSortedFiles.map((file) => (
          <FileCard key={file.id} file={file} />
        ))}
      </AnimatePresence>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      <AnimatePresence>
        {filteredAndSortedFiles.map((file) => (
          <FileCard key={file.id} file={file} />
        ))}
      </AnimatePresence>
    </div>
  );

  const renderContextMenu = () => (
    <Portal>
      <AnimatePresence>
        {showContextMenu && (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: showContextMenu.x,
              top: showContextMenu.y,
              zIndex: 9999
            }}
          >
            {showContextMenu.file.type === 'directory' ? (
              <button onClick={() => { navigateToDirectory(showContextMenu.file.path); setShowContextMenu(null); }} className="context-menu-item">
                <div className="flex items-center space-x-2 text-yellow-400">
                  <FolderOpen className="w-4 h-4" />
                  <span>{t('file_explorer.file_actions.open_folder')}</span>
                </div>
              </button>
            ) : showContextMenu.file.type === 'video' ? (
              <button onClick={() => { playVideoInApp(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
                <div className="flex items-center space-x-2 text-purple-400">
                  <Play className="w-4 h-4" />
                  <span>{t('file_explorer.file_actions.play_in_app')}</span>
                </div>
              </button>
            ) : (
              <button onClick={() => { previewFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Eye className="w-4 h-4" />
                  <span>{t('file_explorer.file_actions.preview')}</span>
                </div>
              </button>
            )}
            <button onClick={() => { previewFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
              <div className="flex items-center space-x-2 text-gray-400">
                <ExternalLink className="w-4 h-4" />
                <span>{t('file_explorer.file_actions.open_external')}</span>
              </div>
            </button>
            <button onClick={() => { showInExplorer(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
              <div className="flex items-center space-x-2 text-gray-400">
                <Folder className="w-4 h-4" />
                <span>{t('file_explorer.file_actions.show_in_folder')}</span>
              </div>
            </button>
            {showContextMenu.file.type !== 'directory' && (
              <button onClick={() => { copyFileToClipboard(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Copy className="w-4 h-4" />
                  <span>{t('file_explorer.file_actions.copy_to_clipboard')}</span>
                </div>
              </button>
            )}
            <div className="h-[1px] bg-gray-700 my-1"></div>
            {showContextMenu.file.type === 'video' && onSelectVideo && (
              <button onClick={() => { editFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
                <div className="flex items-center space-x-2 text-purple-400">
                  <Edit className="w-4 h-4" />
                  <span>{t('file_explorer.file_actions.edit')}</span>
                </div>
              </button>
            )}
            <button onClick={() => { deleteFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
              <div className="flex items-center space-x-2 text-red-400">
                <Trash2 className="w-4 h-4" />
                <span>{showContextMenu.file.type === 'directory'
                  ? t('file_explorer.file_actions.delete_folder')
                  : t('file_explorer.file_actions.delete')}
                </span>
              </div>
            </button>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  )

  return (
    <div className="glass-effect rounded-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <Folder className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{t('file_explorer.current_directory')}</h2>
            <p className="text-sm text-gray-400 truncate max-w-md">{currentDirectory}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={navigateBack}
            disabled={directoryHistory.length <= 1}
            className={`glass-button px-4 py-2 rounded-lg hover:scale-105 transition-transform ${directoryHistory.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t('file_explorer.back_button')}
          </button>
          <button onClick={createNewFolder} className="glass-button px-4 py-2 rounded-lg hover:scale-105 transition-transform">
            {t('file_explorer.create_folder_button')}
          </button>
          <button onClick={selectDirectory} className="glass-button px-4 py-2 rounded-lg hover:scale-105 transition-transform">
            {t('file_explorer.change_directory_button')}
          </button>
          <button onClick={refreshFiles} className="glass-button px-4 py-2 rounded-lg hover:scale-105 transition-transform">
            {t('file_explorer.refresh_button')}
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2 text-sm">
          <Folder className="w-4 h-4 text-gray-400" />
          {directoryHistory.map((dir, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-gray-500">/</span>}
              <button
                onClick={() => {
                  const newHistory = directoryHistory.slice(0, index + 1)
                  setDirectoryHistory(newHistory)
                  setCurrentDirectory(dir)
                }}
                className={`text-gray-300 hover:text-white transition-colors ${index === directoryHistory.length - 1 ? 'font-semibold text-white' : 'hover:underline'
                  }`}
              >
                {dir === './downloads' ? 'Downloads' : dir.split('/').pop() || dir}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {renderSelectionToolbar()}
      </AnimatePresence>

      {renderToolbar()}

      <div className="mt-6">
        {isLoading ? renderLoadingState() : (
          filteredAndSortedFiles.length === 0 ? renderEmptyState() : (
            viewMode === 'grid' ? renderGridView() : renderListView()
          )
        )}
      </div>

      {renderContextMenu()}

      <Portal>
        <VideoPlayerModal
          isOpen={videoPlayer.isOpen}
          onClose={closeVideoPlayer}
          videoUrl={videoPlayer.videoUrl}
          fileName={videoPlayer.fileName}
        />
      </Portal>

      <Portal>
        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          files={deleteConfirmation.files}
          onConfirm={deleteConfirmation.onConfirm}
          onCancel={cancelDelete}
          generateThumbnail={generateThumbnail}
          getFileIcon={getFileIcon}
        />
      </Portal>


    </div>
  )
}

export default FileExplorer;