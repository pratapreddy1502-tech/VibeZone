// app/screens/music/SpotifySearchScreen.tsx

// app/screens/music/SpotifySearchScreen.tsx

// app/screens/music/SpotifySearchScreen.tsx

import React, {
  useEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { searchTracks } from '../../services/spotify';
import { useVibes } from '../../context/VibesContext';

export default function SpotifySearchScreen() {
  const navigation = useNavigation<any>();
  const { setSelectedMusic } = useVibes();

  const [query, setQuery] =
    useState('Arijit Singh');
  const [tracks, setTracks] = useState<any[]>(
    []
  );
  const [loading, setLoading] =
    useState(false);

  const fetchTracks = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const results =
        await searchTracks(query);
      setTracks(results);
    } catch (error) {
      console.log(
        'Spotify search error:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTracks();
    }, 500);

    return () => clearTimeout(timeout);
  }, [query]);

  const selectTrack = (track: any) => {
    setSelectedMusic(
      `${track.name} • ${track.artist}`
    );
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Spotify Search
      </Text>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#9CA3AF"
        />
        <TextInput
          style={styles.input}
          placeholder="Search songs..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#1DB954"
          style={{ marginTop: 30 }}
        />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) =>
            item.id
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.trackItem}
              onPress={() =>
                selectTrack(item)
              }
            >
              <Image
                source={{
                  uri: item.image,
                }}
                style={styles.albumArt}
              />

              <View style={styles.trackInfo}>
                <Text
                  style={styles.trackName}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>

                <Text
                  style={
                    styles.artistName
                  }
                  numberOfLines={1}
                >
                  {item.artist}
                </Text>
              </View>

              <Ionicons
                name="musical-notes"
                size={22}
                color="#1DB954"
              />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={
            false
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1DB954',
    marginBottom: 20,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#111827',
  },

  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  albumArt: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },

  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },

  trackName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  artistName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});