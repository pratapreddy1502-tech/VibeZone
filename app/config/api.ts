export const API_BASE_URL = 'https://vibezone-mwg7.onrender.com';
export const API_TIMEOUT_MS = 120000;
export const API_WAKE_RETRY_COUNT = 3;
export const API_WAKE_RETRY_DELAY_MS = 3000;
export const SERVER_WAKE_MESSAGE =
  'Server is starting. Please keep the app open and try again in a moment.';

export const WEB_SOCKET_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export function getApiBaseUrls() {
  return [API_BASE_URL];
}

export function getWebSocketBaseUrls() {
  return [WEB_SOCKET_BASE_URL];
}
