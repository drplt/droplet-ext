import type { ContentMessage, FormVersionsReply } from '@/lib/messages';
import type { ObjectRef } from '@/lib/routes';

import { getDropletEnv } from '@/lib/env';
import { t } from '@/lib/i18n';
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

const isFormVersionsReply = (reply: unknown): reply is FormVersionsReply =>
  typeof reply === 'object' && reply !== null && 'ok' in reply && typeof reply.ok === 'boolean';

/** Asks the Droplet tab for a form's versions. Fails the same way a job does when the tab has no content script. */
const loadFormVersions = async (tabId: number, formId: string): Promise<FormVersionsReply> => {
  const message: ContentMessage = { type: 'form:versions', formId };
  const reply: unknown = await browser.tabs.sendMessage(tabId, message).catch(() => null);
  return isFormVersionsReply(reply) ? reply : { ok: false, error: { kind: 'other', message: t('errorReloadTab') } };
};

/** Opens the full comparison for this tab in its own window, where it can be saved as a PDF or CSV. */
const openReport = (tab: ActiveTab) =>
  browser.windows.create({
    url: browser.runtime.getURL(`/report.html?tab=${tab.id}`),
    type: 'popup',
    width: 1100,
    height: 800,
  });

export { loadFormVersions, openInNewTab, openReport, showObject, urlFor };
