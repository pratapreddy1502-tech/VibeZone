declare const process: {
  env?: Record<string, string | undefined>;
};

type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const env = typeof process !== 'undefined' ? process.env || {} : {};

function parseIceServers(rawValue?: string): IceServerConfig[] {
  if (!rawValue?.trim()) {
    return DEFAULT_ICE_SERVERS;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (Array.isArray(parsed) && parsed.length) {
      return parsed;
    }
  } catch {
    const urls = rawValue
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length) {
      return urls.map((url) => ({ urls: url }));
    }
  }

  return DEFAULT_ICE_SERVERS;
}

export function getWebRtcPeerConfig() {
  return {
    iceServers: parseIceServers(env.EXPO_PUBLIC_WEBRTC_ICE_SERVERS),
  };
}
