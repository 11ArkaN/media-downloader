import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, Play, AlertCircle, Check, Loader2, Link, FolderOpen } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'

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
  const [url, setUrl] = useState('')
  const [downloads, setDownloads] = useState<DownloadProgress[]>([])
  const [format, setFormat] = useState('best')
  const [outputPath, setOutputPath] = useState('')

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
    }
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
      await invoke('start_download', {
        request: {
          url: url.trim(),
          format,
          output_path: outputPath || await getDefaultDownloadPath()
        }
      })

      setUrl('')
    } catch (error) {
      console.error('Error starting download:', error)
      // Add error notification here
    }
  }

  const getDefaultDownloadPath = async () => {
    // Try to get default downloads folder or use current directory
    return './downloads'
  }

  const formatOptions = [
    { value: 'best', label: t('download_section.format_options.best') },
    { value: 'worst', label: t('download_section.format_options.worst') },
    { value: 'bestvideo+bestaudio', label: t('download_section.format_options.bestvideo_bestaudio') },
    { value: 'mp4', label: t('download_section.format_options.mp4') },
    { value: 'webm', label: t('download_section.format_options.webm') },
    { value: 'bestaudio', label: t('download_section.format_options.bestaudio') }
  ]

  return (
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
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('download_section.url_placeholder')}
                className="input-field w-full pl-12"
                onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
              />
            </div>
          </div>

          {/* Format and Output Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('download_section.format_label')}
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="input-field w-full"
              >
                {formatOptions.map(option => (
                  <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('download_section.output_folder_label')}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                  placeholder={t('download_section.output_folder_placeholder')}
                  className="input-field flex-1"
                />
                <button
                  onClick={selectOutputPath}
                  className="btn-secondary px-4"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
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
                className="bg-gray-800/50 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      download.status === 'completed' ? 'bg-green-500' :
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
                    className={`h-2 rounded-full ${
                      download.status === 'completed' ? 'bg-green-500' :
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
  )
}

export default DownloadSection 