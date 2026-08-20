import type { Session } from './types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(
  /\/$/,
  '',
);

/** Storage keys match the reference solution, so tokens survive a rename. */
const ACCESS_KEY = 'admin.accessToken';
const REFRESH_KEY = 'admin.refreshToken';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field-level validation messages, when the API returned any. */
    readonly errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The first field error if there is one, otherwise the summary message. */
  get detail(): string {
    return this.errors?.[0] ?? this.message;
  }
}

// -------------------------------------------------------------------- storage

export const tokens = {
  access: (): string | null =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(ACCESS_KEY),
  refresh: (): string | null =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_KEY),
  save: (session: Pick<Session, 'accessToken' | 'refreshToken'>): void => {
    window.localStorage.setItem(ACCESS_KEY, session.accessToken);
    window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
  },
  clear: (): void => {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

// --------------------------------------------------------------------- client

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Skip the Authorization header and the refresh dance — used by /auth/*. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

/**
 * A single in-flight refresh, shared by every request that got a 401 at the same
 * time. Without this, ten parallel table loads would each try to rotate the
 * refresh token, and reuse detection would log the user out.
 */
let refreshInFlight: Promise<string | null> | null = null;

/** Called when the session cannot be recovered, so the app can bounce to login. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed.';
  let errors: string[] | undefined;

  try {
    const body = (await response.json()) as { message?: string; errors?: string[] };
    if (body.message) message = body.message;
    if (body.errors) errors = body.errors;
  } catch {
    // A non-JSON error body (a gateway timeout, say) leaves the status text.
  }

  return new ApiError(response.status, message, errors);
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = tokens.refresh();
  if (!refreshToken) return null;

  try {
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const session = (await response.json()) as Session;
    tokens.save(session);
    return session.accessToken;
  } catch {
    return null;
  }
}

async function send<T>(path: string, options: RequestOptions, retrying = false): Promise<T> {
  const { method = 'GET', body, query, anonymous, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!anonymous) {
    const accessToken = tokens.access();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  });

  if (response.status === 401 && !anonymous && !retrying) {
    // Coalesce concurrent refreshes: whoever gets here first does the rotation.
    refreshInFlight ??= refreshSession().finally(() => {
      refreshInFlight = null;
    });

    const accessToken = await refreshInFlight;

    if (accessToken) return send<T>(path, options, true);

    tokens.clear();
    onSessionExpired?.();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> =>
    send<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown): Promise<T> => send<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> => send<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown): Promise<T> => send<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string): Promise<T> => send<T>(path, { method: 'DELETE' }),
  /** For the sign-in endpoints, which must not carry or refresh a token. */
  anonymous: {
    get: <T>(path: string): Promise<T> => send<T>(path, { method: 'GET', anonymous: true }),
    post: <T>(path: string, body?: unknown): Promise<T> =>
      send<T>(path, { method: 'POST', body, anonymous: true }),
  },
};

export { API_URL };
