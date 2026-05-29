import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { getChatWebSocketUrls } from '../services/messageApi';
import { registerForPushNotifications, showLocalBuzz } from '../services/pushNotifications';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useProfileUpdateStore } from '../store/profileUpdateStore';

export default function RealtimeBridge() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setProfileCounts = useProfileUpdateStore((state) => state.setProfileCounts);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    registerForPushNotifications(token).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const urls = getChatWebSocketUrls(user.id);

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'notification') {
          const notification = payload.notification;

          if (notification) {
            addNotification({
              id: Number(notification.id),
              message: notification.message || '',
              is_read: Boolean(notification.is_read),
              data: notification.data || {},
            });
          }

          showLocalBuzz(notification?.message || 'You have new buzz').catch(() => {});
        }

        if (payload.type === 'call_request') {
          const callType = payload.call_type === 'video' ? 'Video call' : 'Audio call';
          const caller = payload.sender_username ? `@${payload.sender_username}` : 'Someone';

          Alert.alert(callType, `${caller} is calling you.`, [
            { text: 'Decline', style: 'cancel' },
            { text: 'Accept' },
          ]);
        }

        if (payload.type === 'profile_update' && payload.user_id) {
          setProfileCounts(Number(payload.user_id), {
            ...(payload.counts || {}),
            ...(payload.profile || {}),
          });
        }
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    const connect = (index = 0) => {
      if (!active || index >= urls.length) {
        return;
      }

      const socket = new WebSocket(urls[index]);
      let didOpen = false;
      socketRef.current = socket;

      socket.onopen = () => {
        didOpen = true;
      };

      socket.onmessage = handleMessage;

      socket.onerror = () => {
        if (!didOpen) {
          socket.close();
        }
      };

      socket.onclose = () => {
        if (!active || didOpen || index >= urls.length - 1) {
          return;
        }

        retryTimer = setTimeout(() => connect(index + 1), 300);
      };
    };

    connect();

    return () => {
      active = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [addNotification, setProfileCounts, user?.id]);

  return null;
}
