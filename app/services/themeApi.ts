import { apiRequest } from './api';
import { VibeTheme } from '../theme/vibeStudio';

export function getUserTheme(token: string) {
  return apiRequest('/settings/theme', 'GET', undefined, token).then((data) => (
    data?.theme || null
  )) as Promise<VibeTheme | null>;
}

export function saveUserTheme(theme: VibeTheme, token: string) {
  return apiRequest('/settings/theme', 'PUT', { theme }, token).then((data) => (
    data?.theme || theme
  )) as Promise<VibeTheme>;
}
