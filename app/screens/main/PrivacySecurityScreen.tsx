import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Ghost, Globe2, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '../../data/mockVibes';
import { ChatLockSettings, getChatLockSettings, updateChatLockSettings } from '../../services/messageApi';
import { getAccountPrivacy, updateAccountPrivacy } from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';

const defaultSettings: ChatLockSettings = {
  enabled: false,
  pin_set: false,
  biometric_enabled: true,
  face_id_enabled: true,
  hide_locked_chats: false,
  auto_lock_after_exit: true,
  ghost_lock_mode: false,
};

export default function PrivacySecurityScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [settings, setSettings] = useState<ChatLockSettings>(defaultSettings);
  const [accountType, setAccountType] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingGhost, setSavingGhost] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const [chatSettings, privacy] = await Promise.all([
        getChatLockSettings(token || undefined),
        token ? getAccountPrivacy(token) : Promise.resolve({ account_type: 'public' as const }),
      ]);
      setSettings(chatSettings);
      setAccountType(privacy.account_type);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const toggleGhostMode = async (value: boolean) => {
    setSavingGhost(true);

    try {
      const next = await updateChatLockSettings({ ghost_lock_mode: value }, token || undefined);
      setSettings(next);
    } catch (err: any) {
      Alert.alert('Ghost Mode', err.message || 'Could not update Ghost Mode.');
    } finally {
      setSavingGhost(false);
    }
  };

  const togglePrivateAccount = async (value: boolean) => {
    if (!token) {
      return;
    }

    const nextAccountType = value ? 'private' : 'public';
    setSavingAccount(true);
    setAccountType(nextAccountType);

    try {
      const next = await updateAccountPrivacy(nextAccountType, token);
      setAccountType(next.account_type);

      if (next.user) {
        const nextUser = { ...(user || next.user), ...next.user };
        await AsyncStorage.setItem('user', JSON.stringify(nextUser));
        setAuth(nextUser, token);
      }
    } catch (err: any) {
      setAccountType(value ? 'public' : 'private');
      Alert.alert('Account Privacy', err.message || 'Could not update account privacy.');
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={palette.violet} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={palette.ink} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Security</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0F1028', '#7C3AED']} style={styles.hero}>
          <ShieldCheck color="#FFFFFF" size={30} />
          <Text style={styles.heroTitle}>Private by design.</Text>
          <Text style={styles.heroText}>Control public profiles, private content, locked chats, and protected notifications.</Text>
        </LinearGradient>

        <View style={styles.row}>
          <View style={styles.icon}>
            {accountType === 'private' ? (
              <LockKeyhole color={palette.violet} size={22} />
            ) : (
              <Globe2 color={palette.violet} size={22} />
            )}
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>
              {accountType === 'private' ? 'Private Account' : 'Public Account'}
            </Text>
            <Text style={styles.rowSubtitle}>
              {accountType === 'private'
                ? 'Only Vibers can see your movements, posts, and media grid.'
                : 'Everyone can view your profile, movements, and posts.'}
            </Text>
            <View style={styles.accountPills}>
              <View style={[styles.accountPill, accountType === 'public' && styles.accountPillActive]}>
                <Text style={[styles.accountPillText, accountType === 'public' && styles.accountPillTextActive]}>
                  Public
                </Text>
              </View>
              <View style={[styles.accountPill, accountType === 'private' && styles.accountPillActive]}>
                <Text style={[styles.accountPillText, accountType === 'private' && styles.accountPillTextActive]}>
                  Private
                </Text>
              </View>
            </View>
          </View>
          {savingAccount ? (
            <ActivityIndicator color={palette.violet} />
          ) : (
            <Switch
              value={accountType === 'private'}
              onValueChange={togglePrivateAccount}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#D9DCE8', true: '#A78BFA' }}
            />
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.icon}>
            <Ghost color={palette.violet} size={22} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Ghost Mode</Text>
            <Text style={styles.rowSubtitle}>
              Hide the Locked Chats entry. Long-press the Vibe Chat title to access it secretly.
            </Text>
          </View>
          {savingGhost ? (
            <ActivityIndicator color={palette.violet} />
          ) : (
            <Switch
              value={settings.ghost_lock_mode}
              onValueChange={toggleGhostMode}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#D9DCE8', true: '#A78BFA' }}
            />
          )}
        </View>

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.78}
          onPress={() => navigation.navigate('ChatLockSettings')}
        >
          <View style={styles.icon}>
            <LockKeyhole color={palette.violet} size={22} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Chat Lock</Text>
            <Text style={styles.rowSubtitle}>Manage PIN, fingerprint, Face ID, and locked chats.</Text>
          </View>
          <ChevronRight color={palette.violet} size={22} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },
  center: {
    flex: 1,
    backgroundColor: '#F7F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 18,
    paddingBottom: 38,
  },
  hero: {
    minHeight: 142,
    borderRadius: 28,
    padding: 20,
    justifyContent: 'flex-end',
    marginBottom: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  heroText: {
    color: '#EEF2FF',
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  row: {
    minHeight: 82,
    borderRadius: 22,
    padding: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: '#F1EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  rowTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  accountPills: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },
  accountPill: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F2F1FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountPillActive: {
    backgroundColor: palette.violet,
  },
  accountPillText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  accountPillTextActive: {
    color: '#FFFFFF',
  },
});
