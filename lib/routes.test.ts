import { getObjectPath, getObjectUrl, isOnObjectPage } from './routes';

describe('getObjectPath', () => {
  it('links forms and datasets to their builders', () => {
    expect(getObjectPath({ type: 'form', id: 'abc' })).toBe('/forms/abc/edit');
    expect(getObjectPath({ type: 'dataset', id: 'xyz' })).toBe('/datasets/xyz/edit');
  });

  it('nests submissions under their form, and needs the form id to do so', () => {
    expect(getObjectPath({ type: 'submission', id: '42', formId: 'abc' })).toBe('/form/abc/submission/42');
    expect(getObjectPath({ type: 'submission', id: '42' })).toBeNull();
  });

  it('encodes ids so they cannot alter the path', () => {
    expect(getObjectPath({ type: 'form', id: '../admin?x=1' })).toBe('/forms/..%2Fadmin%3Fx%3D1/edit');
  });
});

describe('getObjectUrl', () => {
  it('resolves against the app origin', () => {
    expect(getObjectUrl('https://demo1.app.droplet.io', { type: 'packet', id: 'p1' })).toBe(
      'https://demo1.app.droplet.io/packets/p1',
    );
  });
});

describe('isOnObjectPage', () => {
  it.each([
    ['form', 'https://app.droplet.io/forms', true],
    ['form', 'https://app.droplet.io/forms/abc/edit', true],
    ['form', 'https://app.droplet.io/datasets', false],
    ['dataset', 'https://app.droplet.io/datasets?page=2', true],
    ['dataset', 'https://app.droplet.io/forms', false],
    ['dataset', 'https://app.droplet.io/datasetsx', false],
    ['submission', 'https://app.droplet.io/form/abc/submission/1', true],
    ['tag', 'https://app.droplet.io/organization/roles', false],
    ['form', undefined, false],
  ] as const)('%s on %s → %s', (type, url, expected) => {
    expect(isOnObjectPage(type, url)).toBe(expected);
  });
});
