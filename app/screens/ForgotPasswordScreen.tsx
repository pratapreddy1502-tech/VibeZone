import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '../data/mockVibes';
import { requestPasswordResetOtp, resetPassword } from '../services/authApi';
import { clearAuthFormStorage } from '../store/authStore';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    void clearAuthFormStorage();
  }, []);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Reset Password', 'Enter your email.');
      return;
    }

    setLoading(true);
    try {
      const response = await requestPasswordResetOtp({ email: email.trim() });
      const code = response?.dev_otp ? String(response.dev_otp) : '';

      setOtpSent(true);
      Alert.alert(
        'Verification Code',
        code ? `Use this OTP: ${code}` : 'Check your email for the verification code.'
      );
    } catch (error: any) {
      Alert.alert('Reset Password', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Reset Password', 'Fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Reset Password', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });

      setEmail('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      await clearAuthFormStorage();
      Alert.alert('Reset Password', 'Password reset successfully.', [
        {
          text: 'Log In',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Reset Password', error.message || 'Please try again.');
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
        <Text style={styles.title}>Reset Password</Text>

        <View style={styles.form}>
          <Field
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!loading}
          />

          {!otpSent ? (
            <PrimaryButton
              label="Send OTP"
              loading={loading}
              onPress={handleSendOtp}
            />
          ) : (
            <>
              <Field
                placeholder="OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Field
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Field
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <PrimaryButton
                label="Reset Password"
                loading={loading}
                onPress={handleResetPassword}
              />
              <TouchableOpacity
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.secondaryLink}>Send a new OTP</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footer}>
              Back to <Text style={styles.link}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: TextInputProps) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#9BA0B8"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
      />
    </View>
  );
}

function PrimaryButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={loading}>
      <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.button}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
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
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
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
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  input: {
    color: palette.ink,
    fontSize: 14,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryLink: {
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
