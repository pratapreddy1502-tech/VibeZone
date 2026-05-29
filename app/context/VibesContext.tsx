// app/context/VibesContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';

type Vibe = {
  id: string;
  username: string;
  avatar: string;
  image: string;
  videoUri?: string;
  caption: string;
  music: string;
  likes: number;
  comments?: number;
  shares?: number;
  place?: string;
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

type VibesContextType = {
  vibes: Vibe[];
  addVibe: (vibe: Vibe) => void;

  // Spotify selected music
  selectedMusic: string;
  setSelectedMusic: (music: string) => void;
};

const VibesContext = createContext<
  VibesContextType | undefined
>(undefined);

type Props = {
  children: ReactNode;
};

export function VibesProvider({
  children,
}: Props) {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [selectedMusic, setSelectedMusic] =
    useState<string>('');

  const addVibe = (vibe: Vibe) => {
    setVibes((prev) => {
      const duplicate = prev.some(
        (item) =>
          item.caption === vibe.caption &&
          item.image === vibe.image &&
          item.videoUri === vibe.videoUri
      );

      return duplicate ? prev : [vibe, ...prev];
    });
  };

  return (
    <VibesContext.Provider
      value={{
        vibes,
        addVibe,
        selectedMusic,
        setSelectedMusic,
      }}
    >
      {children}
    </VibesContext.Provider>
  );
}

export function useVibes() {
  const context = useContext(VibesContext);

  if (!context) {
    throw new Error(
      'useVibes must be used within VibesProvider'
    );
  }

  return context;
}
