import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { clearAuthFormStorage, useAuthStore } from '../store/authStore';
import { palette } from '../data/mockVibes';
import { login } from '../services/authApi';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  React.useEffect(() => {
    clearAuthFormStorage();
  }, []);

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
        <Text style={styles.logo}>VibeZone</Text>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9BA0B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9BA0B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
    justifyContent: 'center',
    padding: 22,
  },
  logo: {
    color: palette.violet,
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 26,
  },
  form: {
    width: '100%',
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
