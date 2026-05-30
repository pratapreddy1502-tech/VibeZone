import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_FORM_STORAGE_KEYS = [
  'loginEmail',
  'loginPassword',
  'registerUsername',
  'registerEmail',
  'registerPassword',
  'authEmail',
  'authPassword',
  'email',
  'username',
  'password',
];

export function clearAuthFormStorage() {
  return AsyncStorage.multiRemove(AUTH_FORM_STORAGE_KEYS).catch(() => undefined);
}

interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  account_type?: 'public' | 'private';
  website?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  created_at?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  setAuth: (user, token) =>
    set({
      user,
      token,
      isLoggedIn: true,
    }),

  logout: () => {
    AsyncStorage.multiRemove(['token', 'user', ...AUTH_FORM_STORAGE_KEYS]).catch(
      () => undefined
    );
    set({
      user: null,
      token: null,
      isLoggedIn: false,
    });
  },

  checkAuth: () =>
    set((state) => ({
      isLoggedIn: !!state.token,
    })),
}));
