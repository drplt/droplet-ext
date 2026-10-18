// Thin fetch wrapper for the Droplet API. Runs inside the content script on the Droplet app origin, so the
// browser attaches the user's session cookie itself (`credentials: 'include'`) — the extension never sees or
// stores a token.
import type { z } from 'zod';

import { envelope } from './schemas';

const API_VERSION = 'v1';

type ApiErrorKind = 'aborted' | 'forbidden' | 'invalid' | 'network' | 'notFound' | 'server' | 'unauthorized';

class ApiError extends Error {
  readonly code: string | undefined;
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.code = options.code;
    this.status = options.status;
  }
}

type RequestOptions = {
  query?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

type ApiClient = {
  get: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) => Promise<T>;
  post: <T>(path: string, body: unknown, schema: z.ZodType<T>, options?: RequestOptions) => Promise<T>;
};

type ApiClientOptions = {
  apiOrigin: string;
  fetch?: typeof fetch;
  /** Returns the active organization id so an expired access token can be renewed for the same org. */
  getOrganizationId?: () => null | string;
};

const kindForStatus = (status: number, code: string | undefined): ApiErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404 || code?.endsWith('INVALID-ID') === true || code?.endsWith('NOT-FOUND') === true) {
    return 'notFound';
  }
  if (status >= 500) return 'server';
  return 'invalid';
};

const createApiClient = ({ apiOrigin, fetch: fetchImpl = fetch, getOrganizationId }: ApiClientOptions): ApiClient => {
  // Access tokens live ~5 minutes; long searches will outlive one. Share a single in-flight refresh so a burst
  // of concurrent 401s triggers one renewal.
  let refreshing: null | Promise<boolean> = null;

  const buildUrl = (path: string, query: RequestOptions['query']) => {
    const url = new URL(`/${API_VERSION}/${path.replace(/^\/+/, '')}`, apiOrigin);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
  };

  const send = async (method: string, url: string, body: unknown, signal: AbortSignal | undefined) => {
    try {
      return await fetchImpl(url, {
        method,
        credentials: 'include',
        headers:
          body === undefined
            ? { accept: 'application/json' }
            : { accept: 'application/json', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled');
      throw new ApiError('network', 'Could not reach Droplet. Check your connection and try again.');
    }
  };

  // Mirrors drplt's own client: POST /identity/access with the current org re-issues the access cookie from the
  // longer-lived identity cookie. Same org, so the user's session is not switched.
  const refreshAccess = (signal: AbortSignal | undefined) => {
    refreshing ??= (async () => {
      const organizationId = getOrganizationId?.();
      if (!organizationId) return false;
      try {
        const response = await send('POST', buildUrl('identity/access', undefined), { organizationId }, signal);
        return response.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const parse = async <T>(response: Response, schema: z.ZodType<T>): Promise<T> => {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ApiError(kindForStatus(response.status, undefined), `Unexpected response (${response.status})`, {
        status: response.status,
      });
    }

    const parsed = envelope.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        response.ok ? 'invalid' : kindForStatus(response.status, undefined),
        'Unexpected response shape',
        {
          status: response.status,
        },
      );
    }
    if (!parsed.data.success) {
      const { code, message } = parsed.data.error;
      throw new ApiError(kindForStatus(response.status, code), message, { code, status: response.status });
    }
    if (!response.ok) {
      throw new ApiError(kindForStatus(response.status, undefined), `Request failed (${response.status})`, {
        status: response.status,
      });
    }

    const data = schema.safeParse(parsed.data.data);
    if (!data.success) {
      const [issue] = data.error.issues;
      const where = issue?.path.length ? ` (${issue.path.join('.')}: ${issue.message})` : '';
      throw new ApiError('invalid', `Droplet returned data in an unexpected format${where}`, {
        status: response.status,
      });
    }
    return data.data;
  };

  const request = async <T>(
    method: string,
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ) => {
    const url = buildUrl(path, options.query);
    let response = await send(method, url, body, options.signal);
    if (response.status === 401 && (await refreshAccess(options.signal))) {
      response = await send(method, url, body, options.signal);
    }
    return parse(response, schema);
  };

  return {
    get: (path, schema, options) => request('GET', path, undefined, schema, options),
    post: (path, body, schema, options) => request('POST', path, body, schema, options),
  };
};

export { type ApiClient, ApiError, type ApiErrorKind, createApiClient };
