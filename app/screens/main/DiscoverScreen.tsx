import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';

import AppVideo from '../../components/AppVideo';
import { palette } from '../../data/mockVibes';
import { getReels, Reel } from '../../services/reelApi';
import { useAuthStore } from '../../store/authStore';

const chips = ['All', 'Recent', 'Popular'];

export default function DiscoverScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [query, setQuery] = useState('');
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const openCreate = () => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('Create');
      return;
    }

    navigation.navigate('Create');
  };

  const openReels = () => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('Reels');
      return;
    }

    navigation.navigate('Reels');
  };

  useEffect(() => {
    let active = true;

    async function loadReels() {
      setLoading(true);

      try {
        const data = await getReels(token || undefined);

        if (active) {
          setReels(data);
        }
      } catch {
        if (active) {
          setReels([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReels();

    return () => {
      active = false;
    };
  }, [token]);

  const filteredReels = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return reels;
    }

    return reels.filter((reel) =>
      `${reel.username} ${reel.caption}`.toLowerCase().includes(value)
    );
  }, [query, reels]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={openCreate}
          >
            <Text style={styles.arrow}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search color="#8A91AD" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Search videos..."
            placeholderTextColor="#8A91AD"
            value={query}
            onChangeText={setQuery}
          />
          <SlidersHorizontal color={palette.blue} size={19} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((chip, index) => (
            <TouchableOpacity key={chip} style={[styles.chip, index === 0 && styles.activeChip]}>
              <Text style={[styles.chipText, index === 0 && styles.activeChipText]}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Videos</Text>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={palette.violet} />
          </View>
        ) : filteredReels.length ? (
          <View style={styles.videoGrid}>
            {filteredReels.map((reel) => (
              <TouchableOpacity
                key={reel.id}
                style={styles.videoCard}
                activeOpacity={0.88}
                onPress={openReels}
              >
                <AppVideo
                  uri={reel.video_url}
                  style={styles.video}
                  shouldPlay={false}
                  isLooping
                  isMuted
                />
                <View style={styles.videoShade} />
                <View style={styles.videoCopy}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {reel.caption || 'Untitled reel'}
                  </Text>
                  <Text style={styles.videoMeta} numberOfLines={1}>
                    @{reel.username}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyText}>Upload your first reel</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  content: {
    padding: 18,
    paddingBottom: 98,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '900',
  },
  arrow: {
    color: palette.ink,
    fontSize: 22,
  },
  searchBox: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 9,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 13,
  },
  chips: {
    gap: 9,
    paddingVertical: 14,
  },
  chip: {
    height: 30,
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: '#ECEEF8',
    justifyContent: 'center',
  },
  activeChip: {
    backgroundColor: palette.violet,
  },
  chipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  activeChipText: {
    color: '#FFFFFF',
  },
  rowHeader: {
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  loader: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoGrid: {
    gap: 12,
  },
  videoCard: {
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 40, 0.24)',
  },
  videoCopy: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  videoMeta: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  emptyState: {
    minHeight: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECECFA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
});
