import { useState, useEffect } from 'react'
import { Notification } from '../components/NotificationToast'
import { notificationManager } from '../utils/notificationManager'

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(notificationManager.getNotifications())

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe(setNotifications)
    return unsubscribe
  }, [])

  return {
    notifications,
    addNotification: notificationManager.addNotification.bind(notificationManager),
    dismissNotification: notificationManager.dismissNotification.bind(notificationManager),
    clearAllNotifications: notificationManager.clearAllNotifications.bind(notificationManager),
    showSuccess: notificationManager.showSuccess.bind(notificationManager),
    showError: notificationManager.showError.bind(notificationManager),
    showWarning: notificationManager.showWarning.bind(notificationManager),
    showInfo: notificationManager.showInfo.bind(notificationManager),
  }
}

export default useNotifications