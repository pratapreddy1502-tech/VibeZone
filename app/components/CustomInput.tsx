import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
}

export default function CustomInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
}: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#71717A"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    height: 56,
    color: '#FFFFFF',
    fontSize: 16,
  },
});