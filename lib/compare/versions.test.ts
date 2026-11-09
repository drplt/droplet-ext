import { createFakeApi, fail, ok } from '@/test/fakeApi';
import { formVersionV1, formVersionV2 } from '@/test/fixtures/formVersions';

import { compareFormVersions, listFormVersions } from './versions';

const routes: Parameters<typeof createFakeApi>[0] = {
  'GET forms/formA': () => ok({ id: 'formA', name: 'Evaluation', publishedVersion: 'v-1' }),
  'GET forms/formA/versions': () =>
    ok({
      count: 2,
      versions: [
        { version: 'v-1', locked: true, modified: '2026-01-01T00:00:00Z' },
        { version: 'v-2', locked: false, modified: '2026-02-01T00:00:00Z' },
      ],
    }),
  'GET forms/formA/versions/v-1': () => ok(formVersionV1),
  'GET forms/formA/versions/v-2': () => ok(formVersionV2),
};

describe('listFormVersions', () => {
  it('lists versions newest first and marks the published one', async () => {
    const { api } = createFakeApi(routes);
    await expect(listFormVersions(api, 'formA')).resolves.toEqual({
      id: 'formA',
      name: 'Evaluation',
      versions: [
        { version: 'v-2', locked: false, modified: '2026-02-01T00:00:00Z', published: false },
        { version: 'v-1', locked: true, modified: '2026-01-01T00:00:00Z', published: true },
      ],
    });
  });

  it('passes on a permission error', async () => {
    const { api } = createFakeApi({ ...routes, 'GET forms/formA/versions': () => fail(403, 'FORBIDDEN') });
    await expect(listFormVersions(api, 'formA')).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('compareFormVersions', () => {
  it('fetches both versions with their documents and compares them', async () => {
    const { api, calls } = createFakeApi(routes);
    const comparison = await compareFormVersions(
      api,
      { formId: 'formA', from: 'v-1', to: 'v-2' },
      new AbortController().signal,
    );

    expect(comparison.form).toEqual({ id: 'formA', name: 'Evaluation' });
    expect(comparison.from).toMatchObject({ version: 'v-1', published: true });
    expect(comparison.to).toMatchObject({ version: 'v-2', published: false });
    expect(comparison.fields.filter(field => field.changes.length > 0).map(field => field.field)).toEqual([
      'layout',
      'workflow',
      'steps',
    ]);
    expect(calls.find(call => call.path === 'forms/formA/versions/v-2')?.query.get('include')).toContain('layout');
  });
});
