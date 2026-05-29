import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Play, Send } from 'lucide-react-native';

import AppVideo from './AppVideo';
import { palette } from '../data/mockVibes';

interface Props {
  userId?: number;
  username: string;
  avatar: string;
  image: string;
  videoUri?: string;
  caption: string;
  likes: number;
  comments?: number;
  shares?: number;
  place?: string;
  music?: string;
  mediaType?: 'photo' | 'reel';
  editMeta?: {
    filter?: string;
    overlayText?: string;
    musicTitle?: string;
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    muted?: boolean;
    coverUri?: string | null;
  };
  onOpenProfile?: (userId: number) => void;
}

export default function VibeCard({
  userId,
  username,
  avatar,
  image,
  videoUri,
  caption,
  likes,
  comments = 16,
  shares = 24,
  place = 'Goa, India',
  music = 'Original Audio - VibeZone',
  mediaType = 'photo',
  editMeta,
  onOpenProfile,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const isReel = mediaType === 'reel' && !!videoUri;
  const openProfile = () => {
    if (userId) {
      onOpenProfile?.(userId);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.82} onPress={openProfile} disabled={!userId}>
          <LinearGradient colors={['#EC4899', '#8B5CF6', '#38BDF8']} style={styles.avatarRing}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.82}
          style={styles.userText}
          onPress={openProfile}
          disabled={!userId}
        >
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.place}>{place}</Text>
        </TouchableOpacity>
        <MoreHorizontal color={palette.ink} size={24} />
      </View>

      <View style={styles.mediaFrame}>
        {isReel ? (
          <AppVideo
            uri={videoUri}
            style={styles.postImage}
            shouldPlay
            isLooping
            isMuted={editMeta?.muted ?? true}
            playbackRate={editMeta?.speed || 1}
            nativeControls
          />
        ) : (
          <Image source={{ uri: image }} style={styles.postImage} />
        )}
        {isReel ? (
          <View pointerEvents="none" style={styles.reelBadge}>
            <Play color="#FFFFFF" fill="#FFFFFF" size={13} />
            <Text style={styles.reelText}>Reel</Text>
          </View>
        ) : null}
        {editMeta?.overlayText ? (
          <View pointerEvents="none" style={styles.textOverlay}>
            <Text style={styles.overlayText}>{editMeta.overlayText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={() => setLiked(!liked)} style={styles.action}>
            <Heart
              color={liked ? '#FF3B6B' : palette.ink}
              fill={liked ? '#FF3B6B' : 'transparent'}
              size={27}
            />
            <Text style={styles.actionText}>{liked ? likes + 1 : likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action}>
            <MessageCircle color={palette.ink} size={25} />
            <Text style={styles.actionText}>{comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action}>
            <Send color={palette.ink} size={24} />
            <Text style={styles.actionText}>{shares}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setSaved(!saved)}>
          <Bookmark color={palette.ink} fill={saved ? palette.ink : 'transparent'} size={25} />
        </TouchableOpacity>
      </View>

      <Text style={styles.caption}>{caption}</Text>
      <Text style={styles.responses}>View all {comments} responses</Text>
      <Text style={styles.music}>{music}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ECECFA',
    marginHorizontal: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#5960A8',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    padding: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userText: {
    flex: 1,
    marginLeft: 10,
  },
  username: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 14,
  },
  place: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  mediaFrame: {
    width: '94%',
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E8E8F5',
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E8F5',
  },
  reelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17, 22, 63, 0.72)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 2,
  },
  actionText: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  caption: {
    color: palette.ink,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingTop: 12,
    lineHeight: 20,
  },
  responses: {
    color: palette.muted,
    paddingHorizontal: 14,
    paddingTop: 7,
    fontSize: 12,
  },
  music: {
    color: palette.muted,
    paddingHorizontal: 14,
    paddingTop: 5,
    paddingBottom: 14,
    fontSize: 12,
  },
});
