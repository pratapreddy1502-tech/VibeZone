import { apiErrorMessage, apiRequest, fetchApi } from './api';

export type Profile = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  account_type?: 'public' | 'private';
  viewer_is_viber?: boolean;
  private_content_locked?: boolean;
  website?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  created_at?: string | null;
  last_seen?: string | null;
  vibers_count: number;
  followers_count: number;
  connections_count: number;
  following_count: number;
  vibes_count: number;
  posts_count: number;
  reels_count?: number;
  has_vibed?: boolean;
  connection_status?: 'none' | 'pending' | 'accepted' | 'rejected' | 'self';
  connection_request_id?: number | null;
  vibes?: Array<{
    id: number;
    caption: string;
    image_url?: string | null;
  }>;
  posts: Array<{
    id: number;
    caption: string;
    image_url?: string | null;
  }>;
  reels?: Array<{
    id: number;
    user_id: number;
    username: string;
    caption: string;
    video_url: string;
    resonates_count?: number;
    likes_count?: number;
    comments_count?: number;
    views_count?: number;
    shares_count?: number;
    created_at?: string | null;
  }>;
};

export type ProfileUser = Partial<Profile> & {
  id: number;
  username: string;
  email: string;
  is_online?: boolean;
  vibed_at?: string | null;
  connected_at?: string | null;
};

export type ProfileImageUpload = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

export type UpdateProfileInput = {
  username?: string;
  full_name?: string;
  bio?: string;
  website?: string;
  gender?: string;
  date_of_birth?: string;
  profile_image?: string;
  account_type?: 'public' | 'private';
  image?: ProfileImageUpload | null;
};

export function getProfile(userId: number, token?: string) {
  return apiRequest(`/users/${userId}`, 'GET', undefined, token) as Promise<Profile>;
}

export function getUsers(token: string) {
  return apiRequest('/users', 'GET', undefined, token).then((data) => ({
    users: (data?.users || []) as ProfileUser[],
  }));
}

export async function updateProfile(userId: number, token: string, input: UpdateProfileInput) {
  const formData = new FormData();
  const textFields: Array<keyof UpdateProfileInput> = [
    'username',
    'full_name',
    'bio',
    'website',
    'gender',
    'date_of_birth',
    'profile_image',
    'account_type',
  ];

  textFields.forEach((field) => {
    const value = input[field];

    if (typeof value === 'string') {
      formData.append(field, value);
    }
  });

  if (input.image?.uri) {
    formData.append('file', {
      uri: input.image.uri,
      name: input.image.name || `profile-${Date.now()}.jpg`,
      type: input.image.type || 'image/jpeg',
    } as any);
  }

  const { response, data } = await fetchApi(`/profile/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    timeoutMs: 15000,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data, 'Could not update profile'));
  }

  return data.profile as Profile;
}

export function vibeUser(userId: number, token: string) {
  return apiRequest(`/users/${userId}/vibe`, 'POST', undefined, token);
}

export function unvibeUser(userId: number, token: string) {
  return apiRequest(`/users/${userId}/vibe`, 'DELETE', undefined, token);
}

export function getUserVibers(userId: number, token: string) {
  return apiRequest(`/users/${userId}/vibers`, 'GET', undefined, token).then((data) => ({
    count: Number(data?.count || 0),
    users: (data?.vibers || []) as ProfileUser[],
  }));
}

export function requestConnection(userId: number, token: string) {
  return apiRequest(`/users/${userId}/connection-request`, 'POST', undefined, token);
}

export function acceptConnection(requestId: number, token: string) {
  return apiRequest(`/connections/${requestId}/accept`, 'POST', undefined, token);
}

export function rejectConnection(requestId: number, token: string) {
  return apiRequest(`/connections/${requestId}/reject`, 'POST', undefined, token);
}

export function getUserConnections(userId: number, token: string) {
  return apiRequest(`/users/${userId}/connections`, 'GET', undefined, token).then((data) => ({
    count: Number(data?.count || 0),
    users: (data?.connections || []) as ProfileUser[],
  }));
}

export function getAccountPrivacy(token: string) {
  return apiRequest('/account-privacy', 'GET', undefined, token).then((data) => ({
    account_type: (data?.account_type === 'private' ? 'private' : 'public') as 'public' | 'private',
  }));
}

export function updateAccountPrivacy(accountType: 'public' | 'private', token: string) {
  return apiRequest('/account-privacy', 'PUT', { account_type: accountType }, token).then((data) => ({
    account_type: (data?.account_type === 'private' ? 'private' : 'public') as 'public' | 'private',
    user: data?.user,
  }));
}

export function followUser(followingId: number, token: string) {
  return apiRequest(`/follow-user?following_id=${followingId}`, 'POST', undefined, token);
}

export function unfollowUser(followingId: number, token: string) {
  return apiRequest(`/unfollow-user?following_id=${followingId}`, 'POST', undefined, token);
}
