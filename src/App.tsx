import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Film, Settings, Folder } from 'lucide-react'
import './App.css'
import { DownloadSection, EditSection, SettingsSection, FileExplorer } from './components'
import TitleBar from './components/TitleBar'
import { useTranslation } from 'react-i18next'

type ActiveTab = 'download' | 'edit' | 'files' | 'settings'

function App() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ActiveTab>('download')
  const [selectedVideoFile, setSelectedVideoFile] = useState<string>('')

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
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-950/20 p-6 pt-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="glass-effect rounded-2xl p-6">
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
            <div className="glass-effect rounded-2xl p-2">
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
                          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-${tab.id === 'download' ? 'lilac' : tab.id === 'edit' ? 'purple' : tab.id === 'files' ? 'blue' : 'gray'}-500/25`
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
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
