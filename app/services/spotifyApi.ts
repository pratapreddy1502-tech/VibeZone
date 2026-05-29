// app/services/spotifyApi.ts
import base64 from 'base-64';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from './spotify';

const credentials =
  `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;

const encodedCredentials =
  base64.encode(credentials);

/**
 * Get Spotify access token using Client Credentials flow
 */
export async function getSpotifyAccessToken() {
  const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;
  const encodedCredentials = btoa(credentials);

  const response = await fetch(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }
  );

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        'Failed to get Spotify access token'
    );
  }

  return data.access_token;
}

/**
 * Search tracks from Spotify
 */
export async function searchTracks(query: string) {
  if (!query.trim()) {
    return [];
  }

  const token = await getSpotifyAccessToken();

  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      query
    )}&type=track&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!data.tracks?.items) {
    return [];
  }

  return data.tracks.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    artist: item.artists
      .map((artist: any) => artist.name)
      .join(', '),
    image:
      item.album?.images?.[0]?.url ||
      'https://via.placeholder.com/150',
    previewUrl: item.preview_url,
    externalUrl: item.external_urls?.spotify,
  }));
}