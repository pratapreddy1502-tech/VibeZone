import { create } from 'zustand';

type ProfileCounts = {
  id?: number;
  username?: string;
  email?: string;
  full_name?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  website?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  created_at?: string | null;
  vibers_count?: number;
  followers_count?: number;
  connections_count?: number;
  following_count?: number;
  vibes_count?: number;
  posts_count?: number;
  reels_count?: number;
};

type ProfileUpdateState = {
  updates: Record<number, ProfileCounts>;
  setProfileCounts: (userId: number, counts: ProfileCounts) => void;
};

export const useProfileUpdateStore = create<ProfileUpdateState>((set) => ({
  updates: {},
  setProfileCounts: (userId, counts) =>
    set((state) => ({
      updates: {
        ...state.updates,
        [userId]: {
          ...(state.updates[userId] || {}),
          ...counts,
        },
      },
    })),
}));
