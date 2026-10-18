// Maps a Droplet web-app origin to its API origin, mirroring drplt/src/sdk/client/core (app.* → api.*).

const APP_SUFFIX = 'app.droplet.io';
const API_SUFFIX = 'api.droplet.io';
const LOCAL_APP_PORT = '8000';
const LOCAL_API_PORT = '8001';

type DropletEnv = {
  apiOrigin: string;
  appOrigin: string;
};

const toUrl = (value: string): null | URL => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isAppHostname = (hostname: string) => hostname === APP_SUFFIX || hostname.endsWith(`.${APP_SUFFIX}`);

/** Returns the app + API origins for a URL inside the Droplet web app, or null for any other page. */
const getDropletEnv = (pageUrl: string | undefined): DropletEnv | null => {
  if (!pageUrl) return null;
  const url = toUrl(pageUrl);
  if (!url) return null;

  if (url.protocol === 'https:' && isAppHostname(url.hostname)) {
    const apiHostname = `${url.hostname.slice(0, -APP_SUFFIX.length)}${API_SUFFIX}`;
    return { appOrigin: url.origin, apiOrigin: `https://${apiHostname}` };
  }

  if (url.protocol === 'http:' && url.hostname === 'localhost' && url.port === LOCAL_APP_PORT) {
    return { appOrigin: url.origin, apiOrigin: `http://localhost:${LOCAL_API_PORT}` };
  }

  return null;
};

const isDropletAppUrl = (pageUrl: string | undefined) => getDropletEnv(pageUrl) !== null;

export { type DropletEnv, getDropletEnv, isDropletAppUrl };
