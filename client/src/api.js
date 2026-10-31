const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok) throw new ApiError(response.status, payload.message || 'The request could not be completed.');
  return payload;
}

export const json = (method, body) => ({ method, body: JSON.stringify(body) });
