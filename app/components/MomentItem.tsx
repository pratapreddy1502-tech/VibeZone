import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface Props {
  username: string;
  image: string;
}

export default function MomentItem({ username, image }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.ring}>
        <Image source={{ uri: image }} style={styles.avatar} />
      </View>
      <Text style={styles.username} numberOfLines={1}>
        {username}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 16,
    width: 72,
  },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  username: {
    marginTop: 6,
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
});