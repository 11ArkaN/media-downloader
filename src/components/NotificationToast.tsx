import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  persistent?: boolean
}

interface NotificationToastProps {
  notification: Notification
  onDismiss: (id: string) => void
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  const { t } = useTranslation()
  const { id, type, title, message, duration = 5000, persistent = false } = notification

  useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, persistent, onDismiss])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return 'border-green-500/50 bg-green-900/20'
      case 'error':
        return 'border-red-500/50 bg-red-900/20'
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-900/20'
      case 'info':
      default:
        return 'border-blue-500/50 bg-blue-900/20'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`glass-card rounded-xl p-4 border ${getColorClasses()} shadow-lg max-w-sm w-full`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">
            {title}
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>
        
        <button
          onClick={() => onDismiss(id)}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded-md hover:bg-gray-700/50"
          aria-label={t('notifications.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {!persistent && duration > 0 && (
        <motion.div
          className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className={`h-full ${
              type === 'success' ? 'bg-green-500' :
              type === 'error' ? 'bg-red-500' :
              type === 'warning' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

interface NotificationContainerProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
  top?: string
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onDismiss, top = '100px' }) => {
  return (
    <div className="fixed right-4 z-50 space-y-3" style={{ top }}>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default NotificationToast