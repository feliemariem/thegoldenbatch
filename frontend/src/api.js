import { API_URL } from './config';

/**
 * Centralized API helpers for fetch calls
 * All helpers return the raw Response object for consistent error handling
 * Authentication is handled via HTTP-only cookies (credentials: 'include')
 */

// GET request (public or authenticated via cookies)
export const api = (endpoint) => {
  return fetch(`${API_URL}${endpoint}`, {
    credentials: 'include',
  });
};

// POST request (public endpoints like login, register)
export const apiPostPublic = (endpoint, data) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

// GET request (authenticated via cookies)
export const apiGet = (endpoint) => {
  return fetch(`${API_URL}${endpoint}`, {
    credentials: 'include',
  });
};

// POST request (authenticated via cookies)
export const apiPost = (endpoint, data) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

// PUT request (authenticated via cookies)
export const apiPut = (endpoint, data) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
};

// DELETE request (authenticated via cookies)
export const apiDelete = (endpoint) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    credentials: 'include',
  });
};

// File upload POST (authenticated via cookies)
export const apiUpload = (endpoint, formData) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
};

// File upload PUT (authenticated via cookies)
export const apiUploadPut = (endpoint, formData) => {
  return fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    credentials: 'include',
    body: formData,
  });
};
