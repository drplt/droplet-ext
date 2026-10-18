// A tiny in-memory Droplet API for tests: route table → fetch implementation, used with the real API client.
import { createApiClient } from '@/lib/api';

type FakeRequest = { body: unknown; method: string; path: string; query: URLSearchParams };
type FakeReply = { body?: unknown; status?: number };
type Handler = (request: FakeRequest) => FakeReply | Promise<FakeReply>;

const API_ORIGIN = 'https://api.droplet.io';

const ok = (data: unknown): FakeReply => ({ status: 200, body: { requestId: 'test', success: true, data } });
const fail = (status: number, code: string, message = code): FakeReply => ({
  status,
  body: { requestId: 'test', success: false, error: { code, message } },
});

/** Routes are "METHOD /path" with the /v1 prefix omitted, e.g. "GET forms/ids". Unknown routes 404. */
const createFakeApi = (routes: Record<string, Handler>, options: { organizationId?: string } = {}) => {
  const calls: FakeRequest[] = [];

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = init?.method ?? 'GET';
    const path = decodeURIComponent(url.pathname.replace(/^\/v1\//, ''));
    const request: FakeRequest = {
      method,
      path,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(request);
    const handler = routes[`${method} ${path}`];
    const reply = handler ? await handler(request) : fail(404, 'NOT-FOUND');
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const api = createApiClient({
    apiOrigin: API_ORIGIN,
    fetch: fetchImpl,
    getOrganizationId: () => options.organizationId ?? null,
  });

  return { api, calls, fetch: fetchImpl };
};

export { API_ORIGIN, createFakeApi, fail, ok };
