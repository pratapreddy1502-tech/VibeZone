import { apiErrorMessage, apiRequest, fetchApi } from './api';
import { resolveProfileImage } from './avatar';
import { resolveMediaUrl } from './postApi';

export type StoryMediaType = 'image' | 'video';

export type StoryUser = {
  id: number;
  username: string;
  profile_image: string;
  account_type?: 'public' | 'private';
};

export type StoryItem = {
  id: number;
  user_id: number;
  media_url: string;
  media_type: StoryMediaType;
  caption: string;
  created_at?: string | null;
  expires_at?: string | null;
  user: StoryUser;
};

export type StoryGroup = {
  user: StoryUser;
  stories: StoryItem[];
};

type UploadStoryOptions = {
  caption?: string;
  fileName?: string | null;
  mimeType?: string | null;
};

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

  return `story-${Date.now()}.${extensionFromMimeType(mimeType)}`;
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

  if (extension === 'mov') {
    return 'video/quicktime';
  }

  if (extension === 'mp4' || extension === 'm4v') {
    return 'video/mp4';
  }

  if (extension === 'webm') {
    return 'video/webm';
  }

  return 'image/jpeg';
}

function normalizeUser(user: any, fallback?: Partial<StoryUser>): StoryUser {
  const userId = Number(user?.id ?? fallback?.id ?? 0);
  const username = user?.username || fallback?.username || 'vibezone';

  return {
    id: userId,
    username,
    profile_image: resolveProfileImage(
      user?.profile_image ?? fallback?.profile_image,
      userId,
      username
    ),
    account_type: user?.account_type === 'private' ? 'private' : 'public',
  };
}

export function normalizeStory(story: any, fallbackUser?: Partial<StoryUser>): StoryItem {
  const user = normalizeUser(story?.user, {
    id: Number(story?.user_id ?? fallbackUser?.id ?? 0),
    username: fallbackUser?.username,
    profile_image: fallbackUser?.profile_image,
  });
  const mediaType = story?.media_type === 'video' ? 'video' : 'image';

  return {
    id: Number(story?.id),
    user_id: Number(story?.user_id ?? user.id),
    media_url: resolveMediaUrl(story?.media_url),
    media_type: mediaType,
    caption: story?.caption || '',
    created_at: story?.created_at || null,
    expires_at: story?.expires_at || null,
    user,
  };
}

export function normalizeStoryGroup(group: any): StoryGroup {
  const user = normalizeUser(group?.user);
  const stories = (Array.isArray(group?.stories) ? group.stories : [])
    .map((story: any) => normalizeStory(story, user))
    .filter((story: StoryItem) => story.id && story.media_url);

  return {
    user,
    stories,
  };
}

export async function getStoryFeed(token: string) {
  const data = await apiRequest('/stories/feed', 'GET', undefined, token, 7000);
  const groups = Array.isArray(data) ? data : data?.groups || data?.story_groups || [];

  return groups.map(normalizeStoryGroup).filter((group: StoryGroup) => group.stories.length);
}

export async function getUserStories(userId: number, token: string) {
  const data = await apiRequest(`/stories/user/${userId}`, 'GET', undefined, token, 7000);

  return normalizeStoryGroup(data);
}

export async function uploadStory(mediaUri: string, token: string, options: UploadStoryOptions = {}) {
  const name = uploadFileName(mediaUri, options.fileName, options.mimeType);
  const type = uploadMimeType(name, options.mimeType);
  const formData = new FormData();

  formData.append('caption', options.caption || '');
  formData.append('media', {
    uri: mediaUri,
    name,
    type,
  } as any);

  const { response, data } = await fetchApi('/stories/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    timeoutMs: 120000,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data, 'Story upload failed'));
  }

  return normalizeStory(data.story || data);
}

export function deleteStory(storyId: number, token: string) {
  return apiRequest(`/stories/${storyId}`, 'DELETE', undefined, token);
}
