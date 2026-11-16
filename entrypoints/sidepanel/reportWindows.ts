import type { ActiveTab } from './hooks/useActiveTab';

import { openReport } from './actions';

type ReportWindow = { jobId: string; windowId: number };

type Opener = (tab: ActiveTab) => Promise<undefined | { id?: number }>;

/**
 * Remembers each tab's open report window for as long as the panel is open, so Open report brings that window forward
 * instead of stacking up copies, even after switching tools. A window for an older comparison is replaced.
 */
const createReportWindows = (open: Opener = openReport) => {
  const windows = new Map<number, ReportWindow>();
  let watching = false;

  const forgetWindow = (windowId: number) => {
    [...windows].filter(([, entry]) => entry.windowId === windowId).forEach(([tabId]) => windows.delete(tabId));
  };

  const show = async (tab: ActiveTab, jobId: string) => {
    const existing = windows.get(tab.id);
    if (existing?.jobId === jobId) {
      const focused = await browser.windows.update(existing.windowId, { focused: true }).then(
        () => true,
        () => false,
      );
      if (focused) return;
    }
    windows.delete(tab.id);

    const created = await open(tab).catch(() => undefined);
    if (created?.id === undefined) return;
    windows.set(tab.id, { jobId, windowId: created.id });
    if (!watching) {
      watching = true;
      browser.windows.onRemoved.addListener(forgetWindow);
    }
  };

  return { has: (tabId: number) => windows.has(tabId), show };
};

const reportWindows = createReportWindows();

export { createReportWindows, reportWindows };
