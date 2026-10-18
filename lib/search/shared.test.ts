import { createFakeApi, ok } from '@/test/fakeApi';

import { resolveVersions } from './shared';

const versionsRoute = (versions: { locked: boolean; modified: string; version: string }[]) => ({
  'GET forms/f1/versions': () => ok({ count: versions.length, versions }),
});

const resolve = (
  routes: Parameters<typeof createFakeApi>[0],
  publishedVersion: null | string,
  includeDrafts = true,
) => {
  const { api, calls } = createFakeApi(routes);
  const item = { id: 'f1', name: 'Form', publishedVersion };
  return { calls, promise: resolveVersions('forms', api, item, includeDrafts, new AbortController().signal) };
};

describe('resolveVersions', () => {
  it('uses only the published version, without a request, when drafts are off', async () => {
    const { calls, promise } = resolve({}, 'v1', false);
    await expect(promise).resolves.toEqual([{ kind: 'published', version: 'v1' }]);
    expect(calls).toHaveLength(0);
  });

  it('returns nothing to search for a never-published item when drafts are off', async () => {
    await expect(resolve({}, null, false).promise).resolves.toEqual([]);
  });

  it('adds the newest version when it is a newer unpublished draft', async () => {
    const routes = versionsRoute([
      { version: 'v1', locked: true, modified: '2026-01-01T00:00:00.000Z' },
      { version: 'draft-5', locked: false, modified: '2026-05-01T00:00:00.000Z' },
    ]);
    await expect(resolve(routes, 'v1').promise).resolves.toEqual([
      { kind: 'published', version: 'v1' },
      { kind: 'draft', version: 'draft-5' },
    ]);
  });

  it('does not add a draft when the published version is the newest', async () => {
    const routes = versionsRoute([
      { version: 'draft-old', locked: false, modified: '2025-01-01T00:00:00.000Z' },
      { version: 'v2', locked: true, modified: '2026-01-01T00:00:00.000Z' },
    ]);
    await expect(resolve(routes, 'v2').promise).resolves.toEqual([{ kind: 'published', version: 'v2' }]);
  });

  it('searches just the draft for a never-published item', async () => {
    const routes = versionsRoute([{ version: 'draft-1', locked: false, modified: '2026-01-01T00:00:00.000Z' }]);
    await expect(resolve(routes, null).promise).resolves.toEqual([{ kind: 'draft', version: 'draft-1' }]);
  });
});
