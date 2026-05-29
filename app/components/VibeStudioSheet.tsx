import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Image as ImageIcon, Moon, Palette, Sparkles, Sun, Upload, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeStore } from '../store/themeStore';
import {
  createPhotoTheme,
  darkVibeThemes,
  lightVibeThemes,
  VibeTheme,
  VibeThemeMode,
} from '../theme/vibeStudio';

type Props = {
  visible: boolean;
  token?: string | null;
  onClose: () => void;
};

type TabKey = 'light' | 'dark' | 'custom';

export default function VibeStudioSheet({ visible, token, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const currentTheme = useThemeStore((state) => state.theme);
  const applyTheme = useThemeStore((state) => state.applyTheme);
  const [activeTab, setActiveTab] = useState<TabKey>(
    currentTheme.mode === 'dark' ? 'dark' : currentTheme.mode === 'custom' ? 'custom' : 'light'
  );
  const [draftTheme, setDraftTheme] = useState(currentTheme);
  const fade = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setDraftTheme(currentTheme);
      setActiveTab(currentTheme.mode === 'dark' ? 'dark' : currentTheme.mode === 'custom' ? 'custom' : 'light');
    }
  }, [currentTheme, visible]);

  const visibleThemes = useMemo(() => {
    if (activeTab === 'dark') {
      return darkVibeThemes;
    }

    if (activeTab === 'light') {
      return lightVibeThemes;
    }

    return [];
  }, [activeTab]);

  const selectTheme = (theme: VibeTheme) => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(cardScale, {
          toValue: 0.97,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0.45,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    setDraftTheme(theme);
  };

  const uploadPhotoTheme = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const asset = result.assets[0];
    setActiveTab('custom');
    selectTheme(createPhotoTheme(asset.uri, asset.base64 || asset.uri));
  };

  const applySelectedTheme = async () => {
    await applyTheme(draftTheme, token);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Vibe Studio</Text>
            <Text style={styles.title}>Choose Your Vibe</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X color="#10163F" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <StudioTab
            active={activeTab === 'light'}
            icon={<Sun color={activeTab === 'light' ? '#FFFFFF' : '#7C3AED'} size={15} />}
            label="Light Themes"
            onPress={() => setActiveTab('light')}
          />
          <StudioTab
            active={activeTab === 'dark'}
            icon={<Moon color={activeTab === 'dark' ? '#FFFFFF' : '#7C3AED'} size={15} />}
            label="Dark Themes"
            onPress={() => setActiveTab('dark')}
          />
          <StudioTab
            active={activeTab === 'custom'}
            icon={<Palette color={activeTab === 'custom' ? '#FFFFFF' : '#7C3AED'} size={15} />}
            label="Custom"
            onPress={() => setActiveTab('custom')}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {activeTab === 'custom' ? (
            <CustomThemeCreator theme={draftTheme} onUpload={uploadPhotoTheme} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeRail}
            >
              {visibleThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  selected={draftTheme.id === theme.id}
                  theme={theme}
                  onPress={() => selectTheme(theme)}
                />
              ))}
            </ScrollView>
          )}

          <Animated.View style={[styles.previewWrap, { opacity: fade, transform: [{ scale: cardScale }] }]}>
            <LivePreview theme={draftTheme} />
          </Animated.View>
        </ScrollView>

        <TouchableOpacity activeOpacity={0.86} onPress={applySelectedTheme}>
          <LinearGradient colors={draftTheme.buttonGradient} style={styles.applyButton}>
            <Sparkles color="#FFFFFF" size={18} />
            <Text style={styles.applyText}>Apply Theme</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function StudioTab({
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
    <TouchableOpacity style={[styles.tab, active && styles.activeTab]} onPress={onPress}>
      {icon}
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ThemeCard({
  onPress,
  selected,
  theme,
}: {
  theme: VibeTheme;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.82} style={styles.themeCard} onPress={onPress}>
      <LinearGradient colors={theme.feedGradient} style={styles.themePreview}>
        <View style={[styles.themePhone, { backgroundColor: theme.background, borderColor: theme.line }]}>
          <View style={styles.themeStories}>
            {[0, 1, 2].map((item) => (
              <LinearGradient
                key={item}
                colors={theme.storyGradient}
                style={styles.themeStoryRing}
              >
                <View style={[styles.themeStoryCore, { backgroundColor: theme.surface }]} />
              </LinearGradient>
            ))}
          </View>
          <View style={[styles.themeMiniPost, { backgroundColor: theme.card }]}>
            <LinearGradient colors={theme.feedGradient} style={styles.themeMiniImage} />
            <View style={[styles.themeMiniLine, { backgroundColor: theme.primary }]} />
            <View style={[styles.themeMiniLineSmall, { backgroundColor: theme.muted }]} />
          </View>
          <View style={styles.themeNav}>
            {[0, 1, 2, 3].map((item) => (
              <View
                key={item}
                style={[
                  styles.themeNavDot,
                  { backgroundColor: item === 0 ? theme.primary : theme.muted },
                ]}
              />
            ))}
          </View>
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: theme.primary }]}>
            <Check color="#FFFFFF" size={16} strokeWidth={3} />
          </View>
        ) : null}
      </LinearGradient>
      <Text style={[styles.themeName, { color: theme.text }]}>{theme.name}</Text>
      <Text style={styles.themeDescription} numberOfLines={2}>{theme.description}</Text>
    </TouchableOpacity>
  );
}

function CustomThemeCreator({ theme, onUpload }: { theme: VibeTheme; onUpload: () => void }) {
  return (
    <View style={styles.customCard}>
      <View style={styles.customCopy}>
        <Text style={styles.customTitle}>Custom Photo Theme</Text>
        <Text style={styles.customText}>
          Upload a photo and VibeZone will generate gradients, buttons, story rings, and nav colors.
        </Text>
      </View>
      <View style={styles.photoPreview}>
        {theme.photoUri ? (
          <Image source={{ uri: theme.photoUri }} style={styles.photoImage} />
        ) : (
          <LinearGradient colors={theme.feedGradient} style={styles.photoImage}>
            <ImageIcon color="#FFFFFF" size={34} />
          </LinearGradient>
        )}
      </View>
      <TouchableOpacity style={styles.uploadButton} onPress={onUpload}>
        <Upload color="#7C3AED" size={18} />
        <Text style={styles.uploadText}>Upload Photo</Text>
      </TouchableOpacity>
      <View style={styles.extractedColors}>
        {[theme.primary, theme.secondary, theme.accent, ...theme.storyGradient].slice(0, 5).map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.colorDot, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

function LivePreview({ theme }: { theme: VibeTheme }) {
  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.livePreview, { backgroundColor: theme.background, borderColor: theme.line }]}>
      <View style={styles.previewHeader}>
        <Text style={[styles.previewLogo, { color: theme.primary }]}>VibeZone</Text>
        <View style={[styles.previewBell, { borderColor: theme.line, backgroundColor: theme.surface }]} />
      </View>
      <View style={styles.previewStories}>
        {['You', 'Aarav', 'Diya', 'Secret'].map((name) => (
          <View key={name} style={styles.previewStory}>
            <LinearGradient colors={theme.storyGradient} style={styles.previewStoryRing}>
              <View style={[styles.previewAvatar, { backgroundColor: theme.surface }]} />
            </LinearGradient>
            <Text style={[styles.previewStoryText, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.previewPost, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <View style={styles.previewUserRow}>
          <View style={[styles.previewSmallAvatar, { backgroundColor: theme.accent }]} />
          <View>
            <Text style={[styles.previewUser, { color: theme.text }]}>dreamy.lens</Text>
            <Text style={[styles.previewTime, { color: theme.muted }]}>1h ago</Text>
          </View>
        </View>
        <LinearGradient colors={theme.feedGradient} style={styles.previewImage}>
          {theme.previewImage ? <Image source={{ uri: theme.previewImage }} style={styles.previewImagePhoto} /> : null}
        </LinearGradient>
        <View style={styles.previewActions}>
          <View style={[styles.previewAction, { backgroundColor: theme.primary }]} />
          <View style={[styles.previewAction, { backgroundColor: theme.muted }]} />
          <View style={[styles.previewAction, { backgroundColor: theme.accent }]} />
        </View>
        <Text style={[styles.previewCaption, { color: theme.text }]}>Bloom with your own vibe.</Text>
      </View>
      <View style={[styles.previewNav, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        {[0, 1, 2, 3, 4].map((item) => (
          <View
            key={item}
            style={[
              styles.previewNavIcon,
              {
                backgroundColor: item === 2 ? theme.primary : isDark ? '#F8FAFC' : theme.text,
                opacity: item === 2 ? 1 : 0.72,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 24, 0.42)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DED8F5',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#10163F',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F3FF',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#F4F1FF',
  },
  activeTab: {
    backgroundColor: '#7C3AED',
  },
  tabText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '900',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scroll: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  themeRail: {
    gap: 12,
    paddingRight: 4,
  },
  themeCard: {
    width: 156,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 10,
  },
  themePreview: {
    height: 178,
    borderRadius: 18,
    padding: 10,
    overflow: 'hidden',
  },
  themePhone: {
    flex: 1,
    borderRadius: 17,
    borderWidth: 1,
    padding: 7,
  },
  themeStories: {
    flexDirection: 'row',
    gap: 5,
  },
  themeStoryRing: {
    width: 25,
    height: 25,
    borderRadius: 13,
    padding: 2,
  },
  themeStoryCore: {
    flex: 1,
    borderRadius: 11,
  },
  themeMiniPost: {
    flex: 1,
    marginTop: 8,
    borderRadius: 11,
    padding: 7,
  },
  themeMiniImage: {
    height: 68,
    borderRadius: 9,
  },
  themeMiniLine: {
    width: '70%',
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  themeMiniLineSmall: {
    width: '46%',
    height: 4,
    borderRadius: 2,
    marginTop: 5,
  },
  themeNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 7,
  },
  themeNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  check: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  themeName: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
  },
  themeDescription: {
    color: '#7A7890',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  customCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECECFA',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  customCopy: {
    marginBottom: 12,
  },
  customTitle: {
    color: '#10163F',
    fontSize: 17,
    fontWeight: '900',
  },
  customText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  photoPreview: {
    height: 158,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F3E8FF',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5D9FF',
    backgroundColor: '#FAF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  uploadText: {
    color: '#7C3AED',
    fontWeight: '900',
  },
  extractedColors: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  previewWrap: {
    marginTop: 16,
  },
  livePreview: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLogo: {
    fontSize: 20,
    fontWeight: '900',
  },
  previewBell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  previewStories: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  previewStory: {
    width: 58,
    alignItems: 'center',
  },
  previewStoryRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 2,
  },
  previewAvatar: {
    flex: 1,
    borderRadius: 18,
  },
  previewStoryText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
  },
  previewPost: {
    borderRadius: 22,
    padding: 12,
    marginTop: 14,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  previewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  previewSmallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  previewUser: {
    fontSize: 12,
    fontWeight: '900',
  },
  previewTime: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  previewImage: {
    height: 136,
    borderRadius: 18,
    marginTop: 10,
    overflow: 'hidden',
  },
  previewImagePhoto: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  previewAction: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  previewCaption: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  previewNav: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  previewNavIcon: {
    width: 17,
    height: 17,
    borderRadius: 9,
  },
  applyButton: {
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
