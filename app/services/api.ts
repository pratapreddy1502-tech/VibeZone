import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  API_WAKE_RETRY_COUNT,
  API_WAKE_RETRY_DELAY_MS,
  SERVER_WAKE_MESSAGE,
} from '../config/api';

export const SESSION_EXPIRED_MESSAGE =
  'Your login session expired. Please log in again.';

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
  wakeRetries?: number;
};

function makeUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

function logResponseBody(data: unknown) {
  const redactedKeys = new Set([
    'token',
    'access_token',
    'refresh_token',
    'password',
  ]);
  const replacer = (key: string, value: unknown) =>
    redactedKeys.has(key) ? '[redacted]' : value;
  const body =
    typeof data === 'string'
      ? data
      : JSON.stringify(data, replacer, 2);

  return body && body.length > 1200 ? `${body.slice(0, 1200)}...` : body;
}

async function readResponseData(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function apiErrorMessage(data: any, fallback = 'API request failed') {
  const detail = data?.error || data?.detail || data?.message;

  if (detail === 'Could not validate credentials') {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (Array.isArray(detail)) {
    return fallback;
  }

  return detail ? String(detail) : fallback;
}

export function isSessionExpiredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes(SESSION_EXPIRED_MESSAGE) ||
    message.includes('Could not validate credentials')
  );
}

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  const name = error instanceof Error ? error.name : '';

  return (
    name === 'AbortError' ||
    message.includes('Network request failed') ||
    message.includes('Failed to fetch') ||
    message.includes('ECONNREFUSED') ||
    normalizedMessage.includes('timeout') ||
    message.includes('NetworkError') ||
    message.includes('AbortError') ||
    normalizedMessage.includes('aborted')
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchApi(
  endpoint: string,
  init: ApiRequestInit = {}
) {
  const {
    timeoutMs = API_TIMEOUT_MS,
    wakeRetries = 0,
    ...requestInit
  } = init;
  const requestTimeoutMs = Math.max(timeoutMs, API_TIMEOUT_MS);
  const requestUrl = makeUrl(API_BASE_URL, endpoint);
  const method = requestInit.method || 'GET';

  console.log(`[VibeZone API] ${method} ${requestUrl}`);

  for (let attempt = 0; attempt <= wakeRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(requestUrl, {
        ...requestInit,
        signal: requestInit.signal || controller.signal,
      });
      const data = await readResponseData(response);

      console.log(`[VibeZone API] ${response.status} ${requestUrl}`);
      console.log('[VibeZone API] response body', logResponseBody(data));

      return { response, data, baseUrl: API_BASE_URL };
    } catch (error) {
      console.error(`[VibeZone API] fetch exception ${requestUrl}`, error);

      if (!isNetworkError(error)) {
        throw error;
      }

      if (attempt < wakeRetries) {
        const delay = API_WAKE_RETRY_DELAY_MS * (attempt + 1);
        console.log(
          `[VibeZone API] backend wake retry ${attempt + 1}/${wakeRetries} in ${delay}ms`
        );
        await wait(delay);
        continue;
      }

      throw new Error(SERVER_WAKE_MESSAGE);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(SERVER_WAKE_MESSAGE);
}

export async function checkBackendHealth() {
  const { response } = await fetchApi('/health', {
    method: 'GET',
    timeoutMs: API_TIMEOUT_MS,
    wakeRetries: API_WAKE_RETRY_COUNT,
  });

  if (!response.ok) {
    throw new Error(SERVER_WAKE_MESSAGE);
  }
}

export async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string,
  timeoutMs?: number
) {
  const requestMethod = method.toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { response, data } = await fetchApi(endpoint, {
    method: requestMethod,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    timeoutMs,
    wakeRetries: requestMethod === 'GET' ? API_WAKE_RETRY_COUNT : 0,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data));
  }

  return data;
}
