import { getOrganizationId } from './session';

const storageWith = (value: null | string) => ({ getItem: () => value });

describe('getOrganizationId', () => {
  it('reads the id from the stored organization object', () => {
    expect(getOrganizationId(storageWith(JSON.stringify({ id: 'org123', name: 'Acme' })))).toBe('org123');
  });

  it('accepts a bare id string', () => {
    expect(getOrganizationId(storageWith(JSON.stringify('org123')))).toBe('org123');
  });

  it.each([null, '', 'not json', '{"name":"no id"}', '42'])('returns null for %s', raw => {
    expect(getOrganizationId(storageWith(raw))).toBeNull();
  });

  it('returns null when storage throws', () => {
    expect(
      getOrganizationId({
        getItem: () => {
          throw new Error('denied');
        },
      }),
    ).toBeNull();
  });
});
