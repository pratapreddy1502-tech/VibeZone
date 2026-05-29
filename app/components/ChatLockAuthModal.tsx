import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fingerprint, LockKeyhole, ShieldCheck, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '../data/mockVibes';

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmLabel?: string;
  pinPlaceholder?: string;
  loading?: boolean;
  error?: string;
  biometricEnabled?: boolean;
  onSubmitPin: (pin: string) => void;
  onBiometric?: () => void;
  onClose: () => void;
};

export default function ChatLockAuthModal({
  biometricEnabled = true,
  confirmLabel = 'Unlock',
  error,
  loading = false,
  onBiometric,
  onClose,
  onSubmitPin,
  pinPlaceholder = 'Enter PIN',
  subtitle,
  title,
  visible,
}: Props) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setPin('');
      return;
    }

    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [visible]);

  const submit = () => {
    if (pin.trim().length < 4 || loading) {
      return;
    }

    onSubmitPin(pin.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <X color={palette.ink} size={20} />
          </TouchableOpacity>
          <LinearGradient colors={['#8B5CF6', '#3882F6']} style={styles.lockMark}>
            <LockKeyhole color="#FFFFFF" size={25} />
          </LinearGradient>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.pinBox}>
            <ShieldCheck color={palette.violet} size={21} />
            <TextInput
              ref={inputRef}
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
              placeholder={pinPlaceholder}
              placeholderTextColor="#969CB5"
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              onSubmitEditing={submit}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {biometricEnabled && onBiometric ? (
              <TouchableOpacity style={styles.biometric} onPress={onBiometric} disabled={loading}>
                <Fingerprint color={palette.violet} size={21} />
                <Text style={styles.biometricText}>Fingerprint</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.confirm, (pin.trim().length < 4 || loading) && styles.disabled]}
              onPress={submit}
              disabled={pin.trim().length < 4 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 12, 38, 0.5)',
  },
  card: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  close: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lockMark: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  pinBox: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#F7F5FF',
    borderWidth: 1,
    borderColor: '#E4DBFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  pinInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  error: {
    color: '#EF4444',
    fontWeight: '800',
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  biometric: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4DBFF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  biometricText: {
    color: palette.violet,
    fontWeight: '900',
  },
  confirm: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violet,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.52,
  },
});
