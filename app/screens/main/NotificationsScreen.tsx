import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, CheckCircle2, Heart, MessageCircle, UserPlus } from 'lucide-react-native';

import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import {
  BuzzNotification,
  getNotifications,
  markNotificationRead,
} from '../../services/notificationApi';
import { acceptConnection, rejectConnection } from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useProfileUpdateStore } from '../../store/profileUpdateStore';

export default function NotificationsScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const notifications = useNotificationStore((state) => state.notifications);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const markStoreRead = useNotificationStore((state) => state.markRead);
  const restoreUnread = useNotificationStore((state) => state.restoreUnread);
  const setProfileCounts = useProfileUpdateStore((state) => state.setProfileCounts);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [handlingRequestId, setHandlingRequestId] = useState<number | null>(null);

  const loadBuzz = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await getNotifications(token || undefined);
      setNotifications(data.notifications, data.unread_count);
    } catch {
      setNotifications([], 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setNotifications, token]);

  useFocusEffect(
    useCallback(() => {
      loadBuzz();
    }, [loadBuzz])
  );

  const filtered = notifications.filter((notification) => {
    if (activeFilter === 'All') {
      return true;
    }

    const message = notification.message.toLowerCase();

    if (activeFilter === 'Resonates') {
      return message.includes('resonated') || message.includes('liked');
    }

    if (activeFilter === 'Responses') {
      return message.includes('commented') || message.includes('response');
    }

    return message.includes('became your viber') || message.includes('vibed');
  });

  const markRead = async (notification: BuzzNotification) => {
    if (notification.is_read || !token) {
      return;
    }

    markStoreRead(notification.id);

    try {
      await markNotificationRead(notification.id, token);
    } catch {
      restoreUnread(notification.id);
    }
  };

  const handleConnectionAction = async (
    notification: BuzzNotification,
    action: 'accept' | 'reject'
  ) => {
    const requestId = notification.data?.request_id;

    if (!requestId || !token) {
      return;
    }

    setHandlingRequestId(requestId);

    try {
      let result: any = null;

      if (action === 'accept') {
        result = await acceptConnection(requestId, token);
        if (result?.current_user_profile?.id) {
          setProfileCounts(result.current_user_profile.id, result.current_user_profile);
        }
        if (result?.sender_profile?.id) {
          setProfileCounts(result.sender_profile.id, result.sender_profile);
        }
      } else {
        result = await rejectConnection(requestId, token);
        if (result?.receiver_profile?.id) {
          setProfileCounts(result.receiver_profile.id, result.receiver_profile);
        }
      }

      await markRead(notification);
      await loadBuzz(true);
    } catch {
      Alert.alert(
        'Connection',
        action === 'accept'
          ? 'Could not accept this connection request.'
          : 'Could not reject this connection request.'
      );
    } finally {
      setHandlingRequestId(null);
    }
  };
  const openSenderProfile = (notification: BuzzNotification) => {
    const senderId = Number(notification.data?.sender_id || 0);

    if (senderId) {
      markRead(notification);
      navigation.navigate('Profile', { userId: senderId });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={palette.ink} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Buzz</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.chips}>
        {['All', 'Resonates', 'Responses', 'Vibers'].map((chip) => (
          <TouchableOpacity
            key={chip}
            style={[styles.chip, activeFilter === chip && styles.activeChip]}
            onPress={() => setActiveFilter(chip)}
          >
            <Text style={[styles.chipText, activeFilter === chip && styles.activeChipText]}>
              {chip}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.violet} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadBuzz(true)} />
          }
        >
          {filtered.length ? (
            filtered.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.item, !notification.is_read && styles.unreadItem]}
                activeOpacity={0.78}
                onPress={() => markRead(notification)}
              >
                <TouchableOpacity
                  style={styles.iconWrap}
                  activeOpacity={0.82}
                  onPress={() => openSenderProfile(notification)}
                >
                  <Image
                    source={{
                      uri: notification.data?.locked_chat
                        ? resolveProfileImage(null, null, 'Locked Chat')
                        : resolveProfileImage(
                            notification.data?.sender_profile_image,
                            notification.data?.sender_id,
                            notification.data?.sender_username
                          ),
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.iconBadge}>{notificationIcon(notification.message)}</View>
                </TouchableOpacity>
                <View style={styles.copy}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => openSenderProfile(notification)}
                  >
                    <Text style={styles.message}>{notification.message}</Text>
                    <Text style={styles.time}>{notification.is_read ? 'Seen' : 'New'}</Text>
                  </TouchableOpacity>
                  {notification.data?.type === 'connection_request' && !notification.is_read ? (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        disabled={handlingRequestId === notification.data.request_id}
                        onPress={() => handleConnectionAction(notification, 'accept')}
                      >
                        <Text style={styles.acceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        disabled={handlingRequestId === notification.data.request_id}
                        onPress={() => handleConnectionAction(notification, 'reject')}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                {notification.is_read ? (
                  <CheckCircle2 color={palette.green} size={20} />
                ) : (
                  <View style={styles.dot} />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <Bell color={palette.violet} size={34} />
              <Text style={styles.emptyTitle}>No buzz yet</Text>
              <Text style={styles.emptyText}>Your notifications will appear here.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function notificationIcon(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('commented') || lower.includes('response')) {
    return <MessageCircle color={palette.violet} size={15} />;
  }

  if (lower.includes('became') || lower.includes('vibed')) {
    return <UserPlus color={palette.blue} size={15} />;
  }

  return <Heart color={palette.pink} fill={palette.pink} size={15} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.wash,
    padding: 18,
  },
  header: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 38,
  },
  chips: {
    flexDirection: 'row',
    gap: 9,
    marginVertical: 18,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#ECEEF8',
    justifyContent: 'center',
  },
  activeChip: {
    backgroundColor: '#FFCA57',
  },
  chipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  activeChipText: {
    color: palette.ink,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  unreadItem: {
    borderColor: '#D8CCFF',
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 52,
    height: 52,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1EAFF',
  },
  iconBadge: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    marginLeft: 12,
  },
  message: {
    color: palette.ink,
    fontWeight: '700',
    lineHeight: 19,
  },
  time: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.violet,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  rejectButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  empty: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: palette.muted,
    marginTop: 6,
  },
});
