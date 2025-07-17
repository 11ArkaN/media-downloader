import { Notification } from '../components/NotificationToast'

type NotificationListener = (notifications: Notification[]) => void

class NotificationManager {
  private notifications: Notification[] = []
  private listeners: NotificationListener[] = []

  addNotification(notification: Omit<Notification, 'id'>): string {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
    const newNotification: Notification = {
      ...notification,
      id,
    }

    this.notifications = [...this.notifications, newNotification]
    this.notifyListeners()
    return id
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(notification => notification.id !== id)
    this.notifyListeners()
  }

  clearAllNotifications(): void {
    this.notifications = []
    this.notifyListeners()
  }

  getNotifications(): Notification[] {
    return this.notifications
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.notifications))
  }

  showSuccess(title: string, message: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'success',
      title,
      message,
      ...options,
    })
  }

  showError(title: string, message: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'error',
      title,
      message,
      duration: 8000,
      ...options,
    })
  }

  showWarning(title: string, message: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'warning',
      title,
      message,
      duration: 6000,
      ...options,
    })
  }

  showInfo(title: string, message: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'info',
      title,
      message,
      ...options,
    })
  }
}

export const notificationManager = new NotificationManager()