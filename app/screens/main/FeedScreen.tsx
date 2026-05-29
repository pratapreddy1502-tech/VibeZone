
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { resolveProfileImage } from '../../services/avatar';
import { getFeed, likePost, unlikePost } from '../../services/postApi';

interface Post {
  id: number;
  user_id: number;
  username?: string;
  profile_image?: string;
  image_url?: string;
  caption?: string;
  music?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export default function FeedScreen({ navigation }: any) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      loadFeed();
    }
  }, [currentUser]);

  const loadCurrentUser = async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (userString) {
        setCurrentUser(JSON.parse(userString));
      }
    } catch (error) {
      console.log('Error loading user:', error);
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    try {
      const data = await getFeed(currentUser.id);
      const feedPosts = Array.isArray(data) ? data : data.posts || [];
      setPosts(feedPosts);
    } catch (error) {
      console.log('Vibe Feed error:', error);
      Alert.alert('Error', 'Failed to load Vibe Feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [currentUser]);

  const handleLike = async (post: Post) => {
    if (!currentUser?.id) return;

    setPosts(prev =>
      prev.map(item => {
        if (item.id !== post.id) return item;

        const liked = !item.is_liked;

        return {
          ...item,
          is_liked: liked,
          likes_count: Math.max(
            0,
            (item.likes_count || 0) + (liked ? 1 : -1)
          ),
        };
      })
    );

    try {
      if (post.is_liked) {
        await unlikePost(post.id, currentUser.id);
      } else {
        await likePost(post.id, currentUser.id);
      }
    } catch (error) {
      loadFeed();
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: resolveProfileImage(
                item.profile_image || (item as any).avatar,
                item.user_id,
                item.username
              ),
            }}
            style={styles.avatar}
          />
          <Text style={styles.username}>
            {item.username || 'User'}
          </Text>
        </View>
      </View>

      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {item.music ? (
        <View style={styles.musicContainer}>
          <Ionicons
            name="musical-notes"
            size={16}
            color="#7c3aed"
          />
          <Text style={styles.musicText}>{item.music}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => handleLike(item)}
          style={styles.actionButton}
        >
          <Ionicons
            name={item.is_liked ? 'heart' : 'heart-outline'}
            size={26}
            color={item.is_liked ? '#ef4444' : '#111'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('Comments', {
              postId: item.id,
            })
          }
        >
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color="#111"
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.likesText}>
        {item.likes_count || 0} resonates
      </Text>

      <Text style={styles.caption}>
        <Text style={styles.username}>
          {item.username || 'User'}{' '}
        </Text>
        {item.caption || ''}
      </Text>

      <TouchableOpacity
        onPress={() =>
          navigation.navigate('Comments', {
            postId: item.id,
          })
        }
      >
        <Text style={styles.commentsText}>
          View all {item.comments_count || 0} comments
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderPost}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text>No vibes found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postCard: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  username: {
    fontWeight: 'bold',
    color: '#111',
  },
  postImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#f3f4f6',
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  musicText: {
    marginLeft: 6,
    color: '#7c3aed',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  actionButton: {
    marginRight: 16,
  },
  likesText: {
    fontWeight: '600',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  caption: {
    paddingHorizontal: 12,
    marginBottom: 6,
    color: '#111',
  },
  commentsText: {
    paddingHorizontal: 12,
    color: '#666',
    marginBottom: 12,
  },
});
