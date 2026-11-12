// Shared helpers for the API layer: error type + token storage.

export class ApiError extends Error {
  constructor(status, message, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status (0 = cannot reach server)
    this.errors = errors; // field errors, e.g. { title: ['Title is required'] }
  }
}

const TOKEN_KEY = 'focusparty_token';
let memoryToken = null; // fallback when localStorage is blocked

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
