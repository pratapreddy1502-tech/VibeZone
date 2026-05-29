import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye,
  Heart,
  MessageCircle,
  Music,
  Plus,
  Send,
  SlidersVertical,
  X,
} from 'lucide-react-native';

import AppVideo from '../../components/AppVideo';
import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import {
  commentReel,
  getReelComments,
  getReels,
  likeReel,
  Reel,
  ReelComment,
  shareReel,
  unlikeReel,
  viewReel,
} from '../../services/reelApi';
import { useAuthStore } from '../../store/authStore';

const { height } = Dimensions.get('window');
export default function ReelsScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [likedReels, setLikedReels] = useState<Set<number>>(new Set());
  const [commentTarget, setCommentTarget] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const viewedReels = useRef(new Set<number>());

  const selectedReel = commentTarget
    ? reels.find((reel) => reel.id === commentTarget.id) || commentTarget
    : null;

  const openUpload = () => {
    navigation.navigate('Create', { screen: 'UploadReel' });
  };
  const openProfile = (userId?: number) => {
    if (userId) {
      navigation.navigate('Profile', { userId });
    }
  };

  const updateReel = useCallback((nextReel: Reel) => {
    setReels((current) =>
      current.map((reel) => (reel.id === nextReel.id ? nextReel : reel))
    );
  }, []);

  const loadReels = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await getReels(token || undefined);
      setReels(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unable to load movements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadReels();
    }, [loadReels])
  );

  useEffect(() => {
    const reel = reels[activeIndex];

    if (!reel || viewedReels.current.has(reel.id)) {
      return;
    }

    viewedReels.current.add(reel.id);
    viewReel(reel.id, token || undefined).then(updateReel).catch(() => {});
  }, [activeIndex, reels, token, updateReel]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const nextIndex = viewableItems[0]?.index;

    if (typeof nextIndex === 'number') {
      setActiveIndex(nextIndex);
    }
  }).current;

  const handleLike = async (reel: Reel) => {
    if (!token) {
      Alert.alert('Movements', 'Please log in to resonate with movements.');
      return;
    }

    const wasLiked = likedReels.has(reel.id);
    const optimisticReel = {
      ...reel,
      likes_count: Math.max(0, reel.likes_count + (wasLiked ? -1 : 1)),
      resonates_count: Math.max(0, reel.resonates_count + (wasLiked ? -1 : 1)),
    };

    setLikedReels((current) => {
      const next = new Set(current);
      if (wasLiked) {
        next.delete(reel.id);
      } else {
        next.add(reel.id);
      }
      return next;
    });
    updateReel(optimisticReel);

    try {
      const nextReel = wasLiked
        ? await unlikeReel(reel.id, token)
        : await likeReel(reel.id, token);
      updateReel(nextReel);
    } catch (err: any) {
      updateReel(reel);
      if (String(err.message).includes('already resonated')) {
        setLikedReels((current) => new Set(current).add(reel.id));
        return;
      }

      setLikedReels((current) => {
        const next = new Set(current);
        if (wasLiked) {
          next.add(reel.id);
        } else {
          next.delete(reel.id);
        }
        return next;
      });
      Alert.alert('Movements', err.message || 'Could not update resonate.');
    }
  };

  const openComments = async (reel: Reel) => {
    setCommentTarget(reel);
    setCommentText('');
    setComments([]);
    setCommentsLoading(true);

    try {
      setComments(await getReelComments(reel.id, token || undefined));
    } catch (err: any) {
      Alert.alert('Responses', err.message || 'Could not load responses.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!selectedReel || !commentText.trim()) {
      return;
    }

    if (!token) {
      Alert.alert('Responses', 'Please log in to respond to movements.');
      return;
    }

    setSendingComment(true);
    try {
      const result = await commentReel(selectedReel.id, commentText.trim(), token);
      setComments((current) => [...current, result.comment]);
      updateReel(result.reel);
      setCommentText('');
    } catch (err: any) {
      Alert.alert('Responses', err.message || 'Could not send response.');
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async (reel: Reel) => {
    try {
      const result = await Share.share({
        title: 'VibeZone Movement',
        message: `${reel.caption || 'Watch this VibeZone movement'}\n${reel.video_url}`,
        url: reel.video_url,
      });

      if (result.action === Share.sharedAction) {
        updateReel(await shareReel(reel.id, token || undefined));
      }
    } catch (err: any) {
      Alert.alert('Share Movement', err.message || 'Could not share this movement.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.title}>Movements</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topButton} onPress={openUpload}>
            <Plus color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topButton}>
            <SlidersVertical color="#FFFFFF" size={23} />
          </TouchableOpacity>
        </View>
      </View>

      {reels.length ? (
        <FlatList
          data={reels}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item}
              shouldPlay={activeIndex === index}
              liked={likedReels.has(item.id)}
              onLike={() => handleLike(item)}
              onComment={() => openComments(item)}
              onOpenProfile={openProfile}
              onShare={() => handleShare(item)}
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          refreshControl={
            <RefreshControl
              tintColor="#FFFFFF"
              refreshing={refreshing}
              onRefresh={() => loadReels(true)}
            />
          }
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No movements yet</Text>
          <Text style={styles.emptyText}>{error || 'Upload the first VibeZone movement.'}</Text>
          {error ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => loadReels(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.emptyButton} onPress={openUpload}>
            <Plus color="#FFFFFF" size={20} />
            <Text style={styles.emptyButtonText}>Create Movement</Text>
          </TouchableOpacity>
        </View>
      )}

      <CommentsSheet
        comments={comments}
        commentsLoading={commentsLoading}
        commentText={commentText}
        reel={selectedReel}
        sendingComment={sendingComment}
        onChangeComment={setCommentText}
        onClose={() => setCommentTarget(null)}
        onOpenProfile={openProfile}
        onSubmit={submitComment}
      />
    </SafeAreaView>
  );
}

function ReelItem({
  liked,
  onComment,
  onLike,
  onOpenProfile,
  onShare,
  reel,
  shouldPlay,
}: {
  reel: Reel;
  shouldPlay: boolean;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onOpenProfile: (userId?: number) => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.reelPage}>
      <AppVideo
        uri={reel.video_url}
        style={styles.video}
        shouldPlay={shouldPlay}
        isLooping
      />
      <View style={styles.overlay} />

      <View style={styles.actions}>
        <Action
          icon={<Heart color="#FFFFFF" fill={liked ? '#FF4D7D' : 'transparent'} size={31} />}
          label={formatCount(reel.likes_count)}
          active={liked}
          onPress={onLike}
        />
        <Action
          icon={<MessageCircle color="#FFFFFF" size={30} />}
          label={formatCount(reel.comments_count)}
          onPress={onComment}
        />
        <Action
          icon={<Send color="#FFFFFF" size={29} />}
          label={formatCount(reel.shares_count)}
          onPress={onShare}
        />
        <View style={styles.viewCount}>
          <Eye color="#FFFFFF" size={22} />
          <Text style={styles.actionText}>{formatCount(reel.views_count)}</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.userRow}
          activeOpacity={0.82}
          onPress={() => onOpenProfile(reel.user_id)}
        >
          <Image
            source={{
              uri: resolveProfileImage(reel.profile_image, reel.user_id, reel.username),
            }}
            style={styles.avatar}
          />
          <Text style={styles.handle}>@{reel.username}</Text>
          <TouchableOpacity style={styles.vibeButton}>
            <Text style={styles.vibeText}>Vibe</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        <Text style={styles.caption}>{reel.caption || 'Sharing a new movement.'}</Text>
        <View style={styles.music}>
          <Music color="#FFFFFF" size={15} />
          <Text style={styles.musicText}>Original Audio - {reel.username}</Text>
        </View>
      </View>
    </View>
  );
}

function Action({
  active = false,
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.76}>
      <View style={[styles.actionIcon, active && styles.actionIconActive]}>{icon}</View>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function CommentsSheet({
  comments,
  commentsLoading,
  commentText,
  onChangeComment,
  onClose,
  onOpenProfile,
  onSubmit,
  reel,
  sendingComment,
}: {
  reel: Reel | null;
  comments: ReelComment[];
  commentsLoading: boolean;
  commentText: string;
  sendingComment: boolean;
  onChangeComment: (value: string) => void;
  onClose: () => void;
  onOpenProfile: (userId?: number) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={!!reel} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {formatCount(reel?.comments_count || 0)} Responses
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X color={palette.ink} size={21} />
            </TouchableOpacity>
          </View>

          {commentsLoading ? (
            <ActivityIndicator color={palette.violet} style={styles.commentLoader} />
          ) : comments.length ? (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              style={styles.commentList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.commentRow}
                  activeOpacity={0.78}
                  onPress={() => onOpenProfile(item.user_id)}
                >
                  <Image
                    source={{ uri: resolveProfileImage(item.profile_image, item.user_id, item.username) }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUser}>@{item.username}</Text>
                    <Text style={styles.commentBody}>{item.text}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsTitle}>No responses yet</Text>
              <Text style={styles.noCommentsText}>Start the conversation on this movement.</Text>
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={onChangeComment}
              placeholder="Add a response..."
              placeholderTextColor="#8A91AD"
              style={styles.commentInput}
              multiline
              maxLength={180}
            />
            <TouchableOpacity
              style={[
                styles.sendCommentButton,
                (!commentText.trim() || sendingComment) && styles.sendCommentButtonDisabled,
              ]}
              disabled={!commentText.trim() || sendingComment}
              onPress={onSubmit}
            >
              {sendingComment ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Send color="#FFFFFF" size={18} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatCount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return String(value);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  reelPage: {
    height,
    backgroundColor: '#000000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 30, 0.18)',
  },
  actions: {
    position: 'absolute',
    right: 14,
    bottom: 132,
    alignItems: 'center',
    gap: 17,
  },
  action: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconActive: {
    transform: [{ scale: 1.06 }],
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  viewCount: {
    alignItems: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 18,
    right: 82,
    bottom: 88,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  handle: {
    color: '#FFFFFF',
    fontWeight: '900',
    marginLeft: 9,
  },
  vibeButton: {
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },
  vibeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  caption: {
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 21,
  },
  music: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
  },
  musicText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  empty: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: '#D4D7E5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  emptyButton: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: palette.violet,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButton: {
    height: 42,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  retryButtonText: {
    color: palette.ink,
    fontWeight: '900',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '72%',
    minHeight: 360,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 14,
  },
  sheetHeader: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F2FF',
  },
  commentLoader: {
    marginTop: 42,
  },
  commentList: {
    flexGrow: 0,
    paddingHorizontal: 16,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8E8F5',
  },
  commentBubble: {
    flex: 1,
  },
  commentUser: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 13,
  },
  commentBody: {
    color: palette.ink,
    lineHeight: 19,
    marginTop: 3,
  },
  noComments: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noCommentsTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  noCommentsText: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ECECFA',
  },
  commentInput: {
    flex: 1,
    maxHeight: 92,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E4F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  sendCommentButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violet,
  },
  sendCommentButtonDisabled: {
    opacity: 0.55,
  },
});
