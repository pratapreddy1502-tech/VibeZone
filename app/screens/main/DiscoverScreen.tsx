import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SlidersHorizontal, Search } from 'lucide-react-native';

import { discoverCards, palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import { getUsers, ProfileUser } from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';

const chips = ['All', 'Trending', 'Nature', 'Art', 'Travel', 'Music'];
function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }

  return String(value);
}

export default function DiscoverScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [creators, setCreators] = useState<ProfileUser[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCreators() {
      if (!token) {
        setCreators([]);
        setLoadingCreators(false);
        return;
      }

      try {
        const data = await getUsers(token);
        if (active) {
          setCreators(data.users);
        }
      } catch {
        if (active) {
          setCreators([]);
        }
      } finally {
        if (active) {
          setLoadingCreators(false);
        }
      }
    }

    loadCreators();

    return () => {
      active = false;
    };
  }, [token]);

  const filteredCreators = creators.filter((person) =>
    person.username.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <TouchableOpacity>
            <Text style={styles.arrow}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search color="#8A91AD" size={18} />
          <TextInput
            style={styles.input}
            placeholder="Search vibes, people, places..."
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
          <Text style={styles.sectionTitle}>Trending Vibes</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        <View style={styles.cardRow}>
          {discoverCards.map((card) => (
            <TouchableOpacity key={card.title} style={styles.trendCard}>
              <Image source={{ uri: card.image }} style={styles.trendImage} />
              <View style={styles.trendOverlay} />
              <Text style={styles.trendTitle}>{card.title}</Text>
              <Text style={styles.trendMeta}>{card.meta}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Suggested Creators</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        {loadingCreators ? (
          <View style={styles.creatorLoader}>
            <ActivityIndicator color={palette.violet} />
          </View>
        ) : filteredCreators.length ? (
          filteredCreators.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.creator}
              activeOpacity={0.78}
              onPress={() => navigation.navigate('Profile', { userId: person.id })}
            >
              <Image
                source={{ uri: resolveProfileImage(person.profile_image, person.id, person.username) }}
                style={styles.creatorAvatar}
              />
              <View style={styles.creatorCopy}>
                <Text style={styles.creatorName}>@{person.username}</Text>
                <Text style={styles.creatorMeta} numberOfLines={1}>
                  {person.bio || person.full_name || 'VibeZone creator'}
                </Text>
                <Text style={styles.creatorCount}>
                  {formatCount(person.vibers_count || 0)} Vibers
                </Text>
              </View>
              <View style={styles.follow}>
                <Text style={styles.followText}>
                  {person.connection_status === 'accepted'
                    ? 'Connected'
                    : person.connection_status === 'pending'
                      ? 'Request Sent'
                      : 'View'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCreators}>
            <Text style={styles.emptyTitle}>No creators found</Text>
            <Text style={styles.emptyText}>Profiles from PostgreSQL will appear here.</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  seeAll: {
    color: palette.violet,
    fontSize: 12,
    fontWeight: '800',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trendCard: {
    flex: 1,
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 10,
  },
  trendImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  trendOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 45, 0.35)',
  },
  trendTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  trendMeta: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 2,
  },
  creator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ECECFA',
    marginBottom: 9,
  },
  creatorLoader: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  creatorCopy: {
    flex: 1,
    marginLeft: 10,
  },
  creatorName: {
    color: palette.ink,
    fontWeight: '900',
  },
  creatorMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  creatorCount: {
    color: palette.violet,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },
  follow: {
    borderWidth: 1,
    borderColor: palette.violet,
    borderRadius: 8,
    minWidth: 96,
    paddingVertical: 7,
    alignItems: 'center',
  },
  followText: {
    color: palette.violet,
    fontSize: 12,
    fontWeight: '900',
  },
  connection: {
    backgroundColor: palette.violet,
  },
  connectionText: {
    color: '#FFFFFF',
  },
  emptyCreators: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
