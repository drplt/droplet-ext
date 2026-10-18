import { z } from 'zod';

import { createFakeApi, fail, ok } from '@/test/fakeApi';

import { ApiError } from './api';

const anything = z.unknown();

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected rejection');
};

describe('createApiClient', () => {
  it('unwraps the success envelope and validates data', async () => {
    const { api, fetch } = createFakeApi({ 'GET forms/ids': () => ok({ count: 1, ids: ['a'] }) });
    await expect(api.get('forms/ids', z.object({ count: z.number(), ids: z.array(z.string()) }))).resolves.toEqual({
      count: 1,
      ids: ['a'],
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url instanceof Request ? url.url : url.toString()).toBe('https://api.droplet.io/v1/forms/ids');
    expect(init?.credentials).toBe('include');
  });

  it('sends JSON bodies and query parameters', async () => {
    const { api, calls } = createFakeApi({ 'POST forms/entities': () => ok([]) });
    await api.post('forms/entities', { ids: ['a'] }, anything, { query: { include: 'name', skip: undefined } });
    expect(calls[0]?.body).toEqual({ ids: ['a'] });
    expect(calls[0]?.query.get('include')).toBe('name');
    expect(calls[0]?.query.has('skip')).toBe(false);
  });

  it.each([
    [403, 'FORBIDDEN', 'forbidden'],
    [404, 'NOT-FOUND', 'notFound'],
    [500, 'HASH-ID-INVALID-ID', 'notFound'],
    [400, 'BAD-REQUEST', 'invalid'],
    [502, 'UPSTREAM', 'server'],
  ])('maps %i %s to %s', async (status, code, kind) => {
    const { api } = createFakeApi({ 'GET x': () => fail(status, code, 'nope') });
    const error = await rejection(api.get('x', anything));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe(kind);
    expect(error.message).toBe('nope');
  });

  it('rejects data that does not match the schema', async () => {
    const { api } = createFakeApi({ 'GET x': () => ok({ wrong: true }) });
    const error = await rejection(api.get('x', z.object({ id: z.string() })));
    expect(error.kind).toBe('invalid');
    expect(error.message).toContain('(id:');
  });

  it('reports network failures distinctly', async () => {
    const { api, fetch } = createFakeApi({});
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await rejection(api.get('x', anything))).kind).toBe('network');
  });

  it('reports cancellation as aborted', async () => {
    const { api } = createFakeApi({ 'GET x': () => ok(1) });
    const controller = new AbortController();
    controller.abort();
    expect((await rejection(api.get('x', anything, { signal: controller.signal }))).kind).toBe('aborted');
  });

  describe('expired access token', () => {
    it('renews access for the same organization and retries once', async () => {
      let renewed = false;
      const { api, calls } = createFakeApi(
        {
          'GET x': () => (renewed ? ok('fresh') : fail(401, 'UNAUTHORIZED')),
          'POST identity/access': () => {
            renewed = true;
            return ok({});
          },
        },
        { organizationId: 'org1' },
      );
      await expect(api.get('x', anything)).resolves.toBe('fresh');
      expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['GET x', 'POST identity/access', 'GET x']);
      expect(calls[1]?.body).toEqual({ organizationId: 'org1' });
    });

    it('shares one renewal across concurrent requests', async () => {
      let renewed = false;
      const { api, calls } = createFakeApi(
        {
          'GET x': () => (renewed ? ok(1) : fail(401, 'UNAUTHORIZED')),
          'POST identity/access': async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            renewed = true;
            return ok({});
          },
        },
        { organizationId: 'org1' },
      );
      await Promise.all([api.get('x', anything), api.get('x', anything), api.get('x', anything)]);
      expect(calls.filter(call => call.path === 'identity/access')).toHaveLength(1);
    });

    it('gives up as unauthorized when renewal fails', async () => {
      const { api, calls } = createFakeApi(
        {
          'GET x': () => fail(401, 'UNAUTHORIZED'),
          'POST identity/access': () => fail(401, 'UNAUTHORIZED'),
        },
        { organizationId: 'org1' },
      );
      expect((await rejection(api.get('x', anything))).kind).toBe('unauthorized');
      expect(calls).toHaveLength(2);
    });

    it('does not attempt renewal without an organization id', async () => {
      const { api, calls } = createFakeApi({ 'GET x': () => fail(401, 'UNAUTHORIZED') });
      expect((await rejection(api.get('x', anything))).kind).toBe('unauthorized');
      expect(calls).toHaveLength(1);
    });
  });
});
