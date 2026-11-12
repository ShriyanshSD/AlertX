import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiError(error) {
  return error.response?.data?.error?.message || error.message || 'The request could not be completed.';
}

export default api;
