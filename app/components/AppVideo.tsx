import React, { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  uri: string;
  style: StyleProp<ViewStyle>;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  playbackRate?: number;
  nativeControls?: boolean;
  contentFit?: 'contain' | 'cover' | 'fill';
};

export default function AppVideo({
  uri,
  style,
  shouldPlay = false,
  isLooping = false,
  isMuted = false,
  playbackRate = 1,
  nativeControls = false,
  contentFit = 'cover',
}: Props) {
  const lastUri = useRef(uri);
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = isLooping;
    videoPlayer.muted = isMuted;
    videoPlayer.playbackRate = playbackRate;

    if (shouldPlay) {
      videoPlayer.play();
    }
  });

  useEffect(() => {
    if (lastUri.current !== uri) {
      lastUri.current = uri;
      player.replace(uri);
    }
  }, [player, uri]);

  useEffect(() => {
    player.loop = isLooping;
  }, [isLooping, player]);

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    player.playbackRate = playbackRate;
  }, [playbackRate, player]);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
      return;
    }

    player.pause();
  }, [player, shouldPlay]);

  return (
    <VideoView
      style={style}
      player={player}
      nativeControls={nativeControls}
      contentFit={contentFit}
      surfaceType="textureView"
    />
  );
}
