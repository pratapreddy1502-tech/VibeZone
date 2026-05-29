import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Edit3, LockKeyhole, MessageCircle, Plus, Search } from 'lucide-react-native';

import ChatLockAuthModal from '../../components/ChatLockAuthModal';
import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import { formatChatListTime } from '../../services/chatTime';
import {
  authenticateWithBiometric,
  ChatLockSettings,
  ChatUser,
  getChatOverview,
  getChatWebSocketUrls,
  getLockedChats,
  verifyChatPin,
} from '../../services/messageApi';
import { useAuthStore } from '../../store/authStore';

export default function ChatScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lockedCount, setLockedCount] = useState(0);
  const [lockedUsers, setLockedUsers] = useState<ChatUser[]>([]);
  const [lockedVisible, setLockedVisible] = useState(false);
  const [lockAuthVisible, setLockAuthVisible] = useState(false);
  const [lockAuthLoading, setLockAuthLoading] = useState(false);
  const [lockAuthError, setLockAuthError] = useState('');
  const [lockSettings, setLockSettings] = useState<ChatLockSettings>({
    enabled: false,
    pin_set: false,
    biometric_enabled: true,
    face_id_enabled: true,
    hide_locked_chats: false,
    auto_lock_after_exit: true,
    ghost_lock_mode: false,
  });
  const socketRef = useRef<WebSocket | null>(null);

  const loadChats = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const overview = await getChatOverview(token || undefined);
      setUsers(overview.users);
      setLockedCount(overview.locked_count);
      setLockSettings(overview.settings);
      if (overview.settings.auto_lock_after_exit) {
        setLockedVisible(false);
        setLockedUsers([]);
      }
      setError('');
    } catch (err: any) {
      setUsers([]);
      setError(err.message || 'Unable to load chats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined;
    }

    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const urls = getChatWebSocketUrls(currentUser.id);

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'presence') {
          setUsers((current) =>
            current.map((user) =>
              user.id === payload.user_id
                ? {
                    ...user,
                    is_online: Boolean(payload.is_online),
                    last_seen: payload.last_seen || user.last_seen,
                  }
                : user
            )
          );
          setLockedUsers((current) =>
            current.map((user) =>
              user.id === payload.user_id
                ? {
                    ...user,
                    is_online: Boolean(payload.is_online),
                    last_seen: payload.last_seen || user.last_seen,
                  }
                : user
            )
          );
        }

        if (payload.type === 'message') {
          const message = payload.message;
          const otherUserId =
            message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
          setUsers((current) =>
            current.map((user) =>
              user.id === otherUserId
                ? {
                    ...user,
                    last_message: message.content || message.text,
                    last_message_at: message.created_at,
                    unread_count:
                      message.sender_id === user.id ? user.unread_count + 1 : user.unread_count,
                  }
                : user
            )
          );
          setLockedUsers((current) =>
            current.map((user) =>
              user.id === otherUserId
                ? {
                    ...user,
                    last_message: message.content || message.text,
                    last_message_at: message.created_at,
                    unread_count:
                      message.sender_id === user.id ? user.unread_count + 1 : user.unread_count,
                  }
                : user
            )
          );
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
  }, [currentUser?.id]);

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(query.trim().toLowerCase())
  );
  const onlineUsers = users.filter((user) => user.is_online).slice(0, 8);
  const openProfile = (userId: number) => {
    navigation.navigate('Profile', { userId });
  };
  const openChat = (chatUser: ChatUser, locked = false) => {
    navigation.navigate('ChatThread', { chatUser, isLockedChat: locked });
  };
  const revealLockedChats = async () => {
    const data = await getLockedChats(token || undefined);
    setLockedUsers(data.users);
    setLockedCount(data.locked_count);
    setLockSettings(data.settings);
    setLockedVisible(true);
    setLockAuthVisible(false);
  };
  const openLockedChats = async () => {
    setLockAuthError('');

    if (lockSettings.biometric_enabled) {
      const ok = await authenticateWithBiometric('Unlock locked VibeZone chats');

      if (ok) {
        await revealLockedChats();
        return;
      }
    }

    setLockAuthVisible(true);
  };
  const submitLockedPin = async (pin: string) => {
    setLockAuthLoading(true);
    setLockAuthError('');

    try {
      await verifyChatPin(pin, token || undefined);
      await revealLockedChats();
      setLockAuthVisible(false);
    } catch (err: any) {
      setLockAuthError(err.message || 'Could not unlock locked chats.');
    } finally {
      setLockAuthLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.logoMark}>
            <Text style={styles.logoText}>V</Text>
          </LinearGradient>
          <Text style={styles.brand}>VibeZone</Text>
        </View>
        <TouchableOpacity style={styles.composeButton} activeOpacity={0.76}>
          <Edit3 color={palette.ink} size={19} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title} onLongPress={openLockedChats}>Vibe Chat</Text>

      <View style={styles.search}>
        <Search color="#8A91AD" size={18} />
        <TextInput
          style={styles.input}
          placeholder="Search chats..."
          placeholderTextColor="#8A91AD"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.violet} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadChats(true)} />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineRail}
          >
            <TouchableOpacity style={styles.noteItem} activeOpacity={0.78}>
              <View style={styles.noteButton}>
                <Plus color={palette.muted} size={25} />
              </View>
              <Text style={styles.railLabel}>Your note</Text>
            </TouchableOpacity>
            {onlineUsers.map((user) => (
              <TouchableOpacity
                key={`online-${user.id}`}
                style={styles.onlineItem}
                activeOpacity={0.78}
                onPress={() => openProfile(user.id)}
              >
                <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.storyRing}>
                  <Image
                    source={{ uri: resolveProfileImage(user.profile_image, user.id, user.username) }}
                    style={styles.storyAvatar}
                  />
                </LinearGradient>
                <View style={styles.storyDot} />
                <Text style={styles.railLabel} numberOfLines={1}>
                  {user.username.replace(/^@/, '')}
                </Text>
              </TouchableOpacity>
            ))}
            {users.length > onlineUsers.length ? (
              <TouchableOpacity style={styles.viewAllItem} activeOpacity={0.78}>
                <View style={styles.viewAllButton}>
                  <ChevronRight color={palette.ink} size={24} />
                </View>
                <Text style={styles.railLabel}>View all</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {filteredUsers.length ? (
            filteredUsers.map((chatUser) => (
              <TouchableOpacity
                key={chatUser.id}
                style={styles.chat}
                activeOpacity={0.76}
                onPress={() => openChat(chatUser)}
              >
                <View style={styles.avatarWrap}>
                  <Image
                    source={{
                      uri: resolveProfileImage(chatUser.profile_image, chatUser.id, chatUser.username),
                    }}
                    style={styles.avatar}
                  />
                  {chatUser.is_online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>@{chatUser.username}</Text>
                  <Text style={styles.text} numberOfLines={1}>
                    {chatUser.last_message}
                    {chatUser.last_message_at ? ` · ${formatChatListTime(chatUser.last_message_at)}` : ''}
                  </Text>
                </View>
                <View style={styles.meta}>
                  {chatUser.unread_count ? (
                    <View style={styles.unread}>
                      <Text style={styles.unreadText}>{chatUser.unread_count}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <MessageCircle color={palette.violet} size={34} />
              <Text style={styles.emptyTitle}>{error ? 'Chat not connected' : 'No chats yet'}</Text>
              <Text style={styles.emptyText}>
                {error || 'Create another account to start a chat.'}
              </Text>
              {error ? (
                <TouchableOpacity style={styles.retryButton} onPress={() => loadChats(true)}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {lockedCount > 0 ? (
            lockedVisible ? (
              <View style={styles.lockedSection}>
                <View style={styles.lockedTitleRow}>
                  <LockKeyhole color={palette.violet} size={18} />
                  <Text style={styles.lockedTitle}>
                    {lockSettings.ghost_lock_mode ? 'Ghost Mode Chats' : 'Locked Chats'}
                  </Text>
                </View>
                {lockedUsers.map((chatUser) => (
                  <TouchableOpacity
                    key={`locked-${chatUser.id}`}
                    style={[styles.chat, styles.lockedChat]}
                    activeOpacity={0.76}
                    onPress={() => openChat(chatUser, true)}
                  >
                    <View style={styles.avatarWrap}>
                      <Image
                        source={{
                          uri: resolveProfileImage(chatUser.profile_image, chatUser.id, chatUser.username),
                        }}
                        style={styles.avatar}
                      />
                      <View style={styles.lockBadge}>
                        <LockKeyhole color="#FFFFFF" size={10} />
                      </View>
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.name} numberOfLines={1}>@{chatUser.username}</Text>
                      <Text style={styles.text} numberOfLines={1}>
                        {chatUser.last_message}
                        {chatUser.last_message_at ? ` · ${formatChatListTime(chatUser.last_message_at)}` : ''}
                      </Text>
                    </View>
                    {chatUser.unread_count ? (
                      <View style={styles.unread}>
                        <Text style={styles.unreadText}>{chatUser.unread_count}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : !lockSettings.ghost_lock_mode ? (
              <TouchableOpacity style={styles.lockedEntry} activeOpacity={0.78} onPress={openLockedChats}>
                <View style={styles.lockedIcon}>
                  <LockKeyhole color="#FFFFFF" size={20} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.lockedEntryTitle}>Locked Chats</Text>
                  <Text style={styles.text}>Unlock with PIN or fingerprint</Text>
                </View>
                <Text style={styles.lockedCount}>{lockedCount}</Text>
              </TouchableOpacity>
            ) : null
          ) : null}
        </ScrollView>
      )}
      <ChatLockAuthModal
        visible={lockAuthVisible}
        title="Locked Chats"
        subtitle="Use your Chat Lock PIN or device biometric to view private conversations."
        confirmLabel="Unlock"
        error={lockAuthError}
        loading={lockAuthLoading}
        biometricEnabled={lockSettings.biometric_enabled}
        onBiometric={openLockedChats}
        onClose={() => setLockAuthVisible(false)}
        onSubmitPin={submitLockedPin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FF',
    paddingHorizontal: 18,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  brand: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '900',
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    marginTop: 8,
  },
  search: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    marginTop: 20,
    marginBottom: 12,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 96,
  },
  onlineRail: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  noteItem: {
    width: 70,
    alignItems: 'center',
  },
  noteButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#EEEAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineItem: {
    width: 72,
    alignItems: 'center',
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 61,
    height: 61,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  storyDot: {
    position: 'absolute',
    right: 9,
    bottom: 20,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#28C755',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  viewAllItem: {
    width: 70,
    alignItems: 'center',
  },
  viewAllButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    maxWidth: 70,
  },
  chat: {
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 14,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  avatarWrap: {
    width: 56,
    height: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8E8F5',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#28C755',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  copy: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 16,
  },
  text: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 14,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    color: palette.muted,
    fontSize: 12,
  },
  unread: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  lockedEntry: {
    minHeight: 78,
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: '#E4DBFF',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  lockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedEntryTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  lockedCount: {
    color: palette.violet,
    fontWeight: '900',
    fontSize: 16,
  },
  lockedSection: {
    marginTop: 2,
  },
  lockedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  lockedTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  lockedChat: {
    borderColor: '#D8CCFF',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  lockBadge: {
    position: 'absolute',
    right: -1,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.violet,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    lineHeight: 19,
  },
  retryButton: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
