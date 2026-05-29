import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { getUserTheme, saveUserTheme } from '../services/themeApi';
import { defaultVibeTheme, VibeTheme, vibeThemes } from '../theme/vibeStudio';

const THEME_KEY = 'vibezone:vibe-theme';
const THEME_HISTORY_KEY = 'vibezone:vibe-theme-history';

type ThemeState = {
  theme: VibeTheme;
  history: VibeTheme[];
  hydrated: boolean;
  loadTheme: (token?: string | null) => Promise<void>;
  applyTheme: (theme: VibeTheme, token?: string | null) => Promise<void>;
  resetTheme: (token?: string | null) => Promise<void>;
};

function normalizeTheme(savedTheme: VibeTheme | null | undefined) {
  if (!savedTheme?.id) {
    return defaultVibeTheme;
  }

  return vibeThemes.find((theme) => theme.id === savedTheme.id) || savedTheme;
}

async function readThemeHistory() {
  const rawHistory = await AsyncStorage.getItem(THEME_HISTORY_KEY);

  if (!rawHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawHistory);
    return Array.isArray(parsed) ? parsed.map(normalizeTheme).slice(0, 8) : [];
  } catch {
    return [];
  }
}

async function writeTheme(theme: VibeTheme, history: VibeTheme[]) {
  await AsyncStorage.multiSet([
    [THEME_KEY, JSON.stringify(theme)],
    [THEME_HISTORY_KEY, JSON.stringify(history)],
  ]);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: defaultVibeTheme,
  history: [],
  hydrated: false,
  loadTheme: async (token) => {
    const [rawTheme, history] = await Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      readThemeHistory(),
    ]);
    let nextTheme = defaultVibeTheme;

    if (rawTheme) {
      try {
        nextTheme = normalizeTheme(JSON.parse(rawTheme));
      } catch {
        nextTheme = defaultVibeTheme;
      }
    }

    set({ theme: nextTheme, history, hydrated: true });

    if (!token) {
      return;
    }

    try {
      const backendTheme = await getUserTheme(token);
      if (backendTheme) {
        const normalizedTheme = normalizeTheme(backendTheme);
        const nextHistory = [
          normalizedTheme,
          ...history.filter((item) => item.id !== normalizedTheme.id),
        ].slice(0, 8);
        await writeTheme(normalizedTheme, nextHistory);
        set({ theme: normalizedTheme, history: nextHistory });
      }
    } catch {
      // Local theme still works when FastAPI is unavailable.
    }
  },
  applyTheme: async (theme, token) => {
    const normalizedTheme = normalizeTheme(theme);
    const nextHistory = [
      normalizedTheme,
      ...get().history.filter((item) => item.id !== normalizedTheme.id),
    ].slice(0, 8);

    set({ theme: normalizedTheme, history: nextHistory, hydrated: true });
    await writeTheme(normalizedTheme, nextHistory);

    if (token) {
      saveUserTheme(normalizedTheme, token).catch(() => {});
    }
  },
  resetTheme: async (token) => {
    set({ theme: defaultVibeTheme, history: [], hydrated: true });
    await AsyncStorage.multiRemove([THEME_KEY, THEME_HISTORY_KEY]);

    if (token) {
      saveUserTheme(defaultVibeTheme, token).catch(() => {});
    }
  },
}));
