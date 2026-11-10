import { getFormIdFromUrl, getTargetFromUrl } from './pageContext';

describe('getTargetFromUrl', () => {
  it.each([
    ['https://app.droplet.io/forms', 'forms'],
    ['https://app.droplet.io/forms/abc123/edit', 'forms'],
    ['https://app.droplet.io/form/abc123/submission/9', 'forms'],
    ['https://app.droplet.io/datasets', 'datasets'],
    ['https://demo1.app.droplet.io/datasets/xyz/edit?version=2', 'datasets'],
    ['https://app.droplet.io/home', null],
    ['https://example.com/forms', null],
    [undefined, null],
  ])('%s → %s', (url, expected) => {
    expect(getTargetFromUrl(url)).toBe(expected);
  });
});

describe('getFormIdFromUrl', () => {
  it.each([
    ['https://app.droplet.io/forms/abc123/edit', 'abc123'],
    ['https://demo1.app.droplet.io/form/abc123/submission/9', 'abc123'],
    ['https://app.droplet.io/forms', null],
    ['https://app.droplet.io/datasets/xyz/edit', null],
    ['https://example.com/forms/abc123/edit', null],
    [undefined, null],
  ])('%s → %s', (url, expected) => {
    expect(getFormIdFromUrl(url)).toBe(expected);
  });
});
