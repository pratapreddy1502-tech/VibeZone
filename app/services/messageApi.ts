import { getWebSocketBaseUrls } from '../config/api';
import { resolveProfileImage } from './avatar';
import { apiRequest } from './api';

export type ChatUser = {
  id: number;
  username: string;
  email: string;
  profile_image?: string | null;
  is_online: boolean;
  last_seen?: string | null;
  last_message: string;
  last_message_at?: string | null;
  unread_count: number;
  is_locked?: boolean;
};

export type ChatLockSettings = {
  enabled: boolean;
  pin_set: boolean;
  biometric_enabled: boolean;
  face_id_enabled: boolean;
  hide_locked_chats: boolean;
  auto_lock_after_exit: boolean;
  ghost_lock_mode: boolean;
};

export type ChatOverview = {
  users: ChatUser[];
  locked_count: number;
  settings: ChatLockSettings;
};

const defaultChatLockSettings: ChatLockSettings = {
  enabled: false,
  pin_set: false,
  biometric_enabled: true,
  face_id_enabled: true,
  hide_locked_chats: false,
  auto_lock_after_exit: true,
  ghost_lock_mode: false,
};

export type ChatMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_username: string;
  receiver_username: string;
  content: string;
  text: string;
  status: 'sent' | 'delivered' | 'seen';
  is_delivered?: boolean;
  is_read?: boolean;
  created_at?: string | null;
};

export function normalizeMessage(message: any): ChatMessage {
  const content = String(message.content ?? message.text ?? '');
  const status = message.status === 'seen' || message.is_read
    ? 'seen'
    : message.status === 'delivered' || message.is_delivered
      ? 'delivered'
      : 'sent';

  return {
    id: Number(message.id || Date.now()),
    sender_id: Number(message.sender_id),
    receiver_id: Number(message.receiver_id),
    sender_username: message.sender_username || 'vibezone',
    receiver_username: message.receiver_username || 'vibezone',
    content,
    text: content,
    status,
    is_delivered: status === 'delivered' || status === 'seen',
    is_read: status === 'seen',
    created_at: message.created_at || null,
  };
}

function normalizeChatUser(user: any): ChatUser {
  const userId = Number(user.id);

  return {
    id: userId,
    username: user.username || 'vibezone',
    email: user.email || '',
    profile_image: resolveProfileImage(user.profile_image, userId, user.username),
    is_online: Boolean(user.is_online),
    last_seen: user.last_seen || null,
    last_message: user.last_message || 'Start a vibe chat',
    last_message_at: user.last_message_at || null,
    unread_count: Number(user.unread_count || 0),
    is_locked: Boolean(user.is_locked),
  };
}

function normalizeChatOverview(data: any): ChatOverview {
  const users = Array.isArray(data) ? data : data?.users || [];
  const settings = data?.settings || {};

  return {
    users: users.map(normalizeChatUser),
    locked_count: Number(data?.locked_count || 0),
    settings: {
      ...defaultChatLockSettings,
      ...settings,
      enabled: Boolean(settings.enabled),
      pin_set: Boolean(settings.pin_set),
      biometric_enabled: settings.biometric_enabled !== false,
      face_id_enabled: settings.face_id_enabled !== false,
      hide_locked_chats: Boolean(settings.hide_locked_chats),
      auto_lock_after_exit: settings.auto_lock_after_exit !== false,
      ghost_lock_mode: Boolean(settings.ghost_lock_mode),
    },
  };
}

export function getChatOverview(token?: string) {
  return apiRequest('/chat-users', 'GET', undefined, token, 3500).then(normalizeChatOverview);
}

export function getChatUsers(token?: string) {
  return getChatOverview(token).then((data) => data.users);
}

export function getLockedChats(token?: string) {
  return apiRequest('/locked-chats', 'GET', undefined, token, 3500).then(normalizeChatOverview);
}

export function getChatLockSettings(token?: string) {
  return apiRequest('/chat-lock-settings', 'GET', undefined, token).then((data) =>
    normalizeChatOverview({ users: [], settings: data }).settings
  );
}

export function updateChatLockSettings(
  settings: Partial<ChatLockSettings> & { new_pin?: string },
  token?: string
) {
  return apiRequest('/chat-lock-settings', 'PUT', settings, token).then((data) =>
    normalizeChatOverview({ users: [], settings: data }).settings
  );
}

export function verifyChatPin(pin: string, token?: string) {
  return apiRequest('/verify-chat-pin', 'POST', { pin }, token).then((data) =>
    Boolean(data?.verified)
  );
}

export function lockChat(chatId: number, pin?: string, token?: string) {
  return apiRequest(`/chat-lock/${chatId}`, 'POST', { pin }, token).then((data) => ({
    lock: data?.lock,
    settings: normalizeChatOverview({ users: [], settings: data?.settings }).settings,
  }));
}

export function unlockChat(chatId: number, token?: string) {
  return apiRequest(`/chat-lock/${chatId}`, 'DELETE', undefined, token);
}

export async function authenticateWithBiometric(promptMessage = 'Unlock private VibeZone chat') {
  const LocalAuthentication = await import('expo-local-authentication');
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use PIN',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  return Boolean(result.success);
}

export function getMessages(userId: number, token?: string) {
  return apiRequest(`/messages/${userId}`, 'GET', undefined, token, 3500).then((data) => {
    const messages = Array.isArray(data) ? data : data?.messages || [];

    return messages.map(normalizeMessage);
  });
}

export function sendMessage(
  data: {
    receiver_id: number;
    text: string;
  },
  token?: string
) {
  return apiRequest(
    `/send-message?receiver_id=${data.receiver_id}&content=${encodeURIComponent(data.text)}&created_at=${encodeURIComponent(new Date().toISOString())}`,
    'POST',
    undefined,
    token
  ).then((response) => normalizeMessage(response.chat_message));
}

export function getChatWebSocketUrl(userId: number) {
  return `${getWebSocketBaseUrls()[0]}/ws/${userId}`;
}

export function getChatWebSocketUrls(userId: number) {
  return getWebSocketBaseUrls().map((baseUrl) => `${baseUrl}/ws/${userId}`);
}
