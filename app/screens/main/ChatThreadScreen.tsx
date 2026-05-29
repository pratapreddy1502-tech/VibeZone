import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Ban,
  BellOff,
  Camera,
  LockKeyhole,
  Mic,
  MoreVertical,
  Phone,
  Search,
  Send,
  Smile,
  UserRound,
  Video,
} from 'lucide-react-native';

import ChatLockAuthModal from '../../components/ChatLockAuthModal';
import { useVoiceCall } from '../../context/VoiceCallContext';
import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import {
  formatActiveStatus,
  formatDateSeparator,
  formatMessageClock,
  shouldShowDateSeparator,
} from '../../services/chatTime';
import {
  authenticateWithBiometric,
  ChatLockSettings,
  ChatMessage,
  ChatUser,
  getChatWebSocketUrls,
  getChatLockSettings,
  getMessages,
  lockChat,
  normalizeMessage,
  sendMessage,
  unlockChat,
  verifyChatPin,
} from '../../services/messageApi';
import { useAuthStore } from '../../store/authStore';

export default function ChatThreadScreen({ navigation, route }: any) {
  const chatUser = route.params?.chatUser as ChatUser;
  const isLockedChat = Boolean(route.params?.isLockedChat || chatUser?.is_locked);
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const { startVoiceCall, startVideoCall } = useVoiceCall();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [otherOnline, setOtherOnline] = useState(Boolean(chatUser?.is_online));
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(chatUser?.last_seen || null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [lockAuthVisible, setLockAuthVisible] = useState(false);
  const [lockAuthMode, setLockAuthMode] = useState<'lock' | 'set_pin' | 'unlock'>('lock');
  const [lockAuthLoading, setLockAuthLoading] = useState(false);
  const [lockAuthError, setLockAuthError] = useState('');
  const [chatLockSettings, setChatLockSettings] = useState<ChatLockSettings>({
    enabled: false,
    pin_set: false,
    biometric_enabled: true,
    face_id_enabled: true,
    hide_locked_chats: false,
    auto_lock_after_exit: true,
    ghost_lock_mode: false,
  });
  const socketRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const scrollToLatestAfterLayout = useCallback((animated = true) => {
    setTimeout(() => scrollToLatest(animated), 60);
  }, [scrollToLatest]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) {
        return current;
      }

      return [...current, message];
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!chatUser?.id) {
      return;
    }

    try {
      setMessages(await getMessages(chatUser.id, token || undefined));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [chatUser?.id, token]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        return;
      }

      getChatLockSettings(token).then(setChatLockSettings).catch(() => {});
    }, [token])
  );

  useEffect(() => {
    if (!currentUser?.id || !chatUser?.id) {
      return undefined;
    }

    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const urls = getChatWebSocketUrls(currentUser.id);

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'message') {
          const nextMessage = normalizeMessage(payload.message);
          const belongsToThread =
            (nextMessage.sender_id === currentUser.id &&
              nextMessage.receiver_id === chatUser.id) ||
            (nextMessage.sender_id === chatUser.id &&
              nextMessage.receiver_id === currentUser.id);

          if (belongsToThread) {
            appendMessage(nextMessage);

            if (
              nextMessage.sender_id === chatUser.id &&
              socketRef.current?.readyState === WebSocket.OPEN
            ) {
              socketRef.current.send(JSON.stringify({
                type: 'read',
                receiver_id: chatUser.id,
                message_ids: [nextMessage.id],
              }));
            }
          }
        }

        if (payload.type === 'presence' && payload.user_id === chatUser.id) {
          setOtherOnline(Boolean(payload.is_online));
          if (payload.last_seen) {
            setOtherLastSeen(payload.last_seen);
          }
        }

        if (payload.type === 'typing' && payload.sender_id === chatUser.id) {
          setOtherTyping(Boolean(payload.is_typing));

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          if (payload.is_typing) {
            typingTimeoutRef.current = setTimeout(() => {
              setOtherTyping(false);
            }, 1800);
          }
        }

        if (payload.type === 'read_receipt' && payload.reader_id === chatUser.id) {
          const ids = new Set<number>(payload.message_ids || []);
          setMessages((current) =>
            current.map((message) =>
              ids.has(message.id)
                ? { ...message, status: 'seen', is_read: true, is_delivered: true }
                : message
            )
          );
        }

        if (payload.type === 'delivery_receipt' && payload.receiver_id === chatUser.id) {
          const ids = new Set<number>(payload.message_ids || []);
          setMessages((current) =>
            current.map((message) =>
              ids.has(message.id)
                ? { ...message, status: 'delivered', is_delivered: true }
                : message
            )
          );
        }
      } catch {
        // Ignore malformed socket payloads from old server runs.
      }
    };

    const connect = (index = 0) => {
      if (!active || index >= urls.length) {
        setConnected(false);
        return;
      }

      const socket = new WebSocket(urls[index]);
      let didOpen = false;
      socketRef.current = socket;
      setConnected(false);

      socket.onopen = () => {
        didOpen = true;
        setConnected(true);
      };

      socket.onmessage = handleMessage;

      socket.onerror = () => {
        if (!didOpen) {
          socket.close();
        } else {
          setConnected(false);
        }
      };

      socket.onclose = () => {
        if (!active) {
          return;
        }

        if (!didOpen && index < urls.length - 1) {
          retryTimer = setTimeout(() => connect(index + 1), 300);
          return;
        }

        setConnected(false);
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
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [appendMessage, chatUser?.id, currentUser?.id]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    scrollToLatest();
  }, [messages.length, scrollToLatest]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const keyboardShow = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      scrollToLatestAfterLayout();
    });
    const keyboardHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      scrollToLatestAfterLayout(false);
    });

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, [scrollToLatestAfterLayout]);

  const handleSend = async () => {
    const cleanText = text.trim();

    if (!cleanText || !chatUser?.id) {
      return;
    }

    setText('');
    sendTyping(false);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        receiver_id: chatUser.id,
        content: cleanText,
        created_at: new Date().toISOString(),
      }));
      scrollToLatest();
      return;
    }

    setSending(true);
    try {
      appendMessage(await sendMessage({
        receiver_id: chatUser.id,
        text: cleanText,
      }, token || undefined));
    } finally {
      setSending(false);
    }
  };

  const startCall = (callType: 'audio' | 'video') => {
    if (!chatUser?.id) {
      return;
    }

    if (callType === 'audio') {
      void startVoiceCall(chatUser);
      return;
    }

    void startVideoCall(chatUser);
  };

  const handleChangeText = (value: string) => {
    setText(value);
    sendTyping(Boolean(value.trim()));
  };

  const sendTyping = (isTyping: boolean) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !chatUser?.id) {
      return;
    }

    socketRef.current.send(JSON.stringify({
      type: 'typing',
      receiver_id: chatUser.id,
      is_typing: isTyping,
    }));
  };

  const displayName = chatUser?.username
    ? chatUser.username.replace(/^@/, '')
    : 'VibeZone';
  const chatAvatar = resolveProfileImage(chatUser?.profile_image, chatUser?.id, chatUser?.username);
  const statusText = otherTyping
    ? 'Typing...'
    : formatActiveStatus(otherOnline, otherLastSeen);
  const isActive = otherOnline || otherTyping;
  const inputBottomPadding = keyboardVisible ? 6 : Math.max(insets.bottom, 8);
  const openProfile = () => {
    if (chatUser?.id) {
      navigation.navigate('Profile', { userId: chatUser.id });
    }
  };
  const completeLock = async (pin?: string) => {
    if (!chatUser?.id || !token) {
      return;
    }

    await lockChat(chatUser.id, pin, token);
    Alert.alert('Chat Lock', 'This chat is now locked.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };
  const handleLockChat = async () => {
    setMenuVisible(false);
    setLockAuthError('');

    if (!chatLockSettings.pin_set) {
      setLockAuthMode('set_pin');
      setLockAuthVisible(true);
      return;
    }

    if (chatLockSettings.biometric_enabled) {
      const ok = await authenticateWithBiometric('Lock this VibeZone chat');

      if (ok) {
        await completeLock();
        return;
      }
    }

    setLockAuthMode('lock');
    setLockAuthVisible(true);
  };
  const handleUnlockChat = async () => {
    setMenuVisible(false);
    setLockAuthError('');

    if (chatLockSettings.biometric_enabled) {
      const ok = await authenticateWithBiometric('Remove Chat Lock');

      if (ok && token) {
        await unlockChat(chatUser.id, token);
        Alert.alert('Chat Lock', 'This chat is unlocked.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    }

    setLockAuthMode('unlock');
    setLockAuthVisible(true);
  };
  const submitChatLockPin = async (pin: string) => {
    setLockAuthLoading(true);
    setLockAuthError('');

    try {
      if (lockAuthMode === 'unlock') {
        await verifyChatPin(pin, token || undefined);
        await unlockChat(chatUser.id, token || undefined);
        Alert.alert('Chat Lock', 'This chat is unlocked.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await completeLock(pin);
      }

      setLockAuthVisible(false);
    } catch (err: any) {
      setLockAuthError(err.message || 'Could not update Chat Lock.');
    } finally {
      setLockAuthLoading(false);
    }
  };
  const lockAuthTitle = lockAuthMode === 'set_pin'
    ? 'Set Chat Lock PIN'
    : lockAuthMode === 'unlock'
      ? 'Unlock Chat'
      : 'Lock Chat';
  const lockAuthSubtitle = lockAuthMode === 'set_pin'
    ? 'Create a private PIN. VibeZone stores only a hashed version on the backend.'
    : lockAuthMode === 'unlock'
      ? 'Confirm your Chat Lock PIN to remove this chat from Locked Chats.'
      : 'Confirm your Chat Lock PIN to move this conversation into Locked Chats.';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color={palette.ink} size={22} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.82} onPress={openProfile}>
            <Image source={{ uri: chatAvatar }} style={styles.avatar} />
            {isActive ? <View style={styles.avatarStatusDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCopy} activeOpacity={0.82} onPress={openProfile}>
            <Text style={styles.name} numberOfLines={1}>
              {isLockedChat ? 'Locked Chat' : displayName}
            </Text>
            <View style={styles.statusRow}>
              {isLockedChat ? <LockKeyhole color={palette.violet} size={12} /> : null}
              <View style={[styles.statusDot, !isActive && styles.statusDotOffline]} />
              <Text style={[styles.status, !isActive && styles.statusOffline]}>
                {isLockedChat ? `${displayName} · ${statusText}` : statusText}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.callActions}>
            <TouchableOpacity style={styles.callButton} onPress={() => startCall('audio')}>
              <Phone color={palette.violet} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton} onPress={() => startCall('video')}>
              <Video color={palette.violet} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton} onPress={() => setMenuVisible(true)}>
              <MoreVertical color={palette.violet} size={21} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.violet} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.messageList}
            data={messages}
            inverted={false}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messages}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollToLatestAfterLayout()}
            onLayout={() => scrollToLatestAfterLayout(false)}
            renderItem={({ item, index }) => {
              const mine = item.sender_id === currentUser?.id;
              const previousMessage = messages[index - 1];
              const dateSeparator = shouldShowDateSeparator(
                item.created_at,
                previousMessage?.created_at
              )
                ? formatDateSeparator(item.created_at)
                : '';
              const messageTime = formatMessageClock(item.created_at);
              const status = item.status === 'seen'
                ? '✓✓ Seen'
                : item.status === 'delivered'
                  ? '✓✓ Delivered'
                  : '✓ Sent';

              return (
                <View>
                  {dateSeparator ? (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>{dateSeparator}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                    <View style={[styles.messageStack, mine && styles.messageStackMine]}>
                      {mine ? (
                        <LinearGradient
                          colors={['#8B5CF6', '#6D28D9']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.bubble, styles.bubbleMine]}
                        >
                          <Text style={[styles.messageText, styles.messageTextMine]}>
                            {item.content}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.bubble, styles.bubbleOther]}>
                          <Text style={styles.messageText}>{item.content}</Text>
                        </View>
                      )}
                      <Text style={[styles.messageMeta, mine && styles.messageMetaMine]}>
                        {mine ? `${messageTime} · ${status}` : messageTime}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Send the first vibe chat.</Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputArea, { paddingBottom: inputBottomPadding }]}>
          <TouchableOpacity style={styles.cameraButton} activeOpacity={0.78}>
            <Camera color="#FFFFFF" size={21} />
          </TouchableOpacity>
          <Pressable
            style={styles.composer}
            onPress={() => inputRef.current?.focus()}
          >
            <TouchableOpacity style={styles.composerIcon} activeOpacity={0.72}>
              <Smile color={palette.violet} size={23} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleChangeText}
              placeholder="Type a message..."
              placeholderTextColor="#9AA0B8"
              style={styles.input}
              autoCapitalize="sentences"
              autoCorrect
              blurOnSubmit={false}
              editable={!sending}
              multiline={false}
              maxLength={500}
              onFocus={() => scrollToLatest()}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              submitBehavior="submit"
            />
            <TouchableOpacity style={styles.composerIcon} activeOpacity={0.72}>
              <Mic color={palette.violet} size={23} />
            </TouchableOpacity>
          </Pressable>
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            disabled={!text.trim() || sending}
            onPress={handleSend}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Send color="#FFFFFF" size={19} />
            )}
          </TouchableOpacity>
        </View>
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
          <View style={styles.menuCard}>
            <MenuAction icon={<UserRound color={palette.violet} size={19} />} label="View Profile" onPress={() => { setMenuVisible(false); openProfile(); }} />
            <MenuAction icon={<Search color={palette.violet} size={19} />} label="Search Messages" onPress={() => { setMenuVisible(false); Alert.alert('Search Messages', 'Search is coming next.'); }} />
            <MenuAction icon={<BellOff color={palette.violet} size={19} />} label="Mute" onPress={() => { setMenuVisible(false); Alert.alert('Mute', 'This chat is muted locally.'); }} />
            <MenuAction
              icon={<LockKeyhole color={palette.violet} size={19} />}
              label={isLockedChat ? 'Unlock Chat' : 'Lock Chat'}
              onPress={isLockedChat ? handleUnlockChat : handleLockChat}
            />
            <MenuAction icon={<Ban color="#EF4444" size={19} />} label="Block User" danger onPress={() => { setMenuVisible(false); Alert.alert('Block User', 'Block controls are coming next.'); }} />
          </View>
        </Modal>
        <ChatLockAuthModal
          visible={lockAuthVisible}
          title={lockAuthTitle}
          subtitle={lockAuthSubtitle}
          confirmLabel={lockAuthMode === 'unlock' ? 'Unlock' : 'Lock'}
          pinPlaceholder={lockAuthMode === 'set_pin' ? 'Create PIN' : 'Enter PIN'}
          error={lockAuthError}
          loading={lockAuthLoading}
          biometricEnabled={chatLockSettings.biometric_enabled && lockAuthMode !== 'set_pin'}
          onBiometric={lockAuthMode === 'unlock' ? handleUnlockChat : handleLockChat}
          onClose={() => setLockAuthVisible(false)}
          onSubmitPin={submitChatLockPin}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MenuAction({
  danger,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuAction} activeOpacity={0.76} onPress={onPress}>
      {icon}
      <Text style={[styles.menuActionText, danger && styles.menuActionDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },
  container: {
    flex: 1,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEAFB',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarWrap: {
    marginLeft: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8E8F5',
  },
  avatarStatusDot: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#18B85B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#18B85B',
  },
  statusDotOffline: {
    backgroundColor: '#A5ABC2',
  },
  status: {
    color: '#18B85B',
    fontSize: 12,
    fontWeight: '800',
  },
  statusOffline: {
    color: palette.muted,
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  callButton: {
    width: 38,
    height: 42,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F2FF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },
  messages: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageStack: {
    width: '100%',
    alignItems: 'flex-start',
  },
  messageStackMine: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '70%',
    minWidth: 60,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: '#F1F2F6',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageMeta: {
    color: '#637091',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  messageMetaMine: {
    textAlign: 'right',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    marginTop: 6,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 7,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#ECECFA',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  cameraButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violet,
  },
  composer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    borderRadius: 22,
    paddingLeft: 4,
    paddingRight: 6,
    backgroundColor: '#F6F4FF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 42,
    paddingHorizontal: 4,
    paddingVertical: 0,
    color: palette.ink,
    textAlignVertical: 'center',
    fontSize: 16,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violet,
  },
  sendButtonDisabled: {
    opacity: 0.52,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 12, 38, 0.18)',
  },
  menuCard: {
    position: 'absolute',
    top: 78,
    right: 14,
    width: 232,
    borderRadius: 22,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderWidth: 1,
    borderColor: '#ECECFA',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  menuAction: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuActionText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  menuActionDanger: {
    color: '#EF4444',
  },
});
