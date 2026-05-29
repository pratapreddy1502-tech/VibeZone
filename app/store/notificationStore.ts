import { create } from 'zustand';

import { BuzzNotification } from '../services/notificationApi';

type NotificationState = {
  notifications: BuzzNotification[];
  unreadCount: number;
  setNotifications: (notifications: BuzzNotification[], unreadCount?: number) => void;
  addNotification: (notification: BuzzNotification) => void;
  markRead: (notificationId: number) => void;
  restoreUnread: (notificationId: number) => void;
  clearNotifications: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications, unreadCount) =>
    set({
      notifications,
      unreadCount:
        unreadCount ??
        notifications.filter((notification) => !notification.is_read).length,
    }),

  addNotification: (notification) =>
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) {
        return state;
      }

      return {
        notifications: [notification, ...state.notifications],
        unreadCount: notification.is_read
          ? state.unreadCount
          : state.unreadCount + 1,
      };
    }),

  markRead: (notificationId) =>
    set((state) => {
      const notification = state.notifications.find((item) => item.id === notificationId);
      const shouldDecrement = notification && !notification.is_read;

      return {
        notifications: state.notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        ),
        unreadCount: shouldDecrement
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    }),

  restoreUnread: (notificationId) =>
    set((state) => {
      const notification = state.notifications.find((item) => item.id === notificationId);

      if (!notification || !notification.is_read) {
        return state;
      }

      return {
        notifications: state.notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: false } : item
        ),
        unreadCount: state.unreadCount + 1,
      };
    }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));
