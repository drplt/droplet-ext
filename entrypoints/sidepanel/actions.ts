import type { ContentMessage } from '@/lib/messages';
import type { ObjectRef } from '@/lib/routes';

import { getDropletEnv } from '@/lib/env';
import { getObjectUrl } from '@/lib/routes';

import type { ActiveTab } from './hooks/useActiveTab';

const urlFor = (tab: ActiveTab, ref: ObjectRef) => {
  const env = getDropletEnv(tab.url);
  return env ? getObjectUrl(env.appOrigin, ref) : null;
};

const openInNewTab = async (tab: ActiveTab, ref: ObjectRef) => {
  const url = urlFor(tab, ref);
  if (url) await browser.tabs.create({ url, windowId: tab.windowId, active: true });
};

/**
 * Highlights the object if it's visible on the current page; otherwise navigates this tab to it. While a job runs
 * in this tab, navigating would kill it, so open a new tab instead.
 */
const showObject = async (tab: ActiveTab, ref: ObjectRef, { jobRunning }: { jobRunning: boolean }) => {
  const message: ContentMessage = { type: 'page:reveal', objectType: ref.type, id: ref.id };
  const reply: unknown = await browser.tabs.sendMessage(tab.id, message).catch(() => null);
  if (typeof reply === 'object' && reply !== null && 'found' in reply && reply.found === true) return;

  if (jobRunning) {
    await openInNewTab(tab, ref);
    return;
  }
  const url = urlFor(tab, ref);
  if (url) await browser.tabs.update(tab.id, { url });
};

export { openInNewTab, showObject, urlFor };
