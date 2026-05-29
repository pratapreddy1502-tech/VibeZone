import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';

interface Props {
  username: string;
  avatar: string;
}

export default function SuggestedUserCard({
  username,
  avatar,
}: Props) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: avatar }} style={styles.avatar} />

      <Text style={styles.username}>{username}</Text>

      <TouchableOpacity style={styles.followButton}>
        <Text style={styles.followText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
    backgroundColor: '#E5E7EB',
  },
  username: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  followButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  followText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});