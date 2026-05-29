// app/services/spotify.ts

export const SPOTIFY_CLIENT_ID = '56c5bfb663024e66860408b995c52cbb';
export const SPOTIFY_CLIENT_SECRET = '46be5238245741659075353587897bfd';

function base64Encode(str: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const utf8Str = unescape(encodeURIComponent(str));

  while (i < utf8Str.length) {
    const chr1 = utf8Str.charCodeAt(i++);
    const chr2 = utf8Str.charCodeAt(i++);
    const chr3 = utf8Str.charCodeAt(i++);
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }

  return output;
}

export async function getSpotifyAccessToken() {
  const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;
  const encodedCredentials = base64Encode(credentials);

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
        'Failed to get Spotify access token'
    );
  }

  return data.access_token;
}

export async function searchTracks(query: string) {
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

  return (
    data.tracks?.items?.map((item: any) => ({
      id: item.id,
      name: item.name,
      artist: item.artists
        .map((artist: any) => artist.name)
        .join(', '),
      image:
        item.album.images?.[0]?.url ||
        'https://via.placeholder.com/150',
      previewUrl: item.preview_url,
      externalUrl: item.external_urls?.spotify,
    })) || []
  );
}
