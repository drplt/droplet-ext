import type messages from '@/public/_locales/en/messages.json';

type MessageKey = keyof typeof messages;

/** Localised UI string. Keys are checked against the English catalogue at compile time. */
const t = (key: MessageKey, substitutions?: (number | string)[]) =>
  browser.i18n.getMessage(key, substitutions?.map(String)) || key;

export { type MessageKey, t };
