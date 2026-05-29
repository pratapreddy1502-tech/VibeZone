import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, ChevronRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '../../data/mockVibes';

export default function SettingsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={palette.ink} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#8B5CF6', '#3B82F6']} style={styles.hero}>
          <Text style={styles.heroTitle}>VibeZone Settings</Text>
          <Text style={styles.heroText}>Privacy, security, notifications, and profile controls.</Text>
        </LinearGradient>

        <SettingRow
          icon={<ShieldCheck color={palette.violet} size={22} />}
          title="Privacy & Security"
          subtitle="Chat Lock, Ghost Mode, locked chats, and safety controls"
          onPress={() => navigation.navigate('PrivacySecurity')}
        />
        <SettingRow
          icon={<LockKeyhole color={palette.violet} size={22} />}
          title="Chat Lock"
          subtitle="PIN, fingerprint, Face ID, and locked chat settings"
          onPress={() => navigation.navigate('ChatLockSettings')}
        />
        <SettingRow
          icon={<Bell color={palette.violet} size={22} />}
          title="Buzz Notifications"
          subtitle="Manage alerts and private message previews"
          onPress={() => navigation.navigate('PrivacySecurity')}
        />
        <SettingRow
          icon={<UserRound color={palette.violet} size={22} />}
          title="Profile"
          subtitle="Edit your profile from My Zone"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  onPress,
  subtitle,
  title,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.78} onPress={onPress}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight color={palette.violet} size={22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F5FF',
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
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 24,
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
    minHeight: 132,
    borderRadius: 28,
    padding: 20,
    justifyContent: 'flex-end',
    marginBottom: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: '#EEF2FF',
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  row: {
    minHeight: 76,
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
});
