import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, ChevronLeft, Image as ImageIcon, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '../../data/mockVibes';
import { resolveProfileImage } from '../../services/avatar';
import { Profile, updateProfile } from '../../services/profileApi';
import { useAuthStore } from '../../store/authStore';

const BIO_LIMIT = 150;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

type SelectedImage = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

export default function EditProfileScreen({ navigation, route }: any) {
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const profile = route?.params?.profile as Profile | undefined;
  const initialProfile = profile || authUser;
  const [username, setUsername] = useState(initialProfile?.username || '');
  const [fullName, setFullName] = useState(initialProfile?.full_name || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [website, setWebsite] = useState(initialProfile?.website || '');
  const [gender, setGender] = useState(initialProfile?.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile?.date_of_birth || '');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatar = useMemo(
    () =>
      selectedImage?.uri ||
      (!removePhoto
        ? resolveProfileImage(initialProfile?.profile_image, initialProfile?.id, initialProfile?.username)
        : resolveProfileImage(null, initialProfile?.id, initialProfile?.username)),
    [initialProfile?.id, initialProfile?.profile_image, initialProfile?.username, removePhoto, selectedImage?.uri]
  );

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photos', 'Allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        name: asset.fileName || `profile-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      setRemovePhoto(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera', 'Allow camera access to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        name: asset.fileName || `profile-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      setRemovePhoto(false);
    }
  };

  const openPhotoOptions = () => {
    Alert.alert('Change Photo', 'Choose a new profile picture.', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = () => {
    const cleanUsername = username.trim();

    if (!USERNAME_PATTERN.test(cleanUsername)) {
      Alert.alert('Username', 'Username must be 3-30 characters and contain no spaces.');
      return false;
    }

    if (bio.length > BIO_LIMIT) {
      Alert.alert('Bio', 'Bio must be 150 characters or less.');
      return false;
    }

    return true;
  };

  const saveProfile = async () => {
    if (!token || !initialProfile?.id || !validate()) {
      return;
    }

    setSaving(true);

    try {
      const updatedProfile = await updateProfile(initialProfile.id, token, {
        username: username.trim(),
        full_name: fullName.trim(),
        bio,
        website: website.trim(),
        gender: gender.trim(),
        date_of_birth: dateOfBirth.trim(),
        profile_image: removePhoto ? '' : undefined,
        image: selectedImage,
      });
      const updatedUser = { ...(authUser || updatedProfile), ...updatedProfile };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setAuth(updatedUser, token);
      Alert.alert('Profile', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Edit Profile', error.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ChevronLeft color={palette.ink} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <X color={palette.ink} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.photoPanel}>
            <LinearGradient colors={['#EC4899', '#8B5CF6', '#38BDF8']} style={styles.photoRing}>
              <Image source={{ uri: avatar }} style={styles.avatar} />
            </LinearGradient>
            <TouchableOpacity style={styles.changePhoto} onPress={openPhotoOptions}>
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.changePhotoFill}>
                <Camera color="#FFFFFF" size={18} />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.photoHint}>
              <ImageIcon color={palette.violet} size={15} />
              <Text style={styles.photoHintText}>Preview updates before saving</Text>
            </View>
          </View>

          <View style={styles.form}>
            <Field label="Username">
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="pratap_07"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </Field>
            <Field label="Full Name">
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Pratap Dev"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </Field>
            <Field label="Bio" counter={`${bio.length}/${BIO_LIMIT}`}>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Building VibeZone"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={BIO_LIMIT}
                style={[styles.input, styles.bioInput]}
              />
            </Field>
            <Field label="Website">
              <TextInput
                value={website}
                onChangeText={setWebsite}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://vibezone.app"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </Field>
            <Field label="Gender">
              <TextInput
                value={gender}
                onChangeText={setGender}
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </Field>
            <Field label="Date of Birth">
              <TextInput
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </Field>
            <TouchableOpacity
              style={styles.removePhoto}
              onPress={() => {
                setSelectedImage(null);
                setRemovePhoto(true);
              }}
            >
              <Text style={styles.removePhotoText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={saving}
            onPress={saveProfile}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.saveButtonFill}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  children,
  counter,
  label,
}: {
  children: React.ReactNode;
  counter?: string;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>{label}</Text>
        {counter ? <Text style={styles.counter}>{counter}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboard: {
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
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 130,
  },
  photoPanel: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 22,
  },
  photoRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    padding: 4,
  },
  avatar: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#EEF0FA',
  },
  changePhoto: {
    marginTop: 14,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  changePhotoFill: {
    flex: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  photoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  photoHintText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    gap: 14,
  },
  field: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECFA',
    padding: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  counter: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 42,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    paddingBottom: 22,
    backgroundColor: 'rgba(248, 247, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#ECECFA',
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: palette.ink,
    fontWeight: '900',
  },
  saveButton: {
    flex: 1.3,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.23,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.72,
  },
  saveButtonFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  removePhoto: {
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removePhotoText: {
    color: '#EF4444',
    fontWeight: '900',
  },
});
