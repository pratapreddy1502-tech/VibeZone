import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users } from 'lucide-react-native';

import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import {
  getUserConnections,
  getUserVibers,
  Profile,
  ProfileUser,
} from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';

export default function ProfileListScreen({ navigation, route }: any) {
  const token = useAuthStore((state) => state.token);
  const profile = route?.params?.profile as Profile | undefined;
  const userId = Number(route?.params?.userId || profile?.id || 0);
  const listType = route?.params?.type === 'connections' ? 'connections' : 'vibers';
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const title = listType === 'connections' ? 'Connections' : 'Vibers';

  const loadUsers = useCallback(async (showRefresh = false) => {
    if (!token || !userId) {
      setLoading(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const data = listType === 'connections'
        ? await getUserConnections(userId, token)
        : await getUserVibers(userId, token);
      setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [listType, token, userId]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const openProfile = (nextUser: ProfileUser) => {
    navigation.push('Profile', { userId: nextUser.id });
  };
  const relationLabel = (item: ProfileUser) => {
    const value = listType === 'connections' ? item.connected_at : item.vibed_at;

    if (!value) {
      return listType === 'connections' ? 'Connected recently' : 'Vibed recently';
    }

    return `${listType === 'connections' ? 'Connected' : 'Vibed'} ${formatRelationDate(value)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={palette.ink} size={22} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>@{profile?.username || 'vibezone'}</Text>
        </View>
        <View style={styles.headerButton}>
          <Users color={palette.violet} size={20} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.violet} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadUsers(true)}
              colors={[palette.violet]}
              tintColor={palette.violet}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No {title.toLowerCase()} yet</Text>
              <Text style={styles.emptyText}>
                {listType === 'connections'
                  ? 'Accepted connections will show here.'
                  : 'People who vibe this profile will show here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.78}
              style={styles.card}
              onPress={() => openProfile(item)}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={{ uri: resolveProfileImage(item.profile_image, item.id, item.username) }}
                  style={styles.avatar}
                />
                {item.is_online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.identity}>
                <Text style={styles.username}>@{item.username}</Text>
                <Text numberOfLines={1} style={styles.bio}>
                  {relationLabel(item)}
                </Text>
              </View>
              <Text style={styles.count}>
                {listType === 'connections'
                  ? `${item.connections_count || 0} Connections`
                  : `${item.vibers_count || 0} Vibers`}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatRelationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  header: {
    height: 66,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  avatarWrap: {
    width: 54,
    height: 54,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EDEBFA',
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identity: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  bio: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  count: {
    color: palette.violet,
    fontSize: 11,
    fontWeight: '900',
  },
  empty: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});
