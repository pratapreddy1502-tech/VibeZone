import { API_BASE_URL } from '../config/api';
import { resolveProfileImage } from './avatar';
import { apiErrorMessage, apiRequest, fetchApi } from './api';

const fallbackImage =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85';

type UploadPostOptions = {
  fileName?: string | null;
  mimeType?: string | null;
};

export type AppVibe = {
  id: string;
  userId?: number;
  username: string;
  avatar: string;
  image: string;
  videoUri?: string;
  caption: string;
  music: string;
  likes: number;
  comments: number;
  shares: number;
  place: string;
  mediaType?: 'photo' | 'reel';
  editMeta?: {
    filter?: string;
    overlayText?: string;
    musicTitle?: string;
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    muted?: boolean;
    coverUri?: string | null;
  };
};

export function resolveMediaUrl(uri?: string | null) {
  if (!uri) {
    return '';
  }

  if (
    uri.startsWith('http') ||
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('data:')
  ) {
    return uri;
  }

  return `${API_BASE_URL}${uri.startsWith('/') ? uri : `/${uri}`}`;
}

function normalizePost(post: any, index = 0): AppVibe {
  const mediaUrl = resolveMediaUrl(post.video_url || post.videoUri || post.image_url || post.image);
  const mediaType = post.media_type || post.mediaType;
  const isVideo = mediaType === 'reel' || /\.(mp4|mov|m4v|webm)$/i.test(mediaUrl);
  const userId = Number(post.user_id ?? post.author_id ?? post.user?.id ?? 0) || undefined;
  const username = post.username || post.user?.username || 'vibezone';

  return {
    id: String(post.id ?? post.reel_id ?? `api-${index}`),
    userId,
    username,
    avatar: resolveProfileImage(post.profile_image ?? post.user?.profile_image, userId, username),
    image: isVideo ? fallbackImage : mediaUrl || fallbackImage,
    videoUri: isVideo ? mediaUrl : undefined,
    caption: post.caption || 'Sharing a new vibe.',
    music: post.music || 'Original Audio - VibeZone',
    likes: Number(post.resonates_count ?? post.likes_count ?? post.resonates ?? post.likes ?? 0),
    comments: Number(post.comments_count ?? post.comments ?? 0),
    shares: Number(post.shares_count ?? post.shares ?? 0),
    place: post.place || 'From FastAPI',
    mediaType: isVideo ? 'reel' : 'photo',
    editMeta: isVideo ? { coverUri: fallbackImage } : undefined,
  };
}

export async function getFeed(userId: number) {
  const data = await apiRequest(`/feed/${userId}`);
  const posts = Array.isArray(data) ? data : data?.vibes || data?.posts || [];
  return posts.map((post: any, index: number) => normalizePost(post, index));
}

function extensionFromMimeType(mimeType?: string | null) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  if (mimeType === 'video/quicktime') {
    return 'mov';
  }

  if (mimeType?.startsWith('video/')) {
    return 'mp4';
  }

  return 'jpg';
}

function uploadFileName(uri: string, fileName?: string | null, mimeType?: string | null) {
  if (fileName && /\.[a-z0-9]+$/i.test(fileName)) {
    return fileName;
  }

  const uriName = uri.split(/[/?#]/).filter(Boolean).pop();

  if (uriName && /\.[a-z0-9]+$/i.test(uriName)) {
    return uriName;
  }

  return `vibe-${Date.now()}.${extensionFromMimeType(mimeType)}`;
}

function uploadMimeType(fileName: string, fallbackMimeType?: string | null) {
  if (fallbackMimeType?.startsWith('image/') || fallbackMimeType?.startsWith('video/')) {
    return fallbackMimeType;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'mp4') {
    return 'video/mp4';
  }

  if (extension === 'mov') {
    return 'video/quicktime';
  }

  return 'image/jpeg';
}

export async function uploadPost(
  caption: string,
  mediaUri: string,
  token: string,
  options: UploadPostOptions = {}
) {
  const name = uploadFileName(mediaUri, options.fileName, options.mimeType);
  const type = uploadMimeType(name, options.mimeType);
  const formData = new FormData();

  formData.append('caption', caption);
  formData.append('file', {
    uri: mediaUri,
    name,
    type,
  } as any);

  const { response, data } = await fetchApi('/upload-post', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    timeoutMs: 120000,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data, 'Upload failed'));
  }

  return normalizePost(data.post || data);
}

export function likePost(postId: number, token: string) {
  return apiRequest(`/like-post?post_id=${postId}`, 'POST', undefined, token);
}

export function unlikePost(postId: number, token: string) {
  return apiRequest(`/unlike-post?post_id=${postId}`, 'DELETE', undefined, token);
}

export function commentPost(postId: number, text: string, token: string) {
  return apiRequest(
    `/comment-post?post_id=${postId}&text=${encodeURIComponent(text)}`,
    'POST',
    undefined,
    token
  );
}
