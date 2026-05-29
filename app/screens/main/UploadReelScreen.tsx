import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, CloudUpload, Video as VideoIcon } from 'lucide-react-native';

import AppVideo from '../../components/AppVideo';
import { palette } from '../../data/mockVibes';
import { uploadReel } from '../../services/reelApi';
import { useAuthStore } from '../../store/authStore';

type PickedVideo = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export default function UploadReelScreen({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow gallery access to upload a movement.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 90,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setVideo({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
    }
  };

  const handleUpload = async () => {
    if (!token) {
      Alert.alert('Upload Movement', 'Please log in again before uploading.');
      return;
    }

    if (!video) {
      Alert.alert('Upload Movement', 'Choose a video first.');
      return;
    }

    setLoading(true);
    try {
      await uploadReel(caption.trim() || 'Sharing my latest movement.', video.uri, token, {
        fileName: video.fileName,
        mimeType: video.mimeType,
      });
      setCaption('');
      setVideo(null);
      navigation.getParent?.()?.navigate('Reels');
    } catch (error: any) {
      Alert.alert('Upload Movement', error.message || 'Movement upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color={palette.ink} size={22} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Movement</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.picker} activeOpacity={0.86} onPress={pickVideo}>
            {video ? (
              <AppVideo
                uri={video.uri}
                style={styles.preview}
                shouldPlay
                isLooping
                isMuted
                nativeControls
              />
            ) : (
              <View style={styles.emptyPreview}>
                <VideoIcon color={palette.violet} size={38} />
                <Text style={styles.emptyTitle}>Upload Video</Text>
                <Text style={styles.emptyText}>Choose a video from your gallery</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputCard}>
            <Text style={styles.label}>Caption</Text>
            <TextInput
              style={styles.caption}
              value={caption}
              onChangeText={setCaption}
              placeholder="What's your movement about?"
              placeholderTextColor="#8A91AD"
              multiline
              maxLength={220}
            />
            <Text style={styles.counter}>{caption.length}/220</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={loading}
            onPress={handleUpload}
            style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CloudUpload color="#FFFFFF" size={20} />
                <Text style={styles.uploadText}>Upload Movement</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  container: {
    flex: 1,
  },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 18,
    paddingBottom: 104,
    gap: 16,
  },
  picker: {
    height: 430,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
  },
  preview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111827',
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8CCFF',
    margin: 14,
    borderRadius: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 14,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  caption: {
    minHeight: 94,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  counter: {
    color: palette.muted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  uploadButton: {
    height: 54,
    borderRadius: 8,
    backgroundColor: palette.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.68,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
