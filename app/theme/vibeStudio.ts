export type VibeThemeMode = 'light' | 'dark' | 'custom';

export type VibeTheme = {
  id: string;
  name: string;
  mode: VibeThemeMode;
  emoji: string;
  description: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  primary: string;
  secondary: string;
  accent: string;
  shadow: string;
  storyGradient: readonly [string, string, string];
  buttonGradient: readonly [string, string];
  feedGradient: readonly [string, string];
  glow: string;
  previewImage?: string;
  photoUri?: string;
};

export const lightVibeThemes: VibeTheme[] = [
  {
    id: 'lavender-dream',
    name: 'Lavender Dream',
    mode: 'light',
    emoji: 'lavender',
    description: 'Lavender gradients, soft purple buttons, dreamy shadows.',
    background: '#F8F4FF',
    surface: '#FFFFFF',
    card: '#FBF8FF',
    text: '#171137',
    muted: '#6E6686',
    line: '#E9DDFB',
    primary: '#8B5CF6',
    secondary: '#C084FC',
    accent: '#A78BFA',
    shadow: '#A78BFA',
    storyGradient: ['#E9D5FF', '#A78BFA', '#F0ABFC'],
    buttonGradient: ['#A855F7', '#7C3AED'],
    feedGradient: ['#EDE7FF', '#F8D8FF'],
    glow: 'rgba(139, 92, 246, 0.26)',
    previewImage: 'https://images.unsplash.com/photo-1496861083958-175bb1bd5702?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'cotton-candy',
    name: 'Cotton Candy',
    mode: 'light',
    emoji: 'candy',
    description: 'Pink and white pastel UI with soft sugar highlights.',
    background: '#FFF4FA',
    surface: '#FFFFFF',
    card: '#FFF8FC',
    text: '#311429',
    muted: '#7B6474',
    line: '#F6D8E8',
    primary: '#F472B6',
    secondary: '#FB7185',
    accent: '#F9A8D4',
    shadow: '#F9A8D4',
    storyGradient: ['#FBCFE8', '#F472B6', '#FDE68A'],
    buttonGradient: ['#FB7185', '#EC4899'],
    feedGradient: ['#FFE4F2', '#FBE7FF'],
    glow: 'rgba(244, 114, 182, 0.26)',
    previewImage: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    mode: 'light',
    emoji: 'wave',
    description: 'Blue sky gradients with airy coastal highlights.',
    background: '#F2FAFF',
    surface: '#FFFFFF',
    card: '#F8FCFF',
    text: '#0F2442',
    muted: '#5F7088',
    line: '#D8ECFA',
    primary: '#38BDF8',
    secondary: '#2563EB',
    accent: '#7DD3FC',
    shadow: '#7DD3FC',
    storyGradient: ['#BAE6FD', '#38BDF8', '#2563EB'],
    buttonGradient: ['#38BDF8', '#2563EB'],
    feedGradient: ['#DDF4FF', '#BFE7FF'],
    glow: 'rgba(56, 189, 248, 0.26)',
    previewImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'mint-fresh',
    name: 'Mint Fresh',
    mode: 'light',
    emoji: 'leaf',
    description: 'Green pastel aesthetic with calm clean surfaces.',
    background: '#F4FFF8',
    surface: '#FFFFFF',
    card: '#F9FFFB',
    text: '#10291F',
    muted: '#64766E',
    line: '#D9F3E4',
    primary: '#34D399',
    secondary: '#10B981',
    accent: '#86EFAC',
    shadow: '#86EFAC',
    storyGradient: ['#BBF7D0', '#34D399', '#99F6E4'],
    buttonGradient: ['#34D399', '#10B981'],
    feedGradient: ['#DDFBE8', '#F3FFF7'],
    glow: 'rgba(52, 211, 153, 0.24)',
    previewImage: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'peach-glow',
    name: 'Peach Glow',
    mode: 'light',
    emoji: 'peach',
    description: 'Peach sunset colors with warm gentle accents.',
    background: '#FFF7F1',
    surface: '#FFFFFF',
    card: '#FFFBF7',
    text: '#321C14',
    muted: '#7C6A62',
    line: '#F8DFD0',
    primary: '#FB923C',
    secondary: '#F97316',
    accent: '#FDBA74',
    shadow: '#FDBA74',
    storyGradient: ['#FED7AA', '#FB923C', '#F9A8D4'],
    buttonGradient: ['#FB923C', '#F97316'],
    feedGradient: ['#FFE2C7', '#FFD6D6'],
    glow: 'rgba(251, 146, 60, 0.25)',
    previewImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
  },
];

export const darkVibeThemes: VibeTheme[] = [
  {
    id: 'neon-night',
    name: 'Neon Night',
    mode: 'dark',
    emoji: 'moon',
    description: 'Dark background with purple neon borders.',
    background: '#05020D',
    surface: '#0D0619',
    card: '#140A24',
    text: '#FFFFFF',
    muted: '#B9A8D6',
    line: '#332047',
    primary: '#A855F7',
    secondary: '#6D28D9',
    accent: '#EC4899',
    shadow: '#A855F7',
    storyGradient: ['#581C87', '#A855F7', '#EC4899'],
    buttonGradient: ['#A855F7', '#6D28D9'],
    feedGradient: ['#240B46', '#05020D'],
    glow: 'rgba(168, 85, 247, 0.42)',
    previewImage: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'soft-dream',
    name: 'Soft Dream',
    mode: 'dark',
    emoji: 'cloud',
    description: 'Dark pink glow with soft cinematic warmth.',
    background: '#170914',
    surface: '#241020',
    card: '#30172B',
    text: '#FFF7FB',
    muted: '#D7B8CC',
    line: '#4A2540',
    primary: '#F472B6',
    secondary: '#BE185D',
    accent: '#FDA4AF',
    shadow: '#F472B6',
    storyGradient: ['#831843', '#F472B6', '#FDA4AF'],
    buttonGradient: ['#F472B6', '#BE185D'],
    feedGradient: ['#3B1736', '#160914'],
    glow: 'rgba(244, 114, 182, 0.38)',
    previewImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'midnight-rain',
    name: 'Midnight Rain',
    mode: 'dark',
    emoji: 'rain',
    description: 'Blue neon aesthetic with rainy night contrast.',
    background: '#020817',
    surface: '#081225',
    card: '#0C1930',
    text: '#EAF6FF',
    muted: '#9DB2CE',
    line: '#1D3557',
    primary: '#3B82F6',
    secondary: '#1D4ED8',
    accent: '#60A5FA',
    shadow: '#3B82F6',
    storyGradient: ['#1E3A8A', '#3B82F6', '#67E8F9'],
    buttonGradient: ['#3B82F6', '#1D4ED8'],
    feedGradient: ['#0B2447', '#020817'],
    glow: 'rgba(59, 130, 246, 0.36)',
    previewImage: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'cyber-punk',
    name: 'Cyber Punk',
    mode: 'dark',
    emoji: 'spark',
    description: 'Cyan and purple glow for a future-city mood.',
    background: '#020A0F',
    surface: '#06131C',
    card: '#071B24',
    text: '#E9FEFF',
    muted: '#9ACAD1',
    line: '#164E63',
    primary: '#06B6D4',
    secondary: '#7C3AED',
    accent: '#22D3EE',
    shadow: '#06B6D4',
    storyGradient: ['#06B6D4', '#7C3AED', '#EC4899'],
    buttonGradient: ['#06B6D4', '#7C3AED'],
    feedGradient: ['#073B4C', '#13052B'],
    glow: 'rgba(6, 182, 212, 0.4)',
    previewImage: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 'sunset-haze',
    name: 'Sunset Haze',
    mode: 'dark',
    emoji: 'sunset',
    description: 'Orange neon accents over deep smoky surfaces.',
    background: '#110604',
    surface: '#1F0D08',
    card: '#2B130B',
    text: '#FFF6ED',
    muted: '#D8B8A4',
    line: '#5A2A16',
    primary: '#FB923C',
    secondary: '#C2410C',
    accent: '#FDBA74',
    shadow: '#FB923C',
    storyGradient: ['#7C2D12', '#FB923C', '#F97316'],
    buttonGradient: ['#FB923C', '#C2410C'],
    feedGradient: ['#4A1607', '#120604'],
    glow: 'rgba(251, 146, 60, 0.38)',
    previewImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85',
  },
];

export const vibeThemes = [...lightVibeThemes, ...darkVibeThemes];
export const defaultVibeTheme = lightVibeThemes[0];

function byteToHex(value: number) {
  return Math.max(64, Math.min(238, value)).toString(16).padStart(2, '0');
}

function hashColor(seed: string, offset: number) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index) + offset) % 16777215;
  }

  const r = byteToHex((hash >> 16) & 255);
  const g = byteToHex((hash >> 8) & 255);
  const b = byteToHex(hash & 255);

  return `#${r}${g}${b}`;
}

export function createPhotoTheme(photoUri: string, seed = photoUri): VibeTheme {
  const primary = hashColor(seed, 17);
  const secondary = hashColor(seed, 43);
  const accent = hashColor(seed, 89);

  return {
    id: `custom-photo-${Date.now()}`,
    name: 'Custom Photo Theme',
    mode: 'custom',
    emoji: 'photo',
    description: 'Generated from your uploaded photo.',
    background: '#F8F7FF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#10163F',
    muted: '#6B7280',
    line: '#ECECFA',
    primary,
    secondary,
    accent,
    shadow: primary,
    storyGradient: [primary, secondary, accent],
    buttonGradient: [primary, secondary],
    feedGradient: [accent, primary],
    glow: 'rgba(124, 58, 237, 0.24)',
    previewImage: photoUri,
    photoUri,
  };
}
