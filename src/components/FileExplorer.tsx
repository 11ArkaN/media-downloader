import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Folder, File, Eye, Edit, Trash2, MoreVertical, 
  Grid, List, Search, RefreshCw, Play, FileVideo, Music, 
  Image, SortAsc, SortDesc, FolderOpen, ExternalLink, Check
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'

interface MediaFile {
  id: string
  name: string
  type: 'video' | 'audio' | 'image' | 'other'
  size: string
  duration?: string
  thumbnail?: string
  path: string
  dateAdded: string
  sizeBytes: number
  extension: string
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
        <div className="glass-effect rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white truncate mr-4">{fileName}</h3>
            <button
              onClick={onClose}
              className="btn-secondary px-3 py-2 flex items-center space-x-2"
            >
              <span>✕</span>
              <span>{t('file_explorer.video_player_close_button')}</span>
            </button>
          </div>
          
          <video 
            src={videoUrl} 
            controls 
            autoPlay
            className="w-full max-h-[70vh] rounded-lg shadow-2xl"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectVideo }) => {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [files, setFiles] = useState<MediaFile[]>([])
  const [currentDirectory, setCurrentDirectory] = useState<string>('./downloads')
  const [isLoading, setIsLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; file: MediaFile; position: 'down' | 'up' } | null>(null)
  const [videoPlayer, setVideoPlayer] = useState<{ isOpen: boolean; videoUrl: string; fileName: string }>({
    isOpen: false,
    videoUrl: '',
    fileName: ''
  })

  useEffect(() => {
    loadFiles(currentDirectory)
  }, [currentDirectory])

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadFiles = async (directory: string) => {
    setIsLoading(true)
    try {
      const fileList = await invoke('list_files', { directory }) as any[]
      const mediaFiles = fileList.map((file: any, index: number) => {
        const fileType = getFileType(file.name)
        return {
          id: `${index}`,
          name: file.name,
          type: fileType,
          size: formatFileSize(file.size),
          sizeBytes: file.size,
          path: file.path,
          dateAdded: new Date(file.modified * 1000).toLocaleDateString(),
          extension: file.name.split('.').pop()?.toLowerCase() || ''
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

  const getFileType = (filename: string): 'video' | 'audio' | 'image' | 'other' => {
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
    loadFiles(currentDirectory)
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
    if (file.type === 'video' && onSelectVideo) {
      onSelectVideo(file)
    } else {
      alert(t('file_explorer.edit_warning'))
    }
  }

  const deleteFile = async (file: MediaFile) => {
    if (confirm(t('file_explorer.delete_confirmation', { fileName: file.name }))) {
      try {
        await invoke('delete_file', { filePath: file.path })
        await refreshFiles()
      } catch (error) {
        console.error('Error deleting file:', error)
        alert(t('file_explorer.failed_to_delete_file') + error)
      }
    }
  }

  const getFileIcon = (type: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
    
    switch (type) {
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
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date':
          comparison = new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
          break
        case 'size':
          comparison = b.sizeBytes - a.sizeBytes
          break
        case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
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
    const y = e.clientY;
    const position = y > window.innerHeight - menuHeight ? 'up' : 'down';

    setShowContextMenu({ x: e.clientX, y: e.clientY, file, position })
  }

  const showInExplorer = async (file: MediaFile) => {
    try {
      await invoke('show_in_folder', { path: file.path });
    } catch (err) {
      console.error("Failed to show in folder:", err);
    }
  };

  const playVideoInApp = async (file: MediaFile) => {
    setVideoPlayer({
      isOpen: true,
      videoUrl: `https://localhost:1420/stream/${encodeURIComponent(file.path)}`,
      fileName: file.name
    })
  }

  const closeVideoPlayer = () => {
    setVideoPlayer({ isOpen: false, videoUrl: '', fileName: '' })
  }

  const FileCard = ({ file }: { file: MediaFile }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onContextMenu={(e) => handleContextMenu(e, file)}
      className={
        viewMode === 'grid'
          ? `relative group glass-effect rounded-2xl p-4 flex flex-col justify-between cursor-pointer
             border-2 ${selectedFiles.includes(file.id) ? 'border-lilac-500' : 'border-transparent'}
             transition-all duration-200 hover:bg-white/5`
          : `relative group glass-effect rounded-xl p-3 flex items-center space-x-4 cursor-pointer
             border-2 ${selectedFiles.includes(file.id) ? 'border-lilac-500' : 'border-transparent'}
             transition-all duration-200 hover:bg-white/5`
      }
      onClick={() => toggleFileSelection(file.id)}
    >
      <AnimatePresence>
        {selectedFiles.includes(file.id) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-2 right-2 w-5 h-5 bg-lilac-500 rounded-full flex items-center justify-center border-2 border-gray-800"
          >
            <Check className="w-3 h-3 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {viewMode === 'grid' ? (
        <>
          <div className="w-full h-32 bg-gray-900/50 rounded-lg flex items-center justify-center mb-3">
            {getFileIcon(file.type, 'lg')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{file.name}</p>
            <p className="text-sm text-gray-400">{file.size}</p>
          </div>
        </>
      ) : (
        <>
          {getFileIcon(file.type, 'md')}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{file.name}</p>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{file.size}</span>
              <span className="text-gray-600">•</span>
              <span>{file.dateAdded}</span>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(file.type)}`}>
            {file.type}
          </div>
          <button onClick={(e) => handleContextMenu(e, file)} className="p-2 rounded-full hover:bg-white/10">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
        <div className="flex space-x-2">
          <button onClick={(e) => { e.stopPropagation(); previewFile(file); }} className="p-3 bg-white/10 rounded-full hover:bg-white/20">
            <Eye className="w-5 h-5 text-white" />
          </button>
          {file.type === 'video' && onSelectVideo && (
            <button onClick={(e) => { e.stopPropagation(); editFile(file); }} className="p-3 bg-white/10 rounded-full hover:bg-white/20">
              <Edit className="w-5 h-5 text-white" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-3 bg-red-500/20 rounded-full hover:bg-red-500/40">
            <Trash2 className="w-5 h-5 text-red-300" />
          </button>
        </div>
      </div>
    </motion.div>
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
        <div className="flex items-center bg-gray-800/50 rounded-lg p-1">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-lilac-500 text-white' : 'text-gray-400'}`} title={t('file_explorer.view_mode_grid')}>
            <Grid className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-lilac-500 text-white' : 'text-gray-400'}`} title={t('file_explorer.view_mode_list')}>
            <List className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-400">{t('file_explorer.sort_by_label')}:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input-field">
            <option value="name">{t('file_explorer.sort_options.name')}</option>
            <option value="date">{t('file_explorer.sort_options.date')}</option>
            <option value="size">{t('file_explorer.sort_options.size')}</option>
            <option value="type">{t('file_explorer.sort_options.type')}</option>
          </select>
          <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="btn-icon">
            {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-400">{t('file_explorer.filter_by_label')}:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="input-field">
            <option value="all">{t('file_explorer.filter_options.all')}</option>
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
    <AnimatePresence>
      {showContextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="context-menu"
          style={{ 
            left: showContextMenu.x, 
            top: showContextMenu.position === 'down' ? showContextMenu.y : 'auto',
            bottom: showContextMenu.position === 'up' ? window.innerHeight - showContextMenu.y : 'auto',
          }}
        >
          <button onClick={() => { previewFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
            <div className="flex items-center space-x-2 text-gray-400">
              <Eye className="w-4 h-4" />
              <span>{t('file_explorer.file_actions.preview')}</span>
            </div>
          </button>
          <button onClick={() => { playVideoInApp(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
            <div className="flex items-center space-x-2 text-gray-400">
              <Play className="w-4 h-4" />
              <span>{t('file_explorer.file_actions.play_in_app')}</span>
            </div>
          </button>
          <button onClick={() => { showInExplorer(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
            <div className="flex items-center space-x-2 text-gray-400">
              <ExternalLink className="w-4 h-4" />
              <span>{t('file_explorer.file_actions.show_in_folder')}</span>
            </div>
          </button>
          <div className="h-[1px] bg-gray-700 my-1"></div>
          <button onClick={() => { editFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
            <div className="flex items-center space-x-2 text-purple-400">
              <Edit className="w-4 h-4" />
              <span>{t('file_explorer.file_actions.edit')}</span>
            </div>
          </button>
          <button onClick={() => { deleteFile(showContextMenu.file); setShowContextMenu(null); }} className="context-menu-item">
            <div className="flex items-center space-x-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>{t('file_explorer.file_actions.delete')}</span>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
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
          <button onClick={selectDirectory} className="btn-secondary">
            {t('file_explorer.change_directory_button')}
          </button>
          <button onClick={refreshFiles} className="btn-secondary">
            {t('file_explorer.refresh_button')}
          </button>
        </div>
      </div>
      
      {renderToolbar()}
      
      <div className="mt-6">
        {isLoading ? renderLoadingState() : (
          filteredAndSortedFiles.length === 0 ? renderEmptyState() : (
            viewMode === 'grid' ? renderGridView() : renderListView()
          )
        )}
      </div>

      {renderContextMenu()}
      
      <VideoPlayerModal 
        isOpen={videoPlayer.isOpen}
        onClose={closeVideoPlayer}
        videoUrl={videoPlayer.videoUrl}
        fileName={videoPlayer.fileName}
      />
    </div>
  )
}

export default FileExplorer; 