import { AppVibe, resolveMediaUrl } from './postApi';
import { resolveProfileImage } from './avatar';
import { apiErrorMessage, apiRequest, fetchApi } from './api';

const fallbackCover =
  'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=900&q=85';

export type Reel = {
  id: number;
  user_id: number;
  username: string;
  profile_image?: string | null;
  caption: string;
  video_url: string;
  media_type?: 'reel';
  resonates_count: number;
  likes_count: number;
  comments_count: number;
  views_count: number;
  shares_count: number;
  created_at?: string | null;
};

export type ReelComment = {
  id: number;
  user_id: number;
  username: string;
  profile_image?: string | null;
  text: string;
};

type UploadReelOptions = {
  fileName?: string | null;
  mimeType?: string | null;
};

function extensionFromMimeType(mimeType?: string | null) {
  if (mimeType === 'video/quicktime') {
    return 'mov';
  }

  if (mimeType === 'video/webm') {
    return 'webm';
  }

  if (mimeType === 'video/x-m4v') {
    return 'm4v';
  }

  return 'mp4';
}

function videoMimeType(fileName: string, fallbackMimeType?: string | null) {
  if (fallbackMimeType?.startsWith('video/')) {
    return fallbackMimeType;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'mov') {
    return 'video/quicktime';
  }

  if (extension === 'webm') {
    return 'video/webm';
  }

  return 'video/mp4';
}

function videoFileName(uri: string, fileName?: string | null, mimeType?: string | null) {
  if (fileName && /\.[a-z0-9]+$/i.test(fileName)) {
    return fileName;
  }

  const uriName = uri.split(/[/?#]/).filter(Boolean).pop();

  if (uriName && /\.[a-z0-9]+$/i.test(uriName)) {
    return uriName;
  }

  return `reel-${Date.now()}.${extensionFromMimeType(mimeType)}`;
}

export function normalizeReel(reel: any): Reel {
  const userId = Number(reel.user_id ?? reel.user?.id);
  const username = reel.username || reel.user?.username || 'vibezone';

  return {
    id: Number(reel.id ?? reel.reel_id),
    user_id: userId,
    username,
    profile_image: resolveProfileImage(reel.profile_image ?? reel.user?.profile_image, userId, username),
    caption: reel.caption || '',
    video_url: resolveMediaUrl(reel.video_url || reel.videoUri),
    media_type: 'reel',
    resonates_count: Number(reel.resonates_count ?? reel.likes_count ?? 0),
    likes_count: Number(reel.likes_count ?? reel.resonates_count ?? 0),
    comments_count: Number(reel.comments_count ?? 0),
    views_count: Number(reel.views_count ?? 0),
    shares_count: Number(reel.shares_count ?? 0),
    created_at: reel.created_at || null,
  };
}

export function reelToVibe(reel: Reel): AppVibe {
  return {
    id: `reel-${reel.id}`,
    userId: reel.user_id,
    username: reel.username,
    avatar: resolveProfileImage(reel.profile_image, reel.user_id, reel.username),
    image: fallbackCover,
    videoUri: reel.video_url,
    caption: reel.caption || 'Sharing a new reel.',
    music: `Original Audio - ${reel.username}`,
    likes: reel.likes_count,
    comments: reel.comments_count,
    shares: reel.shares_count,
    place: 'Reel Studio',
    mediaType: 'reel',
    editMeta: {
      coverUri: fallbackCover,
      muted: true,
      speed: 1,
    },
  };
}

export async function getReels(token?: string) {
  const data = await apiRequest('/reels', 'GET', undefined, token, 3500);
  const reels = Array.isArray(data) ? data : data?.reels || [];

  return reels.map(normalizeReel);
}

export async function likeReel(reelId: number, token: string) {
  const data = await apiRequest(
    `/like-reel?reel_id=${reelId}`,
    'POST',
    undefined,
    token
  );

  return normalizeReel(data.reel);
}

export async function unlikeReel(reelId: number, token: string) {
  const data = await apiRequest(
    `/unlike-reel?reel_id=${reelId}`,
    'DELETE',
    undefined,
    token
  );

  return normalizeReel(data.reel);
}

export async function viewReel(reelId: number, token?: string) {
  const data = await apiRequest(`/view-reel?reel_id=${reelId}`, 'POST', undefined, token);

  return normalizeReel(data.reel);
}

export async function shareReel(reelId: number, token?: string) {
  const data = await apiRequest(`/share-reel?reel_id=${reelId}`, 'POST', undefined, token);

  return normalizeReel(data.reel);
}

export async function getReelComments(reelId: number, token?: string) {
  const data = await apiRequest(`/reel-comments/${reelId}`, 'GET', undefined, token);
  const comments = Array.isArray(data) ? data : data?.comments || [];

  return comments.map((comment: any): ReelComment => {
    const userId = Number(comment.user_id ?? comment.user?.id);
    const username = comment.username || comment.user?.username || 'vibezone';

    return {
      id: Number(comment.id),
      user_id: userId,
      username,
      profile_image: resolveProfileImage(comment.profile_image ?? comment.user?.profile_image, userId, username),
      text: comment.text || '',
    };
  });
}

export async function commentReel(reelId: number, text: string, token: string) {
  const data = await apiRequest(
    `/comment-reel?reel_id=${reelId}&text=${encodeURIComponent(text)}`,
    'POST',
    undefined,
    token
  );

  return {
    comment: {
      id: Number(data.comment.id),
      user_id: Number(data.comment.user_id),
      username: data.comment.username || 'vibezone',
      profile_image: resolveProfileImage(
        data.comment.profile_image,
        Number(data.comment.user_id),
        data.comment.username
      ),
      text: data.comment.text || '',
    } as ReelComment,
    reel: normalizeReel(data.reel),
  };
}

export async function uploadReel(
  caption: string,
  videoUri: string,
  token: string,
  options: UploadReelOptions = {}
) {
  const name = videoFileName(videoUri, options.fileName, options.mimeType);
  const formData = new FormData();

  formData.append('caption', caption);
  formData.append('video', {
    uri: videoUri,
    name,
    type: videoMimeType(name, options.mimeType),
  } as any);

  const { response, data } = await fetchApi('/upload-reel', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    timeoutMs: 120000,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data, 'Reel upload failed'));
  }

  return normalizeReel(data.reel || data);
}
