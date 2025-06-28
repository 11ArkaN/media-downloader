import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, Film, Settings, Folder, Loader } from 'lucide-react'
import './App.css'
import { DownloadSection, EditSection, SettingsSection, FileExplorer } from './components'
import TitleBar from './components/TitleBar'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

type ActiveTab = 'download' | 'edit' | 'files' | 'settings'

const getInitialOverlayState = () => {
  const dependencyStatus = localStorage.getItem('dependency-check-status')
  const lastCheckTime = localStorage.getItem('dependency-check-time')

  if (dependencyStatus === 'installed' && lastCheckTime) {
    const timeSinceLastCheck = Date.now() - parseInt(lastCheckTime, 10)
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (timeSinceLastCheck < twentyFourHours) {
      console.log('Cached data is valid, not showing overlay.')
      return false // Don't show overlay
    }
  }

  console.log('Cached data invalid or missing, showing overlay.')
  return true // Show overlay
}

function DependencyInstaller({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <Loader className="w-16 h-16 text-white animate-spin mb-4" />
      <p className="text-white text-xl">{message}</p>
    </div>
  )
}

function App() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ActiveTab>('download')
  const [selectedVideoFile, setSelectedVideoFile] = useState<string>('')
  const [installMessage, setInstallMessage] = useState('Checking dependencies...')
  const [showDependencyOverlay, setShowDependencyOverlay] = useState(getInitialOverlayState)

  useEffect(() => {
    const handleContextmenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextmenu)

    const unlisten = listen<string>('dependency-install-progress', (event) => {
      setInstallMessage(event.payload)
    })

    // If the overlay isn't showing, our cached data was valid, so we don't need to do anything.
    if (!showDependencyOverlay) {
      return
    }

    const checkAndInstall = async () => {
      try {
        setInstallMessage('Checking dependencies...')
        const deps = await invoke<{ ytdlp_installed: boolean, ffmpeg_installed: boolean }>('check_dependencies')
        
        if (deps.ytdlp_installed && deps.ffmpeg_installed) {
          localStorage.setItem('dependency-check-status', 'installed')
          localStorage.setItem('dependency-check-time', Date.now().toString())
        } else {
          setInstallMessage('Installing missing dependencies...')
          await invoke('install_dependencies')
          localStorage.setItem('dependency-check-status', 'installed')
          localStorage.setItem('dependency-check-time', Date.now().toString())
        }
      } catch (error) {
        console.error("Failed to install dependencies:", error)
        setInstallMessage('Error installing dependencies. Please check the logs.')
        localStorage.setItem('dependency-check-status', 'error')
      } finally {
        setShowDependencyOverlay(false)
      }
    }

    checkAndInstall()

    return function cleanup() {
      document.removeEventListener('contextmenu', handleContextmenu)
      unlisten.then(f => f())
    }
  }, [showDependencyOverlay])

  const tabVariants = {
    inactive: { scale: 0.95, opacity: 0.7 },
    active: { scale: 1, opacity: 1 }
  }

  const contentVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  }

  const tabs = [
    { id: 'download' as const, icon: Download, label: t('app.tabs.download'), color: 'from-lilac-500 to-purple-600' },
    { id: 'edit' as const, icon: Film, label: t('app.tabs.edit'), color: 'from-purple-500 to-pink-600' },
    { id: 'files' as const, icon: Folder, label: t('app.tabs.files'), color: 'from-blue-500 to-cyan-600' },
    { id: 'settings' as const, icon: Settings, label: t('app.tabs.settings'), color: 'from-gray-500 to-gray-700' }
  ]

  const handleVideoSelect = (file: any) => {
    setSelectedVideoFile(file.path)
    setActiveTab('edit')
  }

  // We keep all sections mounted and simply toggle visibility so their internal state persists.

  const sections = {
    download: <DownloadSection />,
    edit: <EditSection selectedFile={selectedVideoFile} />,
    files: <FileExplorer onSelectVideo={handleVideoSelect} selectedFile={selectedVideoFile} />,
    settings: <SettingsSection />
  } as const

  return (
    <>
      <TitleBar />
      {showDependencyOverlay && <DependencyInstaller message={installMessage} />}
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-950/20 p-6 pt-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="glass-effect-strong rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-lilac-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-lilac-200 bg-clip-text text-transparent">
                      {t('app.title')}
                    </h1>
                    <p className="text-gray-400 text-sm">{t('app.subtitle')}</p>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm font-medium">{t('app.status')}</span>
                </div>
              </div>
            </div>
          </motion.header>

          {/* Navigation Tabs */}
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="glass-nav rounded-2xl p-2">
              <div className="flex space-x-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <motion.button
                      key={tab.id}
                      variants={tabVariants}
                      animate={activeTab === tab.id ? 'active' : 'inactive'}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                      flex items-center space-x-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300
                      ${activeTab === tab.id
                          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-${tab.id === 'download' ? 'lilac' : tab.id === 'edit' ? 'purple' : tab.id === 'files' ? 'blue' : 'gray'}-500/25 scale-105`
                          : 'text-gray-400 hover:text-white glass-button'
                        }
                    `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.nav>

          {/* Main Content */}
          {Object.entries(sections).map(([key, Component]) => (
            <motion.div
              key={key}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ display: activeTab === key ? 'block' : 'none' }}
            >
              {Component}
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}

export default App
