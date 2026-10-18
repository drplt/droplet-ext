import { getDropletEnv, isDropletAppUrl } from './env';

describe('getDropletEnv', () => {
  it.each([
    ['https://app.droplet.io/forms', 'https://app.droplet.io', 'https://api.droplet.io'],
    ['https://demo1.app.droplet.io/datasets/abc/edit', 'https://demo1.app.droplet.io', 'https://demo1.api.droplet.io'],
    ['https://stage.app.droplet.io/', 'https://stage.app.droplet.io', 'https://stage.api.droplet.io'],
    ['http://localhost:8000/forms', 'http://localhost:8000', 'http://localhost:8001'],
  ])('maps %s', (url, appOrigin, apiOrigin) => {
    expect(getDropletEnv(url)).toEqual({ appOrigin, apiOrigin });
  });

  it.each([
    undefined,
    '',
    'not a url',
    'https://droplet.io/',
    'https://api.droplet.io/v1/forms',
    'https://app.droplet.io.evil.com/',
    'https://evilapp.droplet.io/',
    'http://app.droplet.io/',
    'http://localhost:3000/',
    'chrome://extensions',
  ])('rejects %s', url => {
    expect(getDropletEnv(url)).toBeNull();
    expect(isDropletAppUrl(url)).toBe(false);
  });
});
