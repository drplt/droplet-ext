import { formatShortDate, versionOptionLabel } from './format';

const now = new Date('2026-11-16T12:00:00');

describe('formatShortDate', () => {
  it('drops the year for dates in the current year', () => {
    expect(formatShortDate('2026-10-02T12:00:00', now)).toBe('Oct 2');
    expect(formatShortDate('2025-10-02T12:00:00', now)).toBe('Oct 2, 2025');
  });

  it('passes through what it cannot parse', () => {
    expect(formatShortDate(null, now)).toBe('');
    expect(formatShortDate('someday', now)).toBe('someday');
  });
});

describe('versionOptionLabel', () => {
  it('fits a version on one short line', () => {
    const version = { version: 'v14', locked: true, published: true, modified: '2026-10-02T12:00:00' };
    expect(versionOptionLabel(version, now)).toBe('v14 · Published · Oct 2');
  });
});
