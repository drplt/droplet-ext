import { defineConfig } from 'wxt';

import { INTERNAL_APP_MATCHES, PUBLIC_APP_MATCHES } from './lib/hosts';

// Internal environments (demo1, dev1, local, …) are only ever added to dev/internal builds. The
// production build that ships to the stores must reference app.droplet.io alone.
const includesInternalHosts = (mode: string) => mode === 'development' || mode === 'internal';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Ship MV3 to both stores (WXT defaults Firefox to MV2).
  manifestVersion: 3,
  manifest: ({ browser, mode }) => {
    const matches = includesInternalHosts(mode) ? [...PUBLIC_APP_MATCHES, ...INTERNAL_APP_MATCHES] : PUBLIC_APP_MATCHES;

    return {
      name: '__MSG_extName__',
      short_name: '__MSG_extShortName__',
      description: '__MSG_extDescription__',
      default_locale: 'en',
      homepage_url: 'https://droplet.io',
      permissions: ['storage'],
      host_permissions: matches,
      action: {
        default_title: '__MSG_actionTitle__',
      },
      ...(browser === 'firefox' && {
        browser_specific_settings: {
          gecko: {
            id: 'browser-extension@droplet.io',
            strict_min_version: '140.0',
            data_collection_permissions: { required: ['none'] },
          },
          // data_collection_permissions needs Firefox for Android 142+.
          gecko_android: { strict_min_version: '142.0' },
        },
      }),
    };
  },
  hooks: {
    // Content script `matches` are declared statically in the entrypoint (public host only); widen them
    // here for internal builds so the entrypoint never needs to know about internal hosts.
    'build:manifestGenerated': (wxt, manifest) => {
      if (!includesInternalHosts(wxt.config.mode)) return;
      for (const script of manifest.content_scripts ?? []) {
        script.matches = [...new Set([...(script.matches ?? []), ...INTERNAL_APP_MATCHES])];
      }
    },
  },
  webExt: {
    startUrls: ['https://app.droplet.io/forms'],
  },
});
