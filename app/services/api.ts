import { getApiBaseUrls } from '../config/api';

const API_TIMEOUT_MS = 4500;
export const SESSION_EXPIRED_MESSAGE =
  'Your login session expired. Please log in again.';

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

function makeUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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

function isAbortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  const name = error instanceof Error ? error.name : '';

  return (
    name === 'AbortError' ||
    message.includes('AbortError') ||
    normalizedMessage.includes('aborted') ||
    normalizedMessage.includes('timeout')
  );
}

export async function fetchApi(
  endpoint: string,
  init: ApiRequestInit = {}
) {
  const baseUrls = getApiBaseUrls();
  let lastError: unknown = null;
  const { timeoutMs = API_TIMEOUT_MS, ...requestInit } = init;

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(makeUrl(baseUrl, endpoint), {
        ...requestInit,
        signal: requestInit.signal || controller.signal,
      });
      const data = await readResponseData(response);
      return { response, data, baseUrl };
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const tried = baseUrls.join(', ');
  const detail = isAbortError(lastError)
    ? 'Request timed out. Check that FastAPI is running on port 8000 and your phone can reach the PC.'
    : lastError instanceof Error
      ? lastError.message
      : String(lastError);

  throw new Error(
    `Cannot reach FastAPI backend. Tried: ${tried}. ${detail}`
  );
}

export async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string,
  timeoutMs?: number
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { response, data } = await fetchApi(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    timeoutMs,
  });

  if (!response.ok || data?.error) {
    throw new Error(apiErrorMessage(data));
  }

  return data;
}
