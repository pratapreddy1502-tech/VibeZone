import { NativeModules, Platform } from 'react-native';

declare const process: {
  env?: Record<string, string | undefined>;
};

const API_PORT = 8000;
const env = typeof process !== 'undefined' ? process.env || {} : {};
const PRODUCTION_API_BASE_URLS = [
  env.EXPO_PUBLIC_API_BASE_URL,
  ...(env.EXPO_PUBLIC_API_BASE_URLS || '').split(','),
]
  .map((url) => url?.trim().replace(/\/$/, ''))
  .filter(Boolean) as string[];
// Local FastAPI dev server uses HTTP. Do not change this to HTTPS unless
// Uvicorn is running with SSL certificates.
const MANUAL_API_BASE_URLS = [
  'http://10.110.221.227:8000',
  'http://172.18.9.227:8000',
  'http://10.185.143.227:8000',
  'http://10.222.99.227:8000',
];

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
  const expoHost = getExpoDevHost();
  const urls = [
    ...PRODUCTION_API_BASE_URLS,
    expoHost ? `http://${expoHost}:${API_PORT}` : null,
    ...MANUAL_API_BASE_URLS,
    Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : null,
    `http://127.0.0.1:${API_PORT}`,
    `http://localhost:${API_PORT}`,
  ].filter(Boolean) as string[];

  return [...new Set(urls)];
}

export const API_BASE_URL = getApiBaseUrls()[0];

export function getWebSocketBaseUrls() {
  return getApiBaseUrls().map((url) => url.replace(/^http/, 'ws'));
}
