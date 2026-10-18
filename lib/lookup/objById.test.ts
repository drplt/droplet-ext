import { createFakeApi, fail, ok } from '@/test/fakeApi';

import { findObjById } from './objById';

const lookup = (routes: Parameters<typeof createFakeApi>[0], id: string) => {
  const { api, calls } = createFakeApi(routes);
  return { calls, promise: findObjById(api, id, new AbortController().signal) };
};

describe('findObjById', () => {
  it('reports the type(s) an id resolves to', async () => {
    const { promise } = lookup(
      {
        'GET forms/abc123': () => ok({ id: 'abc123', name: 'Intake' }),
        'GET tags/abc123': () => ok({ id: 'abc123', name: 'urgent' }),
        'GET datasets/abc123': () => fail(500, 'HASH-ID-INVALID-ID'),
      },
      'abc123',
    );
    const result = await promise;
    expect(result.hits).toEqual([
      { type: 'form', id: 'abc123', label: 'Intake', formId: null },
      { type: 'tag', id: 'abc123', label: 'urgent', formId: null },
    ]);
    expect(result.forbidden).toEqual([]);
  });

  it('only probes submission routes for numeric ids, and keeps their form id for linking', async () => {
    const hashLookup = lookup({}, 'abc123');
    await hashLookup.promise;
    expect(hashLookup.calls.some(call => call.path.startsWith('submissions/'))).toBe(false);

    const { promise } = lookup({ 'GET submissions/42': () => ok({ id: 42, formId: 'formA' }) }, ' 42 ');
    expect((await promise).hits).toContainEqual({ type: 'submission', id: '42', label: '42', formId: 'formA' });
  });

  it('finds accounts through the entities endpoint', async () => {
    const { calls, promise } = lookup(
      { 'POST accounts/entities': () => ok([{ id: 'acc1', fullName: 'Ada Lovelace', email: 'ada@example.com' }]) },
      'acc1',
    );
    expect((await promise).hits).toEqual([{ type: 'account', id: 'acc1', label: 'Ada Lovelace', formId: null }]);
    expect(calls.find(call => call.path === 'accounts/entities')?.body).toEqual({ ids: ['acc1'] });
  });

  it('lists types the user is not allowed to check', async () => {
    const { promise } = lookup({ 'GET employees/abc': () => fail(403, 'FORBIDDEN') }, 'abc');
    expect((await promise).forbidden).toEqual(['employee']);
  });

  it('surfaces an expired session instead of reporting "not found"', async () => {
    const { promise } = lookup({ 'GET forms/abc': () => fail(401, 'UNAUTHORIZED') }, 'abc');
    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('does nothing for a blank id', async () => {
    const { calls, promise } = lookup({}, '   ');
    await expect(promise).resolves.toEqual({ forbidden: [], hits: [] });
    expect(calls).toHaveLength(0);
  });
});
