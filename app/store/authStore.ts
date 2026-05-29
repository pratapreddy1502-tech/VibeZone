import { create } from 'zustand';

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

  logout: () =>
    set({
      user: null,
      token: null,
      isLoggedIn: false,
    }),

  checkAuth: () =>
    set((state) => ({
      isLoggedIn: !!state.token,
    })),
}));
