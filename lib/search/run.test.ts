import { createFakeApi, fail } from '@/test/fakeApi';
import { fixtureRoutes } from '@/test/fixtures/droplet';

import { datasetsTarget, describeLocation } from './datasets';
import { formsTarget } from './forms';
import { runSearch } from './run';

const search = (target: typeof formsTarget, query: string, includeDrafts = false, routes = fixtureRoutes) => {
  const { api, calls } = createFakeApi(routes);
  const onProgress = vi.fn();
  const promise = runSearch({
    api,
    query,
    target,
    options: { includeDrafts },
    signal: new AbortController().signal,
    callbacks: { onProgress },
  });
  return { calls, onProgress, promise };
};

describe('findStringInObj: forms', () => {
  it('searches published versions across every form field', async () => {
    const summary = await search(formsTarget, 'patient').promise;
    expect(summary.total).toBe(3);
    expect(summary.searched).toBe(3);
    expect(summary.hits).toHaveLength(1);
    const [hit] = summary.hits;
    expect(hit).toMatchObject({ id: 'formA', name: 'Patient Intake', objectType: 'form' });
    expect(hit?.matchCount).toBe(3);
    expect(hit?.matches.map(match => match.location)).toEqual(['Layout', 'Layout', 'Notifications']);
    expect(hit?.matches.every(match => match.version.kind === 'published' && match.version.version === 'v2')).toBe(
      true,
    );
  });

  it('reports never-published forms as skipped by default, and records per-item permission errors', async () => {
    const summary = await search(formsTarget, 'patient').promise;
    expect(summary.hits.map(hit => hit.id)).not.toContain('formB');
    expect(summary.skipped).toEqual([{ id: 'formB', name: 'Field Trip' }]);
    expect(summary.errors).toEqual([{ id: 'formC', name: 'Locked Down', kind: 'forbidden', message: 'Access Denied' }]);
  });

  it('with drafts included, searches the published version AND the newer draft, labelling each match', async () => {
    const summary = await search(formsTarget, 'patient', true, {
      ...fixtureRoutes,
      'GET forms/formC/versions': () => fail(403, 'FORBIDDEN'),
    }).promise;
    const describe = (id: string) =>
      summary.hits
        .find(hit => hit.id === id)
        ?.matches.map(match => `${match.version.kind}:${match.version.version}:${match.location}`);

    // Text that exists only in the published version is still found.
    expect(describe('formA')).toEqual([
      'published:v2:Layout',
      'published:v2:Layout',
      'published:v2:Notifications',
      'draft:draft-2:Layout',
    ]);
    // Never-published forms are searched through their draft instead of being skipped.
    expect(describe('formB')).toEqual(['draft:draft-1:Layout']);
    expect(summary.skipped).toEqual([]);
  });

  it('requests only the searchable fields', async () => {
    const { calls, promise } = search(formsTarget, 'patient');
    await promise;
    const versionCall = calls.find(call => call.path === 'forms/formA/versions/v2');
    expect(versionCall?.query.get('include')).toContain('layout');
  });

  it('reports progress for every item', async () => {
    const { onProgress, promise } = search(formsTarget, 'patient');
    await promise;
    expect(onProgress).toHaveBeenLastCalledWith({ done: 3, total: 3 });
  });

  it('stops the whole run when the session ends', async () => {
    const { promise } = search(formsTarget, 'patient', false, {
      ...fixtureRoutes,
      'GET forms/formA/versions/v2': () => fail(401, 'UNAUTHORIZED'),
    });
    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('fails clearly when the user cannot list forms', async () => {
    const { promise } = search(formsTarget, 'patient', false, {
      ...fixtureRoutes,
      'GET forms/ids': () => fail(403, 'FORBIDDEN'),
    });
    await expect(promise).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('does nothing for a blank query', async () => {
    const { calls, promise } = search(formsTarget, '  ');
    await expect(promise).resolves.toMatchObject({ total: 0, hits: [] });
    expect(calls).toHaveLength(0);
  });
});

describe('findStringInObj: datasets', () => {
  it('finds values and labels them by row and column name', async () => {
    const summary = await search(datasetsTarget, 'patient').promise;
    expect(summary.hits).toHaveLength(1);
    const [hit] = summary.hits;
    expect(hit).toMatchObject({ id: 'dsA', name: 'Clinics', matchCount: 2, objectType: 'dataset' });
    expect(hit?.matches.map(match => match.location)).toEqual(['Row 1 · Email', 'Row 2 · nested · note']);
  });
});

describe('describeLocation', () => {
  const columns = new Map([['col_1', 'Name']]);
  it.each([
    [[0, 'col_1'], 'Row 1 · Name'],
    [[4, 'unknown'], 'Row 5 · unknown'],
    [['key', 'inner', 'deep'], 'key · inner · deep'],
    [[2, 3], 'Row 3 · [3]'],
    [[], 'Value'],
  ])('%j → %s', (path, expected) => {
    expect(describeLocation(path, columns)).toBe(expected);
  });
});
