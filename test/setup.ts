import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import messages from '@/public/_locales/en/messages.json';

type Entry = { message: string; placeholders?: Record<string, { content: string }> };

// fake-browser doesn't implement i18n; resolve messages from the real English catalogue (incl. placeholders) so
// UI tests render the same text users see and catch missing keys.
const getMessage = (key: string, substitutions?: (number | string)[] | string) => {
  const entry = (messages as Record<string, Entry | undefined>)[key];
  if (!entry) return '';
  const subs = (typeof substitutions === 'string' ? [substitutions] : (substitutions ?? [])).map(String);
  return entry.message.replace(/\$([A-Z_]+)\$/gi, (_, name: string) => {
    const content = entry.placeholders?.[name.toLowerCase()]?.content ?? '';
    return content.replace(/\$(\d)/g, (_match, index: string) => subs[Number(index) - 1] ?? '');
  });
};

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(getMessage);
});

afterEach(() => {
  cleanup();
});
