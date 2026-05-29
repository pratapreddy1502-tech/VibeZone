export const palette = {
  ink: '#090D28',
  muted: '#596078',
  line: '#E7E3F2',
  wash: '#F7F5FF',
  purple: '#8B5CF6',
  violet: '#7C3AED',
  blue: '#5B7CFA',
  pink: '#D946EF',
  yellow: '#FFCA57',
  green: '#10B981',
  white: '#FFFFFF',
};

export const gradients = {
  primary: ['#8B5CF6', '#3882F6'] as const,
  warm: ['#EC4899', '#FFCA57'] as const,
  vibe: ['#A78BFA', '#F472B6', '#38BDF8'] as const,
};

export const people = [
  {
    name: 'Add Vibe',
    handle: 'you',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=220&q=80',
  },
  {
    name: 'Diya',
    handle: 'diya.vibes',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=220&q=80',
  },
  {
    name: 'Kabir',
    handle: 'kabir',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=220&q=80',
  },
  {
    name: 'Simran',
    handle: 'simran',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=220&q=80',
  },
  {
    name: 'Arjun',
    handle: 'arjun',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=220&q=80',
  },
];

export const posts = [
  {
    id: 'sunset',
    username: 'diya.vibes',
    place: 'Goa, India',
    avatar: people[1].avatar,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85',
    caption: 'Sunsets and good company make the perfect vibe.',
    music: 'Sunset Drive - Oceanic',
    likes: 138,
    comments: 16,
    shares: 24,
  },
  {
    id: 'mountain',
    username: 'the.explorer',
    place: 'Manali, India',
    avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=220&q=80',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
    caption: 'Fresh air, clear head, full heart.',
    music: 'Mountain Life - Morning Tape',
    likes: 245,
    comments: 31,
    shares: 18,
  },
];

export const discoverCards = [
  {
    title: 'Mountain Life',
    meta: '12.5K vibes',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=85',
  },
  {
    title: 'City Lights',
    meta: '9.8K vibes',
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=85',
  },
  {
    title: 'Ocean Mood',
    meta: '8.1K vibes',
    image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=600&q=85',
  },
];

export const gridImages = [
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=80',
];

export const buzz = [
  { name: 'Diya', action: 'resonated with your vibe.', time: '2m', icon: 'heart' },
  { name: 'Kabir', action: 'responded to your vibe.', time: '5m', icon: 'chatbubble' },
  { name: 'Simran', action: 'became your viber.', time: '10m', icon: 'person-add' },
  { name: 'Arjun', action: 'mentioned you in a vibe.', time: '1h', icon: 'at' },
  { name: 'Meera', action: 'saved your vibe.', time: '2h', icon: 'bookmark' },
];

export const chats = [
  { name: 'Diya', text: "Let's plan a trip", time: '2m', unread: 2, avatar: people[1].avatar },
  { name: 'Kabir', text: 'Sent you a vibe', time: '15m', unread: 1, avatar: people[2].avatar },
  { name: 'Simran', text: 'That view is unreal', time: '1h', unread: 3, avatar: people[3].avatar },
  { name: 'Arjun', text: 'Thanks for sharing!', time: '2h', unread: 0, avatar: people[4].avatar },
];
