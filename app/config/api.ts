import { NativeModules } from 'react-native';

declare const process: {
  env?: Record<string, string | undefined>;
};

const API_PORT = 8000;
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://vibezone-mwg7.onrender.com';
const env = typeof process !== 'undefined' ? process.env || {} : {};
const useLocalApiFallbacks = env.EXPO_PUBLIC_USE_LOCAL_API === 'true';
const LOCAL_API_BASE_URLS = (env.EXPO_PUBLIC_LOCAL_API_BASE_URLS || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);
const PRODUCTION_API_BASE_URLS = [
  env.EXPO_PUBLIC_API_BASE_URL,
  ...(env.EXPO_PUBLIC_API_BASE_URLS || '').split(','),
  DEFAULT_PRODUCTION_API_BASE_URL,
]
  .map((url) => url?.trim().replace(/\/$/, ''))
  .filter(Boolean) as string[];
function getHostFromUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  const match = url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\/([^/:]+)/);
  return match?.[1] || null;
}

function getExpoDevHost() {
  const sourceCode = NativeModules.SourceCode as
    | { scriptURL?: string }
    | undefined;
  const scriptHost = getHostFromUrl(sourceCode?.scriptURL);

  if (scriptHost && scriptHost !== 'localhost' && scriptHost !== '127.0.0.1') {
    return scriptHost;
  }

  const locationHost = (globalThis as any)?.location?.hostname;

  if (
    locationHost &&
    locationHost !== 'localhost' &&
    locationHost !== '127.0.0.1'
  ) {
    return locationHost;
  }

  return null;
}

export function getApiBaseUrls() {
  const expoHost = useLocalApiFallbacks ? getExpoDevHost() : null;
  const developmentUrls = [
    expoHost ? `http://${expoHost}:${API_PORT}` : null,
    ...LOCAL_API_BASE_URLS,
  ];
  const urls = [
    ...PRODUCTION_API_BASE_URLS,
    ...(useLocalApiFallbacks ? developmentUrls : []),
  ].filter(Boolean) as string[];

  return [...new Set(urls)];
}

export const API_BASE_URL = getApiBaseUrls()[0];

export function getWebSocketBaseUrls() {
  return getApiBaseUrls().map((url) => url.replace(/^http/, 'ws'));
}
