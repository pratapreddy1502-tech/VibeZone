import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Lock, Mail, Sparkles } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { palette } from '../data/mockVibes';
import { login } from '../services/authApi';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('pratap@vibezone.app');
  const [password, setPassword] = useState('vibezone');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Login Failed', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await login({
        email: email.trim(),
        password,
      });
      const token = response.token || response.access_token;
      const user = response.user;

      if (!token || !user) {
        throw new Error('Login response did not include a token and user.');
      }

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setAuth(user, token);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Please try again.');
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
        <View style={styles.hero}>
          <View style={styles.blobOne} />
          <View style={styles.blobTwo} />
          <Sparkles color="#8B5CF6" size={24} style={styles.sparkle} />
          <Text style={styles.logo}>VibeZone</Text>
          <Text style={styles.tagline}>Share your vibe. Connect your world.</Text>
          <View style={styles.avatarRow}>
            {[
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
            ].map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.miniAvatar} />
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.smallTitle}>Login</Text>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Login to continue your vibe</Text>

          <View style={styles.inputWrap}>
            <Mail color="#8A91AD" size={18} />
            <TextInput
              style={styles.input}
              placeholder="Email or Username"
              placeholderTextColor="#9BA0B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <Lock color="#8A91AD" size={18} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9BA0B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Eye color="#8A91AD" size={18} />
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.loginButton}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginText}>Log In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footer}>New here? <Text style={styles.link}>Create Account</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F6FF',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 18,
  },
  hero: {
    minHeight: 270,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECE8FF',
  },
  blobOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#DDD6FE',
    top: -70,
    left: -45,
  },
  blobTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#FBCFE8',
    bottom: -85,
    right: -70,
  },
  sparkle: {
    position: 'absolute',
    top: 30,
    right: 30,
  },
  logo: {
    color: palette.violet,
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  tagline: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginLeft: -6,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ECECFA',
  },
  smallTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 18,
  },
  title: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    marginTop: 5,
    marginBottom: 22,
  },
  inputWrap: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E1E4F2',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
  },
  loginButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  footer: {
    color: palette.muted,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  link: {
    color: palette.blue,
  },
});
