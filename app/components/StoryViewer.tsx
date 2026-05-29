import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import AppVideo from './AppVideo';
import { StoryGroup, StoryItem } from '../services/storyApi';

const IMAGE_DURATION_MS = 5000;
const VIDEO_DURATION_MS = 8000;

type Props = {
  visible: boolean;
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onViewed: (story: StoryItem) => void;
};

function storyDuration(story?: StoryItem | null) {
  return story?.media_type === 'video' ? VIDEO_DURATION_MS : IMAGE_DURATION_MS;
}

function formatStoryAge(value?: string | null) {
  if (!value) {
    return 'now';
  }

  const createdAt = new Date(value).getTime();

  if (Number.isNaN(createdAt)) {
    return 'now';
  }

  const seconds = Math.max(1, Math.floor((Date.now() - createdAt) / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

export default function StoryViewer({
  visible,
  groups,
  initialGroupIndex,
  onClose,
  onViewed,
}: Props) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentProgressRef = useRef(0);
  const longPressRef = useRef(false);
  const screenWidth = Dimensions.get('window').width;
  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      currentProgressRef.current = value;
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

  const stopAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const goNext = useCallback(() => {
    stopAnimation();

    if (!groups.length) {
      onClose();
      return;
    }

    const group = groups[groupIndex];

    if (group && storyIndex < group.stories.length - 1) {
      setStoryIndex((value) => value + 1);
      return;
    }

    if (groupIndex < groups.length - 1) {
      setGroupIndex((value) => value + 1);
      setStoryIndex(0);
      return;
    }

    onClose();
  }, [groupIndex, groups, onClose, stopAnimation, storyIndex]);

  const goPrevious = useCallback(() => {
    stopAnimation();

    if (storyIndex > 0) {
      setStoryIndex((value) => value - 1);
      return;
    }

    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex((value) => value - 1);
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1));
      return;
    }

    progress.setValue(0);
    currentProgressRef.current = 0;
  }, [groupIndex, groups, progress, stopAnimation, storyIndex]);

  const startProgress = useCallback((from = 0) => {
    if (!currentStory) {
      return;
    }

    stopAnimation();
    progress.setValue(from);
    const duration = Math.max(250, storyDuration(currentStory) * (1 - from));
    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    animationRef.current.start(({ finished }) => {
      if (finished) {
        goNext();
      }
    });
  }, [currentStory, goNext, progress, stopAnimation]);

  const pauseProgress = useCallback(() => {
    if (!currentStory) {
      return;
    }

    longPressRef.current = false;
    progress.stopAnimation((value) => {
      currentProgressRef.current = value;
      setPaused(true);
    });
  }, [currentStory, progress]);

  const resumeProgress = useCallback(() => {
    if (!currentStory) {
      return;
    }

    setPaused(false);
    startProgress(currentProgressRef.current);
  }, [currentStory, startProgress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 22 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: pauseProgress,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90) {
            onClose();
            return;
          }

          resumeProgress();
        },
        onPanResponderTerminate: resumeProgress,
      }),
    [onClose, pauseProgress, resumeProgress]
  );

  useEffect(() => {
    if (!visible) {
      stopAnimation();
      return;
    }

    setGroupIndex(Math.max(0, Math.min(initialGroupIndex, groups.length - 1)));
    setStoryIndex(0);
    setPaused(false);
    progress.setValue(0);
    currentProgressRef.current = 0;
  }, [groups.length, initialGroupIndex, progress, stopAnimation, visible]);

  useEffect(() => {
    if (!visible || !currentStory) {
      return;
    }

    onViewed(currentStory);
    setPaused(false);
    currentProgressRef.current = 0;
    startProgress(0);

    return stopAnimation;
  }, [currentStory, onViewed, startProgress, stopAnimation, visible]);

  if (!currentGroup || !currentStory) {
    return null;
  }

  const handlePress = (event: any) => {
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }

    if (event.nativeEvent.locationX < screenWidth * 0.38) {
      goPrevious();
      return;
    }

    goNext();
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container} {...panResponder.panHandlers}>
        {currentStory.media_type === 'video' ? (
          <AppVideo
            uri={currentStory.media_url}
            style={styles.media}
            shouldPlay={visible && !paused}
            isLooping={false}
            isMuted={false}
            contentFit="cover"
          />
        ) : (
          <Image source={{ uri: currentStory.media_url }} style={styles.media} resizeMode="cover" />
        )}

        <View style={styles.scrim} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={pauseProgress}
          onLongPress={() => {
            longPressRef.current = true;
          }}
          onPressOut={resumeProgress}
          onPress={handlePress}
        />
        <View style={styles.topChrome}>
          <View style={styles.progressRow}>
            {currentGroup.stories.map((story, index) => (
              <View key={story.id} style={styles.progressTrack}>
                {index < storyIndex ? <View style={styles.progressFillComplete} /> : null}
                {index === storyIndex ? (
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.header}>
            <Image source={{ uri: currentGroup.user.profile_image }} style={styles.avatar} />
            <View style={styles.userText}>
              <Text style={styles.username} numberOfLines={1}>
                {currentGroup.user.username}
              </Text>
              <Text style={styles.age}>{formatStoryAge(currentStory.created_at)}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <X color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {currentStory.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.caption}>{currentStory.caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05020A',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  topChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 14,
    paddingTop: 42,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  progressFillComplete: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  userText: {
    flex: 1,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  age: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  captionWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 42,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
});
