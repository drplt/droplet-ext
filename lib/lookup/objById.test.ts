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
        'GET esign/abc123': () => ok({ id: 'abc123', name: 'Offer letter' }),
        'GET datasets/abc123': () => fail(500, 'HASH-ID-INVALID-ID'),
      },
      'abc123',
    );
    const result = await promise;
    expect(result.hits).toEqual([
      { type: 'form', id: 'abc123', label: 'Intake', formId: null },
      { type: 'esignTemplate', id: 'abc123', label: 'Offer letter', formId: null },
    ]);
    expect(result.forbidden).toEqual([]);
  });

  it('only probes submission routes for numeric ids, and keeps their form id for linking', async () => {
    const hashLookup = lookup({}, 'abc123');
    await hashLookup.promise;
    expect(hashLookup.calls.some(call => call.path.startsWith('submissions/'))).toBe(false);

    // The API wraps a submission alongside its form version.
    const { promise } = lookup(
      { 'GET submissions/42': () => ok({ submission: { id: 42, formId: 'formA' }, form: { id: 'formA' } }) },
      ' 42 ',
    );
    expect((await promise).hits).toContainEqual({ type: 'submission', id: '42', label: '42', formId: 'formA' });
  });

  it('finds eSign submissions by numeric id', async () => {
    const { promise } = lookup({ 'GET esignSubmissions/7': () => ok({ id: 7, name: 'Signed offer' }) }, '7');
    expect((await promise).hits).toEqual([{ type: 'esignSubmission', id: '7', label: 'Signed offer', formId: null }]);
  });

  it('probes only the supported getById routes', async () => {
    const hashLookup = lookup({}, 'abc');
    await hashLookup.promise;
    expect(hashLookup.calls.map(call => call.path).sort()).toEqual([
      'datasets/abc',
      'esign/abc',
      'forms/abc',
      'packets/templates/abc',
    ]);

    const numericLookup = lookup({}, '42');
    await numericLookup.promise;
    expect(numericLookup.calls.map(call => call.path).sort()).toEqual([
      'datasets/42',
      'esign/42',
      'esignSubmissions/42',
      'forms/42',
      'packets/templates/42',
      'submissions/42',
    ]);
  });

  it('lists types the user is not allowed to check', async () => {
    const { promise } = lookup({ 'GET esign/abc': () => fail(403, 'FORBIDDEN') }, 'abc');
    expect((await promise).forbidden).toEqual(['esignTemplate']);
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
