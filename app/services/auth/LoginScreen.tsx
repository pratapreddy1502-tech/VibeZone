// app/screens/auth/LoginScreen.tsx

// app/screens/auth/LoginScreen.tsx

// app/screens/auth/LoginScreen.tsx

import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

import { login } from '../../services/authApi';

export default function LoginScreen({
  navigation,
}: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');
  const [loading, setLoading] =
    useState(false);

  const handleLogin = async () => {
    console.log('Login button pressed');

    if (
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        'Error',
        'Please enter email and password'
      );
      return;
    }

    try {
      setLoading(true);

      console.log('Calling login API...');

      const response = await login({
        email,
        password,
      });

      console.log(
        'Login response:',
        response
      );

      const token =
        response.token ||
        response.access_token;

      const user =
        response.user || {
          id: response.user_id,
          username: response.username,
          email: response.email,
        };

      if (!token) {
        Alert.alert(
          'Error',
          'Token not found in response'
        );
        return;
      }

      // Save token and user
      await AsyncStorage.setItem(
        'token',
        token
      );
      await AsyncStorage.setItem(
        'user',
        JSON.stringify(user)
      );

      Alert.alert(
        'Success',
        'Login successful'
      );

      // Reload the app so App.tsx
      // detects the token
      await Updates.reloadAsync();
    } catch (error: any) {
      console.log(
        'Login error:',
        error
      );

      Alert.alert(
        'Login Failed',
        error?.message ||
          'Unknown error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          VibeZone
        </Text>

        <Text style={styles.subtitle}>
          Login to continue
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={
                styles.loginButtonText
              }
            >
              Login
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(
              'Register'
            )
          }
        >
          <Text style={styles.link}>
            Don't have an account?
            Register
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#fff',
    },
    title: {
      fontSize: 34,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
      color: '#7c3aed',
    },
    subtitle: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      marginBottom: 32,
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      fontSize: 16,
      backgroundColor: '#fff',
    },
    loginButton: {
      backgroundColor: '#7c3aed',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 20,
    },
    loginButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    link: {
      textAlign: 'center',
      color: '#7c3aed',
      marginTop: 12,
      fontSize: 14,
    },
  });