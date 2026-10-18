// Fixture org: two forms (one unpublished) and two datasets, shaped like real Droplet API responses.
import type { createFakeApi } from '@/test/fakeApi';

import { fail, ok } from '@/test/fakeApi';

const forms = [
  { id: 'formA', name: 'Patient Intake', publishedVersion: 'v2' },
  { id: 'formB', name: 'Field Trip', publishedVersion: null },
  { id: 'formC', name: 'Locked Down', publishedVersion: 'v1' },
];

const formVersions: Record<string, Record<string, Record<string, unknown>>> = {
  formA: {
    v2: {
      version: 'v2',
      layout: '<Page>\n  <TextInput label="Patient name" name="patientName" />\n</Page>',
      workflow: '{"steps":[{"assignee":"nurse@example.com"}]}',
      notifications: '[{"subject":"New patient submitted"}]',
      translations: null,
    },
    'draft-2': { version: 'draft-2', layout: '<Page><TextInput label="Patient email" /></Page>' },
  },
  formB: {
    'draft-1': { version: 'draft-1', layout: '<Page><TextInput label="Patient guardian" /></Page>' },
  },
};

const datasets = [
  { id: 'dsA', name: 'Clinics', publishedVersion: '3' },
  { id: 'dsB', name: 'Empty', publishedVersion: '1' },
];

const datasetVersions: Record<string, Record<string, unknown>> = {
  'dsA@3': {
    version: '3',
    data: [
      { col_1: 'North Clinic', col_2: 'patient-intake@north.org' },
      { col_1: 'South Clinic', col_2: 'south@example.org', nested: { note: 'No patients on Sundays' } },
    ],
    configuration: {
      columnConfigurations: [
        { identifier: 'col_1', name: 'Name' },
        { identifier: 'col_2', name: 'Email' },
      ],
    },
  },
  'dsB@1': { version: '1', data: [], configuration: null },
};

// Like the real API, `?include=` returns only the listed fields (drplt/src/spec/forms|datasets getVersion).
const withIncludes =
  (doc: Record<string, unknown> | undefined) =>
  ({ query }: { query: URLSearchParams }) => {
    const include = query.get('include')?.split(',');
    if (!doc) return fail(404, 'NOT-FOUND');
    return ok(include ? Object.fromEntries(Object.entries(doc).filter(([key]) => include.includes(key))) : doc);
  };

const fixtureRoutes: Parameters<typeof createFakeApi>[0] = {
  'GET forms/ids': () => ok({ count: forms.length, ids: forms.map(form => form.id) }),
  'POST forms/entities': ({ body }) => ok(forms.filter(form => (body as { ids: string[] }).ids.includes(form.id))),
  'GET forms/formA/versions': () =>
    ok({
      count: 2,
      versions: [
        { version: 'v2', locked: true, modified: '2026-01-01T00:00:00Z' },
        { version: 'draft-2', locked: false, modified: '2026-02-01T00:00:00Z' },
      ],
    }),
  'GET forms/formB/versions': () =>
    ok({ count: 1, versions: [{ version: 'draft-1', locked: false, modified: '2026-03-01T00:00:00Z' }] }),
  'GET forms/formC/versions/v1': () => fail(403, 'FORBIDDEN', 'Access Denied'),
  'GET forms/formA/versions/v2': withIncludes(formVersions.formA?.v2),
  'GET forms/formA/versions/draft-2': withIncludes(formVersions.formA?.['draft-2']),
  'GET forms/formB/versions/draft-1': withIncludes(formVersions.formB?.['draft-1']),
  'GET datasets/ids': () => ok({ count: datasets.length, ids: datasets.map(dataset => dataset.id) }),
  'POST datasets/entities': () => ok(datasets),
  'GET datasets/dsA/versions/3': withIncludes(datasetVersions['dsA@3']),
  'GET datasets/dsB/versions/1': withIncludes(datasetVersions['dsB@1']),
};

export { fixtureRoutes };
