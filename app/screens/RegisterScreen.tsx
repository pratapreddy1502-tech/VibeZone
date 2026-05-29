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
import { AtSign, KeyRound, Lock, Mail } from 'lucide-react-native';

import { palette } from '../data/mockVibes';
import { requestEmailOtp, verifyRegister } from '../services/authApi';
import { useAuthStore } from '../store/authStore';

export default function RegisterScreen({ navigation }: any) {
  const [username, setUsername] = useState('pratap_dev');
  const [email, setEmail] = useState('pratap@vibezone.app');
  const [password, setPassword] = useState('vibezone');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSendOtp = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Create Account', 'Fill in username and email.');
      return;
    }

    setLoading(true);
    try {
      const response = await requestEmailOtp({
        username: username.trim(),
        email: email.trim(),
      });
      const code = response?.dev_otp ? String(response.dev_otp) : '';

      setDevOtp(code);
      setOtpSent(true);
      Alert.alert(
        'Verification Code',
        code
          ? `Use this development OTP: ${code}`
          : 'Check your email for the verification code.'
      );
    } catch (error: any) {
      Alert.alert('Create Account', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !otp.trim()) {
      Alert.alert('Create Account', 'Fill in all fields and the OTP.');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyRegister({
        username: username.trim(),
        email: email.trim(),
        password,
        otp: otp.trim(),
      });
      const token = response.token || response.access_token;
      const user = response.user;

      if (!token || !user) {
        throw new Error('Account created, but login data was missing.');
      }

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setAuth(user, token);
    } catch (error: any) {
      Alert.alert('Create Account', error.message || 'Please try again.');
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start sharing your moments in a cleaner social space.</Text>

        <Field icon={<AtSign color="#8A91AD" size={18} />} placeholder="Username" value={username} onChangeText={setUsername} />
        <Field icon={<Mail color="#8A91AD" size={18} />} placeholder="Email" value={email} onChangeText={setEmail} />
        <Field
          icon={<Lock color="#8A91AD" size={18} />}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {otpSent ? (
          <>
            <Field
              icon={<KeyRound color="#8A91AD" size={18} />}
              placeholder="6-digit OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
            {devOtp ? <Text style={styles.devOtp}>Development OTP: {devOtp}</Text> : null}
          </>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={otpSent ? handleVerifyAndRegister : handleSendOtp}
          disabled={loading}
        >
          <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {otpSent ? 'Verify & Create Account' : 'Send OTP'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {otpSent ? (
          <TouchableOpacity
            onPress={() => {
              setOtpSent(false);
              setOtp('');
              setDevOtp('');
            }}
          >
            <Text style={styles.resend}>Change email or resend OTP</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.footer}>Already have an account? <Text style={styles.link}>Log In</Text></Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.inputWrap}>
      {props.icon}
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor="#9BA0B8"
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        maxLength={props.maxLength}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  logo: {
    color: palette.violet,
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 26,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 26,
  },
  inputWrap: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4F2',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 13,
  },
  input: {
    flex: 1,
    color: palette.ink,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  devOtp: {
    color: palette.violet,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  resend: {
    color: palette.violet,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
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
