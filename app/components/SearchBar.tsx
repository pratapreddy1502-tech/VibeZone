import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SearchBar() {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color="#9CA3AF" />
      <TextInput
        placeholder="Search vibes, users..."
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    marginLeft: 10,
    flex: 1,
    color: '#111827',
    fontSize: 16,
  },
});