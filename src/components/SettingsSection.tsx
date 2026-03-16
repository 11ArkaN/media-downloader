import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Download, Folder, Monitor, Shield, Zap, Check, X, AlertCircle, RefreshCw, Eye } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'

interface DependencyInfo {
  ytdlp: string
  ffmpeg: string
  ytdlp_installed: boolean
  ffmpeg_installed: boolean
}

interface PersistedAppSettings {
  default_quality: string
  download_path: string
}

const defaultSettings = {
  downloadPath: './downloads',
  maxConcurrentDownloads: 3,
  defaultQuality: 'best',
  theme: 'dark',
  language: '',
  autostart: false,
  notifications: true,
  ytdlpPath: 'auto',
  ffmpegPath: 'auto',
  customArgs: ''
}

const SettingsSection: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState({
    ...defaultSettings,
    language: i18n.language
  })

  const [dependencies, setDependencies] = useState<DependencyInfo | null>(null)
  const [isCheckingDeps, setIsCheckingDeps] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isInstallingDeps, setIsInstallingDeps] = useState(false)
  const [installationLogs, setInstallationLogs] = useState<string>('')
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    loadSettings()
    checkDependencies()
  }, [])

  const getLocalSettings = () => {
    const savedSettings = localStorage.getItem('media-downloader-settings')

    if (!savedSettings) {
      return null
    }

    const parsedSettings = JSON.parse(savedSettings)

    if (parsedSettings.defaultQuality) {
      parsedSettings.defaultQuality = migrateQualityValue(parsedSettings.defaultQuality)
    }

    return parsedSettings
  }

  const loadSettings = async () => {
    try {
      const localSettings = getLocalSettings()
      const persistedSettings = await invoke<PersistedAppSettings>('get_settings')

      const mergedSettings = {
        ...defaultSettings,
        language: i18n.language,
        ...localSettings,
        defaultQuality: localSettings?.defaultQuality ?? migrateQualityValue(persistedSettings.default_quality),
        downloadPath: localSettings?.downloadPath ?? persistedSettings.download_path ?? defaultSettings.downloadPath
      }

      setSettings(mergedSettings)

      // Migrate existing browser-only values into the backend settings file once.
      if (localSettings?.defaultQuality || localSettings?.downloadPath) {
        await invoke('set_settings', {
          settings: {
            default_quality: mergedSettings.defaultQuality,
            download_path: mergedSettings.downloadPath
          }
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  // Migration function to handle old quality values
  const migrateQualityValue = (oldValue: string): string => {
    // Define migration mapping for old values that might not be supported
    const migrationMap: Record<string, string> = {
      'best': 'best',           // Keep as is - maps to 2160p in download logic
      'worst': 'worst',         // Keep as is - maps to 320p in download logic
      '1080p': '1080p',         // Direct mapping
      '720p': '720p',           // Direct mapping
      '480p': '480p',           // Direct mapping
      '360p': '320p',           // Migrate 360p to 320p
      '320p': '320p',           // Direct mapping
      '2160p': '2160p',         // Direct mapping
      '1440p': '1440p',         // Direct mapping
      // Legacy format options that might exist
      'bestvideo+bestaudio': 'best',
      'bestvideo': 'best',
      'bestaudio': 'best',      // Fallback to best for audio-only legacy setting
      'mp4': '1080p',           // Default to 1080p for format-based settings
      'webm': '1080p'           // Default to 1080p for format-based settings
    }

    return migrationMap[oldValue] || '1080p' // Default fallback to 1080p
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      localStorage.setItem('media-downloader-settings', JSON.stringify(settings))
      await invoke('set_settings', {
        settings: {
          default_quality: settings.defaultQuality,
          download_path: settings.downloadPath || defaultSettings.downloadPath
        }
      })
      
      // Show success message
      setTimeout(() => setIsSaving(false), 1000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setIsSaving(false)
    }
  }

  const checkDependencies = async () => {
    setIsCheckingDeps(true)
    try {
      const deps = await invoke('check_dependencies') as DependencyInfo
      setDependencies(deps)
    } catch (error) {
      console.error('Error checking dependencies:', error)
    } finally {
      setIsCheckingDeps(false)
    }
  }

  const selectPath = async (settingKey: string) => {
    try {
      const selected = await open({
        directory: settingKey === 'downloadPath',
        multiple: false,
        title: `Select ${settingKey.replace(/([A-Z])/g, ' $1').toLowerCase()}`
      })
      
      if (selected && typeof selected === 'string') {
        updateSetting(settingKey, selected)
      }
    } catch (error) {
      console.error('Error selecting path:', error)
    }
  }

  const updateSetting = (key: string, value: any) => {
    if (key === 'language') {
      i18n.changeLanguage(value)
    }
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const getDependencyStatus = (version: string, installed: boolean) => {
    if (version === 'Not found' || !installed) {
      return { icon: X, color: 'text-red-400', bg: 'bg-red-500/20' }
    }
    return { icon: Check, color: 'text-green-400', bg: 'bg-green-500/20' }
  }

  const forceInstallDependencies = async () => {
    setIsInstallingDeps(true)
    try {
      // Clear the dependency cache to force a fresh check
      localStorage.removeItem('dependency-check-status')
      localStorage.removeItem('dependency-check-time')
      
      await invoke('install_dependencies')
      await checkDependencies()
    } catch (error) {
      console.error('Error installing dependencies:', error)
    } finally {
      setIsInstallingDeps(false)
    }
  }

  const getInstallationLogs = async () => {
    try {
      const logs = await invoke('get_installation_logs') as string
      setInstallationLogs(logs)
      setShowLogs(true)
    } catch (error) {
      console.error('Error getting installation logs:', error)
      setInstallationLogs(t('download_section.ui.error_getting_logs', { error }))
      setShowLogs(true)
    }
  }

  const settingSections = [
    {
      title: t('settings.sections.download.title'),
      icon: Download,
      color: 'from-blue-500 to-cyan-600',
      settings: [
        {
          key: 'downloadPath',
          label: t('settings.sections.download.download_folder.label'),
          type: 'path',
          description: t('settings.sections.download.download_folder.description')
        },
        {
          key: 'maxConcurrentDownloads',
          label: t('settings.sections.download.concurrent_downloads.label'),
          type: 'number',
          description: t('settings.sections.download.concurrent_downloads.description'),
          min: 1,
          max: 10
        },
        {
          key: 'defaultQuality',
          label: t('settings.sections.download.default_quality.label'),
          type: 'select',
          description: t('settings.sections.download.default_quality.description'),
          options: [
            { value: 'best', label: t('settings.sections.download.default_quality.options.best') },
            { value: 'worst', label: t('settings.sections.download.default_quality.options.worst') },
            { value: '2160p', label: t('settings.sections.download.default_quality.options.2160p') },
            { value: '1440p', label: t('settings.sections.download.default_quality.options.1440p') },
            { value: '1080p', label: t('settings.sections.download.default_quality.options.1080p') },
            { value: '720p', label: t('settings.sections.download.default_quality.options.720p') },
            { value: '480p', label: t('settings.sections.download.default_quality.options.480p') },
            { value: '320p', label: t('settings.sections.download.default_quality.options.320p') }
          ]
        }
      ]
    },
    {
      title: t('settings.sections.application.title'),
      icon: Monitor,
      color: 'from-purple-500 to-pink-600',
      settings: [
        {
          key: 'theme',
          label: t('settings.sections.application.theme.label'),
          type: 'select',
          description: t('settings.sections.application.theme.description'),
          options: [
            { value: 'dark', label: t('settings.sections.application.theme.options.dark') },
            { value: 'light', label: t('settings.sections.application.theme.options.light') },
            { value: 'auto', label: t('settings.sections.application.theme.options.system') }
          ]
        },
        {
          key: 'language',
          label: t('settings.sections.application.language.label'),
          type: 'select',
          description: t('settings.sections.application.language.description'),
          options: [
            { value: 'en', label: t('settings.sections.application.language.options.en') },
            { value: 'pl', label: t('settings.sections.application.language.options.pl') }
          ]
        },
        {
          key: 'autostart',
          label: t('settings.sections.application.start_with_system.label'),
          type: 'toggle',
          description: t('settings.sections.application.start_with_system.description')
        },
        {
          key: 'notifications',
          label: t('settings.sections.application.notifications.label'),
          type: 'toggle',
          description: t('settings.sections.application.notifications.description')
        }
      ]
    },
    {
      title: t('settings.sections.advanced.title'),
      icon: Zap,
      color: 'from-orange-500 to-red-600',
      settings: [
        {
          key: 'ytdlpPath',
          label: t('settings.sections.advanced.ytdlp_path.label'),
          type: 'path',
          description: t('settings.sections.advanced.ytdlp_path.description')
        },
        {
          key: 'ffmpegPath',
          label: t('settings.sections.advanced.ffmpeg_path.label'),
          type: 'path',
          description: t('settings.sections.advanced.ffmpeg_path.description')
        },
        {
          key: 'customArgs',
          label: t('settings.sections.advanced.custom_args.label'),
          type: 'text',
          description: t('settings.sections.advanced.custom_args.description')
        }
      ]
    }
  ]

  const renderSetting = (setting: any) => {
    const value = settings[setting.key as keyof typeof settings]

    switch (setting.type) {
      case 'toggle':
        return (
          <motion.button
            onClick={() => updateSetting(setting.key, !value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
              value 
                ? 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 backdrop-blur-md border border-purple-400/30 shadow-lg shadow-purple-500/25' 
                : 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 hover:border-white/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-all duration-300 ${
                value 
                  ? 'translate-x-6 bg-white shadow-lg shadow-purple-500/30' 
                  : 'translate-x-1 bg-white/90 backdrop-blur-sm'
              }`}
            />
          </motion.button>
        )

      case 'select':
        return (
          <select
            value={String(value)}
            onChange={(e) => updateSetting(setting.key, e.target.value)}
            className="w-full dropdown"
          >
            {setting.options?.map((option: { value: string; label: string }) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'number':
        return (
          <input
            type="number"
            value={value as number}
            onChange={(e) => updateSetting(setting.key, parseInt(e.target.value))}
            min={setting.min}
            max={setting.max}
            className="input-field w-32"
          />
        )

      case 'path':
        return (
          <div className="flex space-x-2">
            <input
              type="text"
              value={value as string}
              onChange={(e) => updateSetting(setting.key, e.target.value)}
              className="input-field flex-1"
              placeholder={setting.key === 'downloadPath' ? t('download_section.ui.choose_folder') : t('download_section.ui.choose_file')}
            />
            <button 
              onClick={() => selectPath(setting.key)}
              className="glass-button px-4 py-3 rounded-lg hover:scale-105 transition-transform"
            >
              <Folder className="w-4 h-4" />
            </button>
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => updateSetting(setting.key, e.target.value)}
            className="input-field"
            placeholder={setting.description}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect rounded-2xl p-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-700 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{t('settings.title')}</h2>
              <p className="text-gray-400 text-sm">{t('settings.description')}</p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={checkDependencies}
              disabled={isCheckingDeps}
              className="glass-button flex items-center space-x-2 px-4 py-2 rounded-lg hover:scale-105 transition-transform"
            >
              <Shield className={`w-4 h-4 ${isCheckingDeps ? 'animate-spin' : ''}`} />
              <span>{isCheckingDeps ? t('settings.dependencies.checking_button') : t('settings.dependencies.check_button')}</span>
            </button>
            
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="btn-primary flex items-center space-x-2 glass-effect-strong hover:shadow-purple-500/25"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('settings.saving_button')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('settings.save_button')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Dependencies Status */}
      {dependencies && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>{t('settings.dependencies.title')}</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-semibold text-white">{t('settings.dependencies.ytdlp_version')}</h4>
                <p className="text-sm text-gray-400">{t('settings.dependencies.ytdlp_description')}</p>
              </div>
              <div className="flex items-center space-x-2">
                {(() => {
                  const status = getDependencyStatus(dependencies.ytdlp, dependencies.ytdlp_installed)
                  const Icon = status.icon
                  return (
                    <>
                      <div className={`p-2 rounded-lg ${status.bg}`}>
                        <Icon className={`w-4 h-4 ${status.color}`} />
                      </div>
                      <span className={`text-sm ${status.color}`}>
                        {dependencies.ytdlp === 'Not found' ? t('settings.dependencies.not_found') : dependencies.ytdlp}
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-semibold text-white">{t('settings.dependencies.ffmpeg_version')}</h4>
                <p className="text-sm text-gray-400">{t('settings.dependencies.ffmpeg_description')}</p>
              </div>
              <div className="flex items-center space-x-2">
                {(() => {
                  const status = getDependencyStatus(dependencies.ffmpeg, dependencies.ffmpeg_installed)
                  const Icon = status.icon
                  return (
                    <>
                      <div className={`p-2 rounded-lg ${status.bg}`}>
                        <Icon className={`w-4 h-4 ${status.color}`} />
                      </div>
                      <span className={`text-sm ${status.color}`}>
                        {dependencies.ffmpeg === 'Not found' ? t('settings.dependencies.not_found') : dependencies.ffmpeg}
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              onClick={forceInstallDependencies}
              disabled={isInstallingDeps}
              className="glass-button flex items-center space-x-2 px-4 py-2 rounded-lg hover:scale-105 transition-transform"
            >
              <RefreshCw className={`w-4 h-4 ${isInstallingDeps ? 'animate-spin' : ''}`} />
              <span>{isInstallingDeps ? t('settings.debug.installing_button') : t('settings.debug.force_install_button')}</span>
            </button>
            
            <button
              onClick={getInstallationLogs}
              className="glass-button flex items-center space-x-2 px-4 py-2 rounded-lg hover:scale-105 transition-transform"
            >
              <Eye className="w-4 h-4" />
              <span>{t('settings.debug.view_logs_button')}</span>
            </button>
          </div>

          {(!dependencies.ytdlp_installed || !dependencies.ffmpeg_installed) && (
            <div className="mt-4 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-300">{t('settings.dependencies.missing_dependencies')}</h4>
                  <p className="text-sm text-orange-200 mt-1">
                    {t('settings.dependencies.missing_dependencies_description')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Debug Logs Modal */}
      {showLogs && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowLogs(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{t('settings.debug.logs_modal_title')}</h3>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <pre className="bg-gray-900 p-4 rounded-lg text-green-400 text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {installationLogs || t('settings.debug.no_logs_available')}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowLogs(false)}
                className="btn-primary"
              >
                {t('settings.debug.logs_modal_close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Settings Sections */}
      {settingSections.map((section, sectionIndex) => {
        const Icon = section.icon
        return (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
            className="glass-effect rounded-2xl p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className={`w-8 h-8 bg-gradient-to-r ${section.color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{section.title}</h3>
            </div>

            <div className="space-y-6">
              {section.settings.map((setting, settingIndex) => (
                <motion.div
                  key={setting.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: settingIndex * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl"
                >
                  <div className="flex-grow">
                    <label className="block text-sm font-medium text-white">{setting.label}</label>
                    <p className="text-xs text-gray-400">{setting.description}</p>
                  </div>
                  
                  <div className="flex-shrink-0">{renderSetting(setting)}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )
      })}

      {/* Debug Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect rounded-2xl p-8"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-700 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">{t('settings.debug.title')}</h3>
        </div>

        <div className="space-y-4">
          <button
            onClick={forceInstallDependencies}
            disabled={isInstallingDeps}
            className="btn-primary flex items-center space-x-2 w-full glass-effect-strong hover:shadow-red-500/25"
          >
            {isInstallingDeps ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{t('settings.debug.force_install_button')}</span>
          </button>

          <button
            onClick={getInstallationLogs}
            className="glass-button flex items-center space-x-2 w-full px-4 py-2 rounded-lg hover:scale-105 transition-transform"
          >
            <Eye className="w-4 h-4" />
            <span>{t('settings.debug.view_logs_button')}</span>
          </button>
        </div>

        {/* Installation Logs Modal */}
        {showLogs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="bg-gray-900 rounded-lg shadow-lg max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">{t('settings.debug.installation_logs')}</h4>
                <button
                  onClick={() => setShowLogs(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <pre className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                {installationLogs}
              </pre>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

export default SettingsSection
