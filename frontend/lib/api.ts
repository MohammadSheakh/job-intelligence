'use client';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Preserve the API error contract so navigation does not depend on display-message wording. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Map protected-route failures to the authentication step that can resolve them. */
export function candidateAuthRedirect(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) return '/candidate/login';
  if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED')
    return '/candidate/change-password';
  return null;
}

/** Include the signed cookie on API requests and retain structured failures for callers. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message;
    throw new ApiError(message ?? 'Request failed.', response.status, payload.code);
  }
  return response.json() as Promise<T>;
}
