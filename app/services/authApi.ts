import { apiRequest } from './api';

export function login(data: {
  email: string;
  password: string;
}) {
  return apiRequest('/login', 'POST', data);
}

export function register(data: {
  username: string;
  email: string;
  password: string;
}) {
  return apiRequest('/register', 'POST', data);
}

export function requestEmailOtp(data: {
  username: string;
  email: string;
}) {
  return apiRequest('/request-email-otp', 'POST', data);
}

export function verifyRegister(data: {
  username: string;
  email: string;
  password: string;
  otp: string;
}) {
  return apiRequest('/verify-register', 'POST', data);
}
