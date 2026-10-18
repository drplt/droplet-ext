import type { Browser } from 'wxt/browser';

import type { ContentMessage, JobEvent, JobState, PanelCommand, PanelUpdate } from '@/lib/messages';

import { isDropletAppUrl } from '@/lib/env';
import { applyJobEvent, createJob, interruptJob } from '@/lib/jobState';
import { PANEL_PORT } from '@/lib/messages';

// Per-tab job state lives in storage.session: it survives the service worker being suspended and the panel being
// closed, and is cleared when the browser exits.
const jobKey = (tabId: number) => `session:job:${tabId}` as const;

const readJob = (tabId: number) => storage.getItem<JobState>(jobKey(tabId));

const ports = new Map<Browser.runtime.Port, Set<number>>();

const broadcast = (update: PanelUpdate) => {
  for (const [port, tabIds] of ports) {
    if (!tabIds.has(update.tabId)) continue;
    try {
      port.postMessage(update);
    } catch {
      // Panel closed between its disconnect and this broadcast.
      ports.delete(port);
    }
  }
};

// Serialise read-modify-write per tab; job events arrive faster than storage round-trips.
const queues = new Map<number, Promise<unknown>>();
const updateJob = (tabId: number, update: (job: JobState | null) => JobState | null) => {
  const next = (queues.get(tabId) ?? Promise.resolve()).then(async () => {
    const current = await readJob(tabId);
    const job = update(current);
    if (job === current) return;
    if (job) await storage.setItem(jobKey(tabId), job);
    else await storage.removeItem(jobKey(tabId));
    broadcast({ type: 'state', tabId, job });
  });
  queues.set(
    tabId,
    next.catch(() => undefined),
  );
  return next;
};

const sendToTab = (tabId: number, message: ContentMessage) => browser.tabs.sendMessage(tabId, message);

const startJob = async (tabId: number, command: Extract<PanelCommand, { type: 'start' }>) => {
  const tab = await browser.tabs.get(tabId);
  if (!isDropletAppUrl(tab.url)) {
    broadcast({ type: 'error', tabId, message: browser.i18n.getMessage('errorNotDroplet') });
    return;
  }

  const previous = await readJob(tabId);
  if (previous?.status === 'running') {
    await sendToTab(tabId, { type: 'job:cancel', jobId: previous.jobId }).catch(() => undefined);
  }

  const job = createJob(crypto.randomUUID(), command.request, Date.now());
  await updateJob(tabId, () => job);
  try {
    await sendToTab(tabId, { type: 'job:start', jobId: job.jobId, request: command.request });
  } catch {
    // No content script in the tab — typically a tab opened before the extension was installed or updated.
    await updateJob(tabId, current => interruptJob(current, browser.i18n.getMessage('errorReloadTab'), Date.now()));
  }
};

const handleCommand = async (port: Browser.runtime.Port, command: PanelCommand) => {
  const { tabId } = command;
  switch (command.type) {
    case 'subscribe': {
      ports.set(port, new Set([tabId]));
      port.postMessage({ type: 'state', tabId, job: await readJob(tabId) } satisfies PanelUpdate);
      return;
    }
    case 'start':
      await startJob(tabId, command);
      return;
    case 'cancel': {
      const job = await readJob(tabId);
      if (job?.status !== 'running') return;
      try {
        await sendToTab(tabId, { type: 'job:cancel', jobId: job.jobId });
      } catch {
        await updateJob(tabId, current =>
          applyJobEvent(current, { type: 'job:finished', jobId: job.jobId, status: 'cancelled' }, Date.now()),
        );
      }
      return;
    }
    case 'clear':
      await updateJob(tabId, () => null);
      return;
  }
};

const isJobEvent = (message: unknown): message is JobEvent =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  'jobId' in message &&
  typeof message.type === 'string' &&
  message.type.startsWith('job:');

export default defineBackground(() => {
  // Toolbar button opens the side panel (Chrome) / toggles the sidebar (Firefox).
  if (import.meta.env.FIREFOX) {
    const sidebarAction = (browser as unknown as { sidebarAction?: { toggle: () => Promise<void> } }).sidebarAction;
    browser.action.onClicked.addListener(() => {
      void sidebarAction?.toggle();
    });
  } else {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  browser.runtime.onConnect.addListener(port => {
    if (port.name !== PANEL_PORT) return;
    ports.set(port, new Set());
    port.onMessage.addListener((command: PanelCommand) => {
      handleCommand(port, command).catch((error: unknown) => {
        console.error('Command failed', command.type, error);
        port.postMessage({
          type: 'error',
          tabId: command.tabId,
          message: browser.i18n.getMessage('errorUnexpected'),
        } satisfies PanelUpdate);
      });
    });
    port.onDisconnect.addListener(() => ports.delete(port));
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined || sender.id !== browser.runtime.id || !isJobEvent(message)) return;
    void updateJob(tabId, job => applyJobEvent(job, message, Date.now()));
  });

  // A full page load tears down the content script, and with it any running job. In-app (history API) navigation
  // keeps it alive, so once a load completes ask the tab whether the job is still running rather than assuming.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;
    void (async () => {
      const job = await readJob(tabId);
      if (job?.status !== 'running') return;
      const reply: unknown = await sendToTab(tabId, { type: 'job:ping', jobId: job.jobId }).catch(() => null);
      const alive = typeof reply === 'object' && reply !== null && 'running' in reply && reply.running === true;
      if (!alive) {
        await updateJob(tabId, current =>
          interruptJob(current, browser.i18n.getMessage('errorPageReloaded'), Date.now()),
        );
      }
    })();
  });

  browser.tabs.onRemoved.addListener(tabId => {
    queues.delete(tabId);
    void storage.removeItem(jobKey(tabId));
  });
});
