export const API_BASE_URL = 'https://vibezone-mwg7.onrender.com';
export const API_TIMEOUT_MS = 60000;
export const SERVER_WAKE_MESSAGE =
  'Server is waking up. Please wait a few seconds and try again.';

export const WEB_SOCKET_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export function getApiBaseUrls() {
  return [API_BASE_URL];
}

export function getWebSocketBaseUrls() {
  return [WEB_SOCKET_BASE_URL];
}
