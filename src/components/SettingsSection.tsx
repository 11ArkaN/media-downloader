import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Download, Folder, Monitor, Shield, Zap, Check, X, AlertCircle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'

interface DependencyInfo {
  ytdlp: string
  ffmpeg: string
}

const SettingsSection: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState({
    // Download Settings
    downloadPath: './downloads',
    maxConcurrentDownloads: 3,
    defaultQuality: 'best',
    
    // App Settings
    theme: 'dark',
    language: i18n.language,
    autostart: false,
    notifications: true,
    
    // Advanced Settings
    ytdlpPath: 'auto',
    ffmpegPath: 'auto',
    customArgs: ''
  })

  const [dependencies, setDependencies] = useState<DependencyInfo | null>(null)
  const [isCheckingDeps, setIsCheckingDeps] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    checkDependencies()
  }, [])

  const loadSettings = async () => {
    try {
      // In a real app, this would load from a config file or database
      const savedSettings = localStorage.getItem('media-downloader-settings')
      if (savedSettings) {
        setSettings({ ...settings, ...JSON.parse(savedSettings) })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      // In a real app, this would save to a config file
      localStorage.setItem('media-downloader-settings', JSON.stringify(settings))
      
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
        directory: settingKey.includes('Path') && !settingKey.includes('download'),
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

  const getDependencyStatus = (version: string) => {
    if (version === 'Not found') {
      return { icon: X, color: 'text-red-400', bg: 'bg-red-500/20' }
    }
    return { icon: Check, color: 'text-green-400', bg: 'bg-green-500/20' }
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
            { value: '1080p', label: '1080p' },
            { value: '720p', label: '720p' },
            { value: '480p', label: '480p' }
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-lilac-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
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
              placeholder={setting.key === 'downloadPath' ? 'Choose folder...' : 'Choose file...'}
            />
            <button 
              onClick={() => selectPath(setting.key)}
              className="btn-secondary px-4"
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
              className="btn-secondary flex items-center space-x-2"
            >
              <Shield className={`w-4 h-4 ${isCheckingDeps ? 'animate-spin' : ''}`} />
              <span>{isCheckingDeps ? t('settings.dependencies.checking_button') : t('settings.dependencies.check_button')}</span>
            </button>
            
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="btn-primary flex items-center space-x-2"
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
                  const status = getDependencyStatus(dependencies.ytdlp)
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
                  const status = getDependencyStatus(dependencies.ffmpeg)
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

          {(dependencies.ytdlp === 'Not found' || dependencies.ffmpeg === 'Not found') && (
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
    </div>
  )
}

export default SettingsSection