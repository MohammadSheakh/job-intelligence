'use client';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...options });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.message ?? 'Request failed.'); }
  return response.json() as Promise<T>;
}
