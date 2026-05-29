import React, { useCallback, useState } from 'react';
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
import { ArrowLeft, Fingerprint, Ghost, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import ChatLockAuthModal from '../../components/ChatLockAuthModal';
import { palette } from '../../data/mockVibes';
import {
  ChatLockSettings,
  getChatLockSettings,
  updateChatLockSettings,
} from '../../services/messageApi';
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

export default function ChatLockSettingsScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [settings, setSettings] = useState<ChatLockSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [pinVisible, setPinVisible] = useState(false);
  const [pinError, setPinError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getChatLockSettings(token || undefined));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const updateSetting = async (key: keyof ChatLockSettings, value: boolean) => {
    if (key === 'enabled' && value && !settings.pin_set) {
      setPinVisible(true);
      return;
    }

    setSavingKey(key);
    try {
      const next = await updateChatLockSettings({ [key]: value }, token || undefined);
      setSettings(next);
    } catch (err: any) {
      Alert.alert('Chat Lock', err.message || 'Could not update setting.');
    } finally {
      setSavingKey('');
    }
  };

  const savePin = async (pin: string) => {
    setSavingKey('pin');
    setPinError('');

    try {
      const next = await updateChatLockSettings({
        enabled: true,
        new_pin: pin,
      }, token || undefined);
      setSettings(next);
      setPinVisible(false);
    } catch (err: any) {
      setPinError(err.message || 'Could not save PIN.');
    } finally {
      setSavingKey('');
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
        <Text style={styles.headerTitle}>Chat Lock</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.hero}>
          <LockKeyhole color="#FFFFFF" size={30} />
          <Text style={styles.heroTitle}>Private conversations stay private.</Text>
          <Text style={styles.heroText}>
            Lock chats with a hashed PIN and unlock with fingerprint or Face ID when available.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Privacy</Text>
        <SettingRow
          icon={<ShieldCheck color={palette.violet} size={21} />}
          title="Enable Chat Lock"
          subtitle={settings.pin_set ? 'PIN is set for private chats' : 'Create a PIN to start locking chats'}
          value={settings.enabled}
          loading={savingKey === 'enabled'}
          onValueChange={(value) => updateSetting('enabled', value)}
        />
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.78} onPress={() => setPinVisible(true)}>
          <View style={styles.actionIcon}>
            <KeyRound color={palette.violet} size={21} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{settings.pin_set ? 'Change PIN' : 'Create PIN'}</Text>
            <Text style={styles.rowSubtitle}>PIN is stored as a secure hash on the backend.</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Unlock Methods</Text>
        <SettingRow
          icon={<Fingerprint color={palette.violet} size={21} />}
          title="Enable Fingerprint"
          subtitle="Use device biometric authentication when available"
          value={settings.biometric_enabled}
          loading={savingKey === 'biometric_enabled'}
          onValueChange={(value) => updateSetting('biometric_enabled', value)}
        />
        <SettingRow
          icon={<ShieldCheck color={palette.violet} size={21} />}
          title="Enable Face ID"
          subtitle="Uses the same device biometric prompt on supported phones"
          value={settings.face_id_enabled}
          loading={savingKey === 'face_id_enabled'}
          onValueChange={(value) => updateSetting('face_id_enabled', value)}
        />

        <Text style={styles.sectionTitle}>Visibility</Text>
        <SettingRow
          icon={<LockKeyhole color={palette.violet} size={21} />}
          title="Hide Locked Chats"
          subtitle="Keep locked chats out of the normal chat list"
          value={settings.hide_locked_chats}
          loading={savingKey === 'hide_locked_chats'}
          onValueChange={(value) => updateSetting('hide_locked_chats', value)}
        />
        <SettingRow
          icon={<ShieldCheck color={palette.violet} size={21} />}
          title="Auto Lock After Exit"
          subtitle="Require authentication next time you open locked chats"
          value={settings.auto_lock_after_exit}
          loading={savingKey === 'auto_lock_after_exit'}
          onValueChange={(value) => updateSetting('auto_lock_after_exit', value)}
        />
        <SettingRow
          icon={<Ghost color={palette.violet} size={21} />}
          title="Ghost Lock Mode"
          subtitle="Hide the Locked Chats entry. Long-press Vibe Chat title to unlock."
          value={settings.ghost_lock_mode}
          loading={savingKey === 'ghost_lock_mode'}
          onValueChange={(value) => updateSetting('ghost_lock_mode', value)}
        />
      </ScrollView>

      <ChatLockAuthModal
        visible={pinVisible}
        title={settings.pin_set ? 'Change Chat Lock PIN' : 'Create Chat Lock PIN'}
        subtitle="Enter a 4 to 8 digit PIN. VibeZone stores only the hashed PIN."
        confirmLabel="Save PIN"
        pinPlaceholder="New PIN"
        error={pinError}
        loading={savingKey === 'pin'}
        biometricEnabled={false}
        onClose={() => setPinVisible(false)}
        onSubmitPin={savePin}
      />
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  loading,
  onValueChange,
  subtitle,
  title,
  value,
}: {
  icon: React.ReactNode;
  loading?: boolean;
  onValueChange: (value: boolean) => void;
  subtitle: string;
  title: string;
  value: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={palette.violet} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          thumbColor="#FFFFFF"
          trackColor={{ false: '#D9DCE8', true: '#A78BFA' }}
        />
      )}
    </View>
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
    height: 58,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECECFA',
  },
  headerTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  hero: {
    minHeight: 148,
    borderRadius: 28,
    padding: 20,
    justifyContent: 'flex-end',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
  },
  heroText: {
    color: '#EEF2FF',
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 7,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 22,
    marginBottom: 10,
  },
  row: {
    minHeight: 74,
    borderRadius: 22,
    padding: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  actionRow: {
    minHeight: 74,
    borderRadius: 22,
    padding: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F1EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
});
