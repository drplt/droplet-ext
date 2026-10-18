// Match patterns for the Droplet web app. Kept free of runtime imports so wxt.config.ts can use it.

const PUBLIC_APP_MATCHES = ['https://app.droplet.io/*'];

const INTERNAL_APP_MATCHES = [
  'https://demo1.app.droplet.io/*',
  'https://dev1.app.droplet.io/*',
  'https://dr1.app.droplet.io/*',
  'https://stage.app.droplet.io/*',
  'http://localhost:8000/*',
];

export { INTERNAL_APP_MATCHES, PUBLIC_APP_MATCHES };
