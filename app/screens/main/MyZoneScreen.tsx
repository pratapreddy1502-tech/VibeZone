import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bookmark,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';

import AppVideo from '../../components/AppVideo';
import VibeStudioSheet from '../../components/VibeStudioSheet';
import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import { resolveMediaUrl } from '../../services/postApi';
import {
  getProfile,
  Profile,
  requestConnection,
  unvibeUser,
  vibeUser,
} from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';
import { useProfileUpdateStore } from '../../store/profileUpdateStore';
import { useThemeStore } from '../../store/themeStore';

export default function MyZoneScreen({ navigation, route }: any) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const profileUpdates = useProfileUpdateStore((state) => state.updates);
  const theme = useThemeStore((state) => state.theme);
  const history = useThemeStore((state) => state.history);
  const loadTheme = useThemeStore((state) => state.loadTheme);
  const resetTheme = useThemeStore((state) => state.resetTheme);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mediaTab, setMediaTab] = useState<'all' | 'reels' | 'photos' | 'saved'>('all');
  const [actionLoading, setActionLoading] = useState<'vibe' | 'connection' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [studioVisible, setStudioVisible] = useState(false);
  const targetUserId = Number(route?.params?.userId || user?.id || 0);
  const isOwnProfile = Boolean(user?.id && targetUserId === user.id);
  const fallbackUsername = isOwnProfile ? user?.username || 'pratap_dev' : 'vibezone';
  const reelsCount = profile?.reels_count ?? profile?.reels?.length ?? 0;
  const vibersCount = profile?.vibers_count ?? profile?.followers_count ?? 0;
  const connectionsCount = profile?.connections_count ?? 0;
  const avatar = resolveProfileImage(
    profile?.profile_image || (isOwnProfile ? user?.profile_image : null),
    targetUserId,
    profile?.username || fallbackUsername
  );
  const reelMedia = (profile?.reels || []).map((reel) => ({
      id: `reel-${reel.id}`,
      type: 'reel' as const,
      uri: resolveMediaUrl(reel.video_url),
      views: reel.views_count ?? 0,
    }));
  const photoMedia = (profile?.vibes || []).map((vibe) => ({
      id: `vibe-${vibe.id}`,
      type: 'photo' as const,
      uri: resolveMediaUrl(vibe.image_url),
      views: 0,
    }));
  const profileMedia = (
    mediaTab === 'reels'
      ? reelMedia
      : mediaTab === 'photos'
        ? photoMedia
        : mediaTab === 'saved'
          ? []
          : [...reelMedia, ...photoMedia]
  ).filter((item) => item.uri);

  const setProfileAndCache = useCallback((nextProfile: Profile) => {
    setProfile(nextProfile);
    AsyncStorage.setItem(`profile:${nextProfile.id}`, JSON.stringify(nextProfile)).catch(() => {});
  }, []);

  useEffect(() => {
    loadTheme(token);
  }, [loadTheme, token]);

  useEffect(() => {
    setProfile(null);
    setMediaTab('all');
  }, [targetUserId]);

  const loadProfile = useCallback(async () => {
    if (!targetUserId || !token) {
      return;
    }

    try {
      const cacheKey = `profile:${targetUserId}`;
      const cachedProfile = await AsyncStorage.getItem(cacheKey);

      if (cachedProfile && isOwnProfile) {
        setProfile(JSON.parse(cachedProfile));
      }

      const freshProfile = await getProfile(targetUserId, token);
      setProfile(freshProfile);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(freshProfile));
    } catch {
      setProfile((current) => current || null);
    }
  }, [isOwnProfile, targetUserId, token]);

  const refreshProfile = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  useEffect(() => {
    const counts = profileUpdates[targetUserId];

    if (!counts) {
      return;
    }

    setProfile((current) => {
      const nextProfile = current ? { ...current, ...counts } : current;

      if (nextProfile) {
        AsyncStorage.setItem(`profile:${targetUserId}`, JSON.stringify(nextProfile)).catch(() => {});
      }

      return nextProfile;
    });
  }, [profileUpdates, targetUserId]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Do you want to log out of VibeZone?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'user']);
          logout();
        },
      },
    ]);
  };

  const openSettings = () => {
    const parentNavigation = navigation.getParent?.();

    if (parentNavigation) {
      parentNavigation.navigate('My Zone', {
        screen: 'Settings',
      });
      return;
    }

    navigation.navigate('Settings');
  };

  const handleVibe = async () => {
    if (!profile || !token || isOwnProfile) {
      return;
    }

    const wasVibed = Boolean(profile.has_vibed);

    setActionLoading('vibe');
    setProfile((current) =>
      current
        ? {
            ...current,
            has_vibed: !wasVibed,
            vibers_count: Math.max(0, current.vibers_count + (wasVibed ? -1 : 1)),
          }
        : current
    );

    try {
      const result = wasVibed
        ? await unvibeUser(profile.id, token)
        : await vibeUser(profile.id, token);
      if (result.target_user) {
        setProfileAndCache(result.target_user);
      }
    } catch (error: any) {
      await loadProfile();
      Alert.alert('Vibe', error.message || 'Could not update vibe.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnection = async () => {
    if (!profile || !token || isOwnProfile || profile.connection_status === 'accepted') {
      return;
    }

    if (profile.connection_status === 'pending') {
      Alert.alert('Connection', 'Your request is already pending.');
      return;
    }

    setActionLoading('connection');

    try {
      const result = await requestConnection(profile.id, token);
      if (result.target_user) {
        setProfileAndCache(result.target_user);
      }
    } catch (error: any) {
      Alert.alert('Connection', error.message || 'Could not send request.');
    } finally {
      setActionLoading(null);
    }
  };

  const connectionLabel = profile?.connection_status === 'accepted'
    ? 'Connected ✅'
      : profile?.connection_status === 'pending'
      ? 'Request Sent'
      : 'Connection 🤝';
  const displayName = profile?.full_name || profile?.username || fallbackUsername;
  const profileUsername = profile?.username || fallbackUsername;
  const profileBio =
    profile?.bio ||
    (isOwnProfile ? user?.bio : '') ||
    'Building vibes, just apps.';
  const profileWebsite = profile?.website;
  const privateContentLocked = Boolean(profile?.private_content_locked && !isOwnProfile);
  const openProfileList = (type: 'vibers' | 'connections') => {
    if (!profile) {
      return;
    }

    navigation.navigate('ProfileList', {
      type,
      userId: profile.id,
      profile,
    });
  };
  const openMessage = () => {
    if (!profile || isOwnProfile) {
      return;
    }

    navigation.navigate('ChatThread', {
      chatUser: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        profile_image: resolveProfileImage(profile.profile_image, profile.id, profile.username),
        is_online: false,
        last_seen: profile.last_seen || null,
        last_message: 'Start a vibe chat',
        last_message_at: null,
        unread_count: 0,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshProfile}
            tintColor={palette.violet}
            colors={[palette.violet]}
          /> 
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Zone</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={openSettings}
            >
              <Settings color={palette.ink} size={22} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
              <LogOut color="#EF4444" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
        <View style={styles.profile}>
          <LinearGradient colors={['#EC4899', '#8B5CF6', '#38BDF8']} style={styles.profileRing}>
            <Image
              source={{ uri: avatar }}
              style={styles.avatar}
            />
          </LinearGradient>
          <View style={styles.bio}>
            <Text style={styles.handle}>@{profileUsername} <Text style={styles.verified}>✓</Text></Text>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.copy}>{profileBio}</Text>
            {profileWebsite ? <Text style={styles.website}>{profileWebsite}</Text> : null}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat
            value={String(vibersCount)}
            label="Vibers"
            tone="#EAF3FF"
            color={palette.ink}
            onPress={() => openProfileList('vibers')}
          />
          <Stat
            value={String(connectionsCount)}
            label="Connections"
            tone="#F1EAFF"
            color={palette.ink}
            onPress={() => openProfileList('connections')}
          />
          {!privateContentLocked ? (
            <Stat
              value={String(reelsCount)}
              label="Movements"
              tone="#EAFBF2"
              color={palette.ink}
            />
          ) : null}
        </View>

        {isOwnProfile ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.gradientAction}
              onPress={() => navigation.navigate('EditProfile', { profile })}
            >
              <LinearGradient colors={['#7C3AED', '#9333EA']} style={styles.gradientActionFill}>
                <Text style={styles.gradientActionText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareAction}>
              <UserPlus color={palette.ink} size={20} />
              <Text style={styles.shareActionText}>Share Profile</Text>
            </TouchableOpacity>
          </View>
        ) : privateContentLocked ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.gradientAction}
              activeOpacity={0.82}
              disabled={actionLoading === 'vibe'}
              onPress={handleVibe}
            >
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.gradientActionFill}>
                <Heart color="#FFFFFF" fill="#FFFFFF" size={17} />
                <Text style={styles.gradientActionText}>Become Viber</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.connectionAction}
              activeOpacity={0.82}
              disabled={actionLoading === 'connection'}
              onPress={handleConnection}
            >
              <Text style={styles.connectionActionText}>
                {profile?.connection_status === 'pending' ? 'Request Sent' : 'Send Connection'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.gradientAction}
              activeOpacity={0.82}
              disabled={actionLoading === 'vibe'}
              onPress={handleVibe}
            >
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.gradientActionFill}>
                <Heart color="#FFFFFF" fill="#FFFFFF" size={17} />
                <Text style={styles.gradientActionText}>
                  {profile?.has_vibed ? 'Vibed ❤️' : 'Vibe ❤️'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.connectionAction,
                profile?.connection_status === 'accepted' && styles.connectionAccepted,
              ]}
              activeOpacity={0.82}
              disabled={actionLoading === 'connection'}
              onPress={handleConnection}
            >
              <Text
                style={[
                  styles.connectionActionText,
                  profile?.connection_status === 'accepted' && styles.connectionAcceptedText,
                ]}
              >
                {connectionLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.messageAction}
              activeOpacity={0.82}
              onPress={openMessage}
            >
              <MessageCircle color={palette.ink} size={18} />
              <Text style={styles.messageActionText}>Message 💬</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>

        {privateContentLocked ? (
          <View style={styles.privateCard}>
            <View style={styles.privateIcon}>
              <LockKeyhole color="#FFFFFF" size={24} />
            </View>
            <Text style={styles.privateTitle}>Private Account</Text>
            <Text style={styles.privateText}>
              This profile is private. Only Vibers can see stories, movements, posts, and media.
            </Text>
          </View>
        ) : null}

        {isOwnProfile ? (
          <View style={[styles.appearanceCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.appearanceHeader}>
              <View>
                <Text style={[styles.appearanceKicker, { color: theme.primary }]}>Appearance</Text>
                <Text style={[styles.appearanceTitle, { color: theme.text }]}>Current Theme</Text>
              </View>
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: theme.line }]}
                onPress={() => resetTheme(token)}
              >
                <RotateCcw color={theme.primary} size={17} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.84}
              style={styles.themeRow}
              onPress={() => setStudioVisible(true)}
            >
              <LinearGradient colors={theme.buttonGradient} style={styles.themeSwatch}>
                <Sparkles color="#FFFFFF" size={18} />
              </LinearGradient>
              <View style={styles.themeCopy}>
                <Text style={[styles.themeName, { color: theme.text }]}>{theme.name}</Text>
                <Text style={[styles.themeDescription, { color: theme.muted }]} numberOfLines={1}>
                  {theme.description}
                </Text>
              </View>
              <Text style={[styles.openStudio, { color: theme.primary }]}>Open</Text>
            </TouchableOpacity>
            {history.length ? (
              <View style={styles.themeHistory}>
                <Text style={[styles.historyLabel, { color: theme.muted }]}>Theme History</Text>
                <View style={styles.historyDots}>
                  {history.slice(0, 6).map((item) => (
                    <LinearGradient
                      key={item.id}
                      colors={item.buttonGradient}
                      style={styles.historyDot}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {!privateContentLocked ? (
          <>
            <View style={styles.tabs}>
              <TabButton
                active={mediaTab === 'all'}
                icon={<Grid3X3 color={mediaTab === 'all' ? palette.violet : palette.ink} size={21} />}
                onPress={() => setMediaTab('all')}
              />
              <TabButton
                active={mediaTab === 'reels'}
                icon={<Play color={mediaTab === 'reels' ? palette.violet : palette.ink} size={21} />}
                onPress={() => setMediaTab('reels')}
              />
              <TabButton
                active={mediaTab === 'photos'}
                icon={<ImageIcon color={mediaTab === 'photos' ? palette.violet : palette.ink} size={21} />}
                onPress={() => setMediaTab('photos')}
              />
              <TabButton
                active={mediaTab === 'saved'}
                icon={<Bookmark color={mediaTab === 'saved' ? palette.violet : palette.ink} size={21} />}
                onPress={() => setMediaTab('saved')}
              />
            </View>

            <View style={styles.grid}>
              {profileMedia.length ? (
                profileMedia.map((item) => (
                  <View key={item.id} style={styles.gridTile}>
                    {item.type === 'reel' ? (
                      <>
                        <AppVideo
                          uri={item.uri}
                          style={styles.gridImage}
                          shouldPlay={false}
                          isMuted
                        />
                        <View style={styles.reelPill}>
                          <Play color="#FFFFFF" fill="#FFFFFF" size={12} />
                        </View>
                      </>
                    ) : (
                      <Image source={{ uri: item.uri }} style={styles.gridImage} />
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyGrid}>
                  <Text style={styles.emptyGridTitle}>
                    {mediaTab === 'reels' ? 'No movements yet' : mediaTab === 'photos' ? 'No photos yet' : 'No vibes yet'}
                  </Text>
                  <Text style={styles.emptyGridText}>
                    {mediaTab === 'saved'
                      ? 'Saved vibes will appear here.'
                      : 'Your uploaded photos and movements will appear here.'}
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
      <VibeStudioSheet
        visible={studioVisible}
        token={token}
        onClose={() => setStudioVisible(false)}
      />
    </SafeAreaView>
  );
}

function TabButton({
  active,
  icon,
  onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      {icon}
    </TouchableOpacity>
  );
}

function Stat({
  color,
  label,
  onPress,
  tone,
  value,
}: {
  value: string;
  label: string;
  tone: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.78 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.stat, { backgroundColor: tone }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.wash,
  },
  content: {
    paddingBottom: 98,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  profileCard: {
    marginHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 16,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    padding: 4,
  },
  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  bio: {
    flex: 1,
    marginLeft: 18,
  },
  name: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
  },
  verified: {
    color: palette.blue,
  },
  handle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
  },
  copy: {
    color: palette.ink,
    fontSize: 13,
    marginTop: 4,
  },
  website: {
    color: palette.violet,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECECFA',
    overflow: 'hidden',
    marginTop: 22,
  },
  stat: {
    flex: 1,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '900',
    fontSize: 17,
  },
  statLabel: {
    fontWeight: '800',
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  edit: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    color: palette.ink,
    fontWeight: '900',
  },
  friend: {
    width: 48,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  gradientActionFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gradientActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  connectionAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9D3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionActionText: {
    color: palette.violet,
    fontWeight: '900',
  },
  connectionAccepted: {
    backgroundColor: '#EAFBF2',
    borderColor: '#BCEBD0',
  },
  connectionAcceptedText: {
    color: palette.green,
  },
  messageAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageActionText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  appearanceCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  privateCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#E4DBFF',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  privateIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  privateTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  privateText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appearanceKicker: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  appearanceTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  resetButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeSwatch: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCopy: {
    flex: 1,
    marginLeft: 12,
  },
  themeName: {
    fontSize: 15,
    fontWeight: '900',
  },
  themeDescription: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  openStudio: {
    fontSize: 12,
    fontWeight: '900',
  },
  themeHistory: {
    marginTop: 14,
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  },
  historyDots: {
    flexDirection: 'row',
    gap: 8,
  },
  historyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  shareAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareActionText: {
    color: palette.ink,
    fontWeight: '900',
  },
  tabs: {
    height: 54,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ECECFA',
    marginTop: 12,
  },
  tabButton: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: palette.violet,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  gridTile: {
    width: '33.333%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: '#F8F7FF',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E8E8F5',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  emptyGrid: {
    width: '100%',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyGridTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyGridText: {
    color: palette.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  reelPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 22, 63, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
