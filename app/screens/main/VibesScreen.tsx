import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Bell, MessageCircle, Plus, Sparkles } from 'lucide-react-native';

import StoryViewer from '../../components/StoryViewer';
import VibeStudioSheet from '../../components/VibeStudioSheet';
import VibeCard from '../../components/VibeCard';
import { useVibes } from '../../context/VibesContext';
import { palette, posts } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import { getNotifications } from '../../services/notificationApi';
import { AppVibe, getFeed } from '../../services/postApi';
import { getStoryFeed, StoryGroup, StoryItem, uploadStory } from '../../services/storyApi';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';

export default function VibesScreen({ navigation }: any) {
  const { vibes } = useVibes();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const unreadBuzz = useNotificationStore((state) => state.unreadCount);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const theme = useThemeStore((state) => state.theme);
  const loadTheme = useThemeStore((state) => state.loadTheme);
  const [remoteVibes, setRemoteVibes] = useState<AppVibe[]>([]);
  const [studioVisible, setStudioVisible] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storyUploading, setStoryUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set<number>());
  const feed = [...vibes, ...remoteVibes, ...posts];
  const viewedStoryKey = user?.id ? `vibezone:viewed-stories:${user.id}` : null;
  const myAvatar = resolveProfileImage(user?.profile_image, user?.id, user?.username);
  const storyGroupsForViewer = useMemo(() => {
    const myGroup = storyGroups.find((group) => group.user.id === user?.id);
    const otherGroups = storyGroups.filter((group) => group.user.id !== user?.id);

    return myGroup ? [myGroup, ...otherGroups] : otherGroups;
  }, [storyGroups, user?.id]);
  const myStoryGroup = storyGroupsForViewer.find((group) => group.user.id === user?.id);
  const myStoryIndex = myStoryGroup
    ? storyGroupsForViewer.findIndex((group) => group.user.id === myStoryGroup.user.id)
    : -1;

  const hasUnviewedStories = useCallback(
    (group?: StoryGroup | null) => {
      if (!group) {
        return false;
      }

      return group.stories.some((story) => !viewedStoryIds.has(story.id));
    },
    [viewedStoryIds]
  );

  const refreshStories = useCallback(async (showLoader = false) => {
    if (!token) {
      setStoryGroups([]);
      setStoriesLoading(false);
      return;
    }

    if (showLoader) {
      setStoriesLoading(true);
    }

    try {
      const groups = await getStoryFeed(token);
      setStoryGroups(groups);
    } catch {
      setStoryGroups([]);
    } finally {
      if (showLoader) {
        setStoriesLoading(false);
      }
    }
  }, [token]);

  const mergeUploadedStory = useCallback((story: StoryItem) => {
    setStoryGroups((currentGroups) => {
      const existingGroup = currentGroups.find((group) => group.user.id === story.user.id);
      const updatedGroup = {
        user: story.user,
        stories: [
          ...(existingGroup?.stories.filter((item) => item.id !== story.id) || []),
          story,
        ],
      };

      return [
        updatedGroup,
        ...currentGroups.filter((group) => group.user.id !== story.user.id),
      ];
    });
  }, []);

  const openStoryGroup = useCallback((index: number) => {
    if (index < 0) {
      return;
    }

    setViewerGroupIndex(index);
    setViewerVisible(true);
  }, []);

  const handleStoryViewed = useCallback((story: StoryItem) => {
    setViewedStoryIds((currentIds) => {
      if (currentIds.has(story.id)) {
        return currentIds;
      }

      const nextIds = new Set<number>(currentIds);
      nextIds.add(story.id);

      if (viewedStoryKey) {
        AsyncStorage.setItem(viewedStoryKey, JSON.stringify([...nextIds])).catch(() => undefined);
      }

      return nextIds;
    });
  }, [viewedStoryKey]);

  const handleAddStory = useCallback(async () => {
    if (storyUploading) {
      return;
    }

    if (!token) {
      Alert.alert('Add Story', 'Please log in again before uploading a story.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow gallery access to add a story.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
      allowsEditing: false,
      quality: 0.9,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.uri) {
      return;
    }

    setStoryUploading(true);

    try {
      const story = await uploadStory(asset.uri, token, {
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      mergeUploadedStory(story);
      void refreshStories(false);
    } catch (error) {
      Alert.alert(
        'Story Upload',
        error instanceof Error ? error.message : 'Story upload failed.'
      );
    } finally {
      setStoryUploading(false);
    }
  }, [mergeUploadedStory, refreshStories, storyUploading, token]);

  useEffect(() => {
    loadTheme(token);
  }, [loadTheme, token]);

  useEffect(() => {
    let active = true;

    if (!viewedStoryKey) {
      setViewedStoryIds(new Set<number>());
      return () => {
        active = false;
      };
    }

    AsyncStorage.getItem(viewedStoryKey)
      .then((value) => {
        if (!active || !value) {
          return;
        }

        const ids = JSON.parse(value);

        if (Array.isArray(ids)) {
          setViewedStoryIds(new Set<number>(ids.map((id) => Number(id)).filter(Boolean)));
        }
      })
      .catch(() => {
        if (active) {
          setViewedStoryIds(new Set<number>());
        }
      });

    return () => {
      active = false;
    };
  }, [viewedStoryKey]);

  useEffect(() => {
    let active = true;

    async function loadFeed() {
      if (!user?.id) {
        return;
      }

      try {
        const data = await getFeed(user.id);
        if (active) {
          setRemoteVibes(data);
        }
      } catch (error) {
        if (active) {
          setRemoteVibes([]);
        }
      }
    }

    loadFeed();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadBuzz() {
        if (!token) {
          setNotifications([], 0);
          return;
        }

        try {
          const data = await getNotifications(token);
          if (active) {
            setNotifications(data.notifications, data.unread_count);
          }
        } catch {
          if (active) {
            setNotifications([], 0);
          }
        }
      }

      loadBuzz();

      return () => {
        active = false;
      };
    }, [setNotifications, token])
  );

  useFocusEffect(
    useCallback(() => {
      refreshStories(true);
    }, [refreshStories])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LinearGradient colors={theme.buttonGradient} style={styles.logoMark}>
              <Text style={styles.logoText}>V</Text>
            </LinearGradient>
            <Text style={[styles.title, { color: theme.text }]}>VibeZone</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.studioButton, { borderColor: theme.line, backgroundColor: theme.surface }]}
              onPress={() => setStudioVisible(true)}
              activeOpacity={0.82}
            >
              <Sparkles color={theme.primary} size={15} />
              <Text style={[styles.studioText, { color: theme.primary }]}>Vibe Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Buzz')}>
              <Bell color={theme.text} size={23} />
              {unreadBuzz ? (
                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.badgeText}>{unreadBuzz > 9 ? '9+' : unreadBuzz}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Chats')}>
              <MessageCircle color={theme.text} size={23} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Fresh vibes from your world</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyRow}
        >
          <TouchableOpacity
            style={styles.story}
            activeOpacity={0.85}
            onPress={myStoryGroup ? () => openStoryGroup(myStoryIndex) : handleAddStory}
            disabled={storyUploading}
          >
            <LinearGradient
              colors={myStoryGroup && hasUnviewedStories(myStoryGroup)
                ? theme.storyGradient
                : ['#D8D8E7', '#D8D8E7']}
              style={styles.storyRing}
            >
              <Image source={{ uri: myAvatar }} style={styles.storyAvatar} />
              {storyUploading ? (
                <View style={styles.storyUploading}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              ) : null}
            </LinearGradient>
            {!myStoryGroup ? (
              <View style={[styles.storyPlusBadge, { backgroundColor: theme.primary }]}>
                <Plus color="#FFFFFF" size={14} strokeWidth={3} />
              </View>
            ) : null}
            <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
              {myStoryGroup ? 'My Story' : 'Add Story'}
            </Text>
          </TouchableOpacity>

          {storiesLoading && storyGroupsForViewer.length === 0 ? (
            <View style={styles.storyLoading}>
              <ActivityIndicator color={theme.primary} size="small" />
            </View>
          ) : null}

          {storyGroupsForViewer.map((group, index) => {
            if (group.user.id === user?.id) {
              return null;
            }

            return (
              <TouchableOpacity
                key={group.user.id}
                style={styles.story}
                activeOpacity={0.85}
                onPress={() => openStoryGroup(index)}
              >
              <LinearGradient
                colors={hasUnviewedStories(group) ? theme.storyGradient : ['#D8D8E7', '#D8D8E7']}
                style={styles.storyRing}
              >
                <Image source={{ uri: group.user.profile_image }} style={styles.storyAvatar} />
              </LinearGradient>
              <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
                {group.user.username}
              </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {feed.map((vibe) => (
          <VibeCard
            key={vibe.id}
            {...vibe}
            onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
          />
        ))}
      </ScrollView>
      <VibeStudioSheet
        visible={studioVisible}
        token={token}
        onClose={() => setStudioVisible(false)}
      />
      <StoryViewer
        visible={viewerVisible}
        groups={storyGroupsForViewer}
        initialGroupIndex={viewerGroupIndex}
        onClose={() => setViewerVisible(false)}
        onViewed={handleStoryViewed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.wash,
  },
  content: {
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 1,
  },
  studioButton: {
    minHeight: 38,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  studioText: {
    fontSize: 11,
    fontWeight: '900',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECECFA',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    right: 5,
    top: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  storyRow: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 15,
  },
  story: {
    width: 72,
    alignItems: 'center',
    position: 'relative',
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 61,
    height: 61,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storyPlusBadge: {
    position: 'absolute',
    right: 5,
    bottom: 21,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storyUploading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  storyLoading: {
    width: 72,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyName: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    maxWidth: 67,
  },
});
