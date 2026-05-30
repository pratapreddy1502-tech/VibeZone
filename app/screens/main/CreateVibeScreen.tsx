import React, { useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  AtSign,
  CloudUpload,
  Gauge,
  Image as ImageIcon,
  MapPin,
  Music,
  Palette,
  Plus,
  Scissors,
  Type,
  Video as VideoIcon,
  VolumeX,
  X,
} from 'lucide-react-native';

import AppVideo from '../../components/AppVideo';
import { useVibes } from '../../context/VibesContext';
import { palette } from '../../data/mockVibes';
import { uploadPost } from '../../services/postApi';
import { reelToVibe, uploadReel } from '../../services/reelApi';
import {
  isSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type CreateMode = 'photo' | 'reel';

const filterOptions = [
  { name: 'Original', tint: 'transparent', opacity: 0 },
  { name: 'Glow', tint: '#FBCFE8', opacity: 0.18 },
  { name: 'Vivid', tint: '#38BDF8', opacity: 0.16 },
  { name: 'Warm', tint: '#F59E0B', opacity: 0.14 },
  { name: 'Noir', tint: '#111827', opacity: 0.24 },
];

const speedOptions = [0.5, 1, 1.5, 2];

export default function CreateVibeScreen({ navigation }: any) {
  const { addVibe } = useVibes();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [mode, setMode] = useState<CreateMode>('photo');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [highlight, setHighlight] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(filterOptions[0]);
  const [overlayText, setOverlayText] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);

  const isReel = mode === 'reel';
  const previewLabel = isReel ? 'Choose movement video' : 'Choose image';
  const filterStyle = useMemo(
    () => ({
      backgroundColor: selectedFilter.tint,
      opacity: selectedFilter.opacity,
    }),
    [selectedFilter]
  );

  const resetEditor = (nextMode = mode) => {
    setMode(nextMode);
    setMediaUri(null);
    setMediaFileName(null);
    setMediaMimeType(null);
    setCoverUri(null);
    setOverlayText('');
    setMusicTitle('');
    setTrimStart(0);
    setTrimEnd(15);
    setSpeed(1);
    setMuted(false);
    setSelectedFilter(filterOptions[0]);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow access to your gallery.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isReel ? ['videos'] : ['images'],
      allowsEditing: !isReel,
      quality: 1,
      videoMaxDuration: 90,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaFileName(asset.fileName ?? null);
      setMediaMimeType(asset.mimeType ?? null);
      if (!isReel) {
        setCoverUri(null);
      }
    }
  };

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const handleTrimStep = (field: 'start' | 'end', amount: number) => {
    if (field === 'start') {
      setTrimStart((current) => Math.max(0, Math.min(current + amount, trimEnd - 1)));
      return;
    }

    setTrimEnd((current) => Math.max(trimStart + 1, Math.min(current + amount, 90)));
  };

  const handlePublish = async () => {
    if (!mediaUri) {
      Alert.alert('Create Vibe', isReel ? 'Choose a movement video first.' : 'Choose a photo first.');
      return;
    }

    setPublishing(true);
    try {
      const finalCaption = caption.trim() || (isReel ? 'Sharing my latest movement.' : 'Sharing my latest vibe.');
      const finalMusic = musicTitle.trim() || `Original Audio - ${user?.username || 'VibeZone'}`;

      if (!token) {
        Alert.alert('Create Vibe', 'Please log in again before uploading.');
        return;
      }

      const uploaded = isReel
        ? reelToVibe(
            await uploadReel(finalCaption, mediaUri, token, {
              fileName: mediaFileName,
              mimeType: mediaMimeType,
            })
          )
        : await uploadPost(finalCaption, mediaUri, token, {
            fileName: mediaFileName,
            mimeType: mediaMimeType,
          });

      addVibe({
        ...uploaded,
        image: isReel ? coverUri || uploaded.image : uploaded.image,
        videoUri: isReel ? uploaded.videoUri : undefined,
        music: finalMusic,
        mediaType: mode,
        editMeta: {
          filter: selectedFilter.name,
          overlayText,
          musicTitle: finalMusic,
          trimStart,
          trimEnd,
          speed,
          muted,
          coverUri,
        },
      });

      setCaption('');
      resetEditor(mode);
      const parentNavigation = navigation.getParent?.();
      if (parentNavigation) {
        parentNavigation.navigate(isReel ? 'Reels' : 'Vibes');
      } else {
        navigation.navigate(isReel ? 'Reels' : 'Vibes');
      }
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        await AsyncStorage.multiRemove(['token', 'user']);
        logout();
        Alert.alert('Create Vibe', SESSION_EXPIRED_MESSAGE);
        return;
      }

      Alert.alert('Create Vibe', error.message || 'Upload failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => resetEditor(mode)}>
          <X color={palette.ink} size={23} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Vibe</Text>
        <TouchableOpacity onPress={handlePublish} disabled={publishing}>
          {publishing ? (
            <ActivityIndicator color={palette.violet} />
          ) : (
            <Text style={styles.next}>Next</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.quickGrid}>
          <QuickOption
            icon={<VideoIcon color={palette.violet} size={22} />}
            label="Upload Movement"
            onPress={() => resetEditor('reel')}
          />
          <QuickOption
            icon={<ImageIcon color={palette.violet} size={22} />}
            label="Create Post"
            onPress={() => resetEditor('photo')}
          />
          <QuickOption
            icon={<Plus color={palette.violet} size={22} />}
            label="Upload Story"
            onPress={() => resetEditor('photo')}
          />
          <QuickOption
            icon={<AtSign color={palette.violet} size={22} />}
            label="Start Live"
            onPress={() => Alert.alert('Live', 'Live creation is coming soon.')}
          />
        </View>

        <View style={styles.segment}>
          <ModeButton
            active={mode === 'photo'}
            label="Photo"
            icon={<ImageIcon color={mode === 'photo' ? '#FFFFFF' : palette.ink} size={18} />}
            onPress={() => resetEditor('photo')}
          />
          <ModeButton
            active={mode === 'reel'}
            label="Movement"
            icon={<VideoIcon color={mode === 'reel' ? '#FFFFFF' : palette.ink} size={18} />}
            onPress={() => resetEditor('reel')}
          />
        </View>

        <TouchableOpacity style={styles.upload} onPress={pickMedia} activeOpacity={0.85}>
          {mediaUri ? (
            <View style={styles.previewWrap}>
              {isReel ? (
                <AppVideo
                  uri={mediaUri}
                  style={styles.preview}
                  shouldPlay
                  isLooping
                  isMuted={muted}
                  playbackRate={speed}
                />
              ) : (
                <Image source={{ uri: mediaUri }} style={styles.preview} />
              )}
              <View pointerEvents="none" style={[styles.filterOverlay, filterStyle]} />
              {overlayText ? (
                <View pointerEvents="none" style={styles.textOverlay}>
                  <Text style={styles.overlayText}>{overlayText}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.uploadInner}>
              <CloudUpload color={palette.violet} size={56} strokeWidth={1.8} />
              <Text style={styles.uploadTitle}>{previewLabel}</Text>
              <Text style={styles.uploadMeta}>{isReel ? 'MP4 / MOV up to 90s' : 'PNG / JPG'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <EditorSection icon={<Palette color={palette.violet} size={20} />} title="Filters">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filterOptions.map((filter) => (
              <TouchableOpacity
                key={filter.name}
                style={[styles.filterChip, selectedFilter.name === filter.name && styles.activeChip]}
                onPress={() => setSelectedFilter(filter)}
              >
                <View style={[styles.swatch, { backgroundColor: filter.tint === 'transparent' ? '#FFFFFF' : filter.tint }]} />
                <Text style={[styles.filterText, selectedFilter.name === filter.name && styles.activeText]}>
                  {filter.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </EditorSection>

        {isReel ? (
          <>
            <EditorSection icon={<Scissors color={palette.violet} size={20} />} title="Trim Video">
              <View style={styles.trimRow}>
                <Stepper label="Start" value={`${trimStart}s`} onMinus={() => handleTrimStep('start', -1)} onPlus={() => handleTrimStep('start', 1)} />
                <Stepper label="End" value={`${trimEnd}s`} onMinus={() => handleTrimStep('end', -1)} onPlus={() => handleTrimStep('end', 1)} />
              </View>
              <Text style={styles.hint}>Selected clip: {trimEnd - trimStart}s</Text>
            </EditorSection>

            <EditorSection icon={<Music color={palette.violet} size={20} />} title="Add Music">
              <TextInput
                style={styles.singleInput}
                placeholder="Song or audio name"
                placeholderTextColor="#8A91AD"
                value={musicTitle}
                onChangeText={setMusicTitle}
              />
            </EditorSection>

            <EditorSection icon={<Type color={palette.violet} size={20} />} title="Text Overlay">
              <TextInput
                style={styles.singleInput}
                placeholder="Add text on your movement"
                placeholderTextColor="#8A91AD"
                value={overlayText}
                onChangeText={setOverlayText}
                maxLength={45}
              />
            </EditorSection>

            <EditorSection icon={<ImageIcon color={palette.violet} size={20} />} title="Cover Image">
              <View style={styles.coverRow}>
                <TouchableOpacity style={styles.coverButton} onPress={pickCover}>
                  <Text style={styles.coverButtonText}>{coverUri ? 'Change Cover' : 'Choose Cover'}</Text>
                </TouchableOpacity>
                {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverThumb} /> : null}
              </View>
            </EditorSection>

            <EditorSection icon={<Gauge color={palette.violet} size={20} />} title="Speed Control">
              <View style={styles.speedRow}>
                {speedOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.speedChip, speed === option && styles.activeChip]}
                    onPress={() => setSpeed(option)}
                  >
                    <Text style={[styles.speedText, speed === option && styles.activeText]}>{option}x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </EditorSection>

            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <VolumeX color={palette.ink} size={21} />
                <Text style={styles.optionText}>Mute Original Audio</Text>
              </View>
              <Switch
                value={muted}
                onValueChange={setMuted}
                trackColor={{ true: palette.violet, false: '#E4E6F2' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </>
        ) : null}

        <View style={styles.captionBox}>
          <TextInput
            style={styles.caption}
            placeholder="What's on your mind?"
            placeholderTextColor="#8A91AD"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={250}
          />
          <Text style={styles.counter}>{caption.length}/250</Text>
        </View>

        <Row icon={<MapPin color={palette.ink} size={21} />} label="Add Location" />
        <Row icon={<AtSign color={palette.ink} size={21} />} label="Tag People" />
        <View style={styles.optionRow}>
          <View style={styles.optionLeft}>
            <Plus color={palette.ink} size={21} />
            <Text style={styles.optionText}>Add to Highlights</Text>
          </View>
          <Switch
            value={highlight}
            onValueChange={setHighlight}
            trackColor={{ true: palette.violet, false: '#E4E6F2' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.modeButton, active && styles.activeMode]} onPress={onPress}>
      {icon}
      <Text style={[styles.modeText, active && styles.activeModeText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickOption({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickOption} activeOpacity={0.82} onPress={onPress}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function EditorSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.editorSection}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
  value,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  value: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepperButton} onPress={onMinus}>
          <Text style={styles.stepperSymbol}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity style={styles.stepperButton} onPress={onPlus}>
          <Text style={styles.stepperSymbol}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <TouchableOpacity style={styles.optionRow}>
      <View style={styles.optionLeft}>
        {icon}
        <Text style={styles.optionText}>{label}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.wash,
    paddingHorizontal: 18,
  },
  content: {
    paddingBottom: 112,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  next: {
    color: palette.violet,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  quickOption: {
    width: '48.5%',
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 12,
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    color: palette.ink,
    fontWeight: '900',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeMode: {
    backgroundColor: palette.violet,
  },
  modeText: {
    color: palette.ink,
    fontWeight: '900',
  },
  activeModeText: {
    color: '#FFFFFF',
  },
  upload: {
    height: 250,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#DCCEFF',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadInner: {
    alignItems: 'center',
  },
  previewWrap: {
    width: '100%',
    height: '100%',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  uploadTitle: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 16,
    marginTop: 14,
  },
  uploadMeta: {
    color: palette.muted,
    fontWeight: '700',
    marginTop: 5,
  },
  editorSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    borderRadius: 18,
    padding: 12,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  sectionTitle: {
    color: palette.ink,
    fontWeight: '900',
  },
  filterRow: {
    gap: 9,
  },
  filterChip: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7F2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  activeChip: {
    backgroundColor: palette.violet,
    borderColor: palette.violet,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7DAEA',
  },
  filterText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  activeText: {
    color: '#FFFFFF',
  },
  trimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flex: 1,
  },
  stepperLabel: {
    color: palette.muted,
    fontWeight: '800',
    marginBottom: 6,
  },
  stepperControls: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7F2',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    color: palette.violet,
    fontWeight: '900',
    fontSize: 17,
  },
  stepperValue: {
    color: palette.ink,
    fontWeight: '900',
  },
  hint: {
    color: palette.muted,
    fontWeight: '700',
    marginTop: 9,
  },
  singleInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7F2',
    color: palette.ink,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coverButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F1EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverButtonText: {
    color: palette.violet,
    fontWeight: '900',
  },
  coverThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speedChip: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    color: palette.ink,
    fontWeight: '900',
  },
  captionBox: {
    minHeight: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7F2',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginTop: 12,
  },
  caption: {
    flex: 1,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  counter: {
    color: palette.muted,
    fontSize: 11,
    textAlign: 'right',
  },
  optionRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECFA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    flex: 1,
    paddingRight: 12,
  },
  optionText: {
    color: palette.ink,
    fontWeight: '700',
  },
  chevron: {
    color: palette.muted,
    fontSize: 25,
  },
});
