import { API_BASE_URL } from '../config/api';

const avatarColors = [
  '7C3AED',
  'EC4899',
  '2563EB',
  '059669',
  'F59E0B',
  'DC2626',
  '0891B2',
  '4F46E5',
];

function hashIdentity(value: string) {
  return value.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function cleanName(username?: string | null, userId?: number | null) {
  const name = username?.replace(/^@/, '').replace(/[._-]+/g, ' ').trim();

  if (name) {
    return name;
  }

  return userId ? `User ${userId}` : 'VibeZone';
}

export function generatedProfileImage(userId?: number | null, username?: string | null) {
  const name = cleanName(username, userId);
  const key = `${userId || ''}:${username || name}`;
  const background = avatarColors[hashIdentity(key) % avatarColors.length];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${background}&color=FFFFFF&bold=true&size=256&format=png`;
}

export function resolveProfileImage(
  profileImage?: string | null,
  userId?: number | null,
  username?: string | null
) {
  const value = profileImage?.trim();

  if (!value) {
    return generatedProfileImage(userId, username);
  }

  if (
    value.startsWith('http') ||
    value.startsWith('file:') ||
    value.startsWith('content:') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}
