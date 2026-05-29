import { apiRequest } from './api';
import { resolveProfileImage } from './avatar';

export type BuzzNotification = {
  id: number;
  message: string;
  is_read: boolean;
  data?: {
    type?: string;
    request_id?: number;
    sender_id?: number;
    receiver_id?: number;
    sender_username?: string;
    sender_profile_image?: string | null;
    locked_chat?: boolean;
  };
};

export function getNotifications(token?: string) {
  return apiRequest('/notifications', 'GET', undefined, token).then((data) => {
    const notifications = Array.isArray(data) ? data : data?.notifications || [];

    return {
      unread_count: Number(data?.unread_count || 0),
      notifications: notifications.map((notification: any): BuzzNotification => {
        const data = notification.data || {};
        const senderId = Number(data.sender_id || data.user_id || 0) || undefined;
        const senderUsername = data.sender_username || data.username || null;

        return {
          id: Number(notification.id),
          message: notification.message || '',
          is_read: Boolean(notification.is_read),
          data: {
            ...data,
            sender_id: senderId,
            sender_username: senderUsername || undefined,
            sender_profile_image: data.locked_chat
              ? null
              : resolveProfileImage(data.sender_profile_image, senderId, senderUsername),
          },
        };
      }),
    };
  });
}

export function markNotificationRead(notificationId: number, token?: string) {
  return apiRequest(
    `/notifications/${notificationId}/read`,
    'PUT',
    undefined,
    token
  );
}

export function savePushToken(pushToken: string, token?: string) {
  return apiRequest(
    `/push-token?push_token=${encodeURIComponent(pushToken)}`,
    'POST',
    undefined,
    token
  );
}
