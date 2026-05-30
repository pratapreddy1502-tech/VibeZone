import { apiRequest, checkBackendHealth } from './api';

export async function login(data: {
  email: string;
  password: string;
}) {
  await checkBackendHealth();
  return apiRequest('/login', 'POST', data);
}

export async function register(data: {
  username: string;
  email: string;
  password: string;
}) {
  await checkBackendHealth();
  return apiRequest('/register', 'POST', data);
}

export async function requestEmailOtp(data: {
  username: string;
  email: string;
}) {
  await checkBackendHealth();
  return apiRequest('/request-email-otp', 'POST', data);
}

export async function verifyRegister(data: {
  username: string;
  email: string;
  password: string;
  otp: string;
}) {
  await checkBackendHealth();
  return apiRequest('/verify-register', 'POST', data);
}

export function getCurrentUser(token: string) {
  return apiRequest('/me', 'GET', undefined, token);
}
