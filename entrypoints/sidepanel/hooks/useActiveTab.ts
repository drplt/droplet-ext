import { useEffect, useState } from 'react';

type ActiveTab = {
  id: number;
  /**
   * When this tab last finished loading, as seen by the panel (ms). Changes on a full page load (e.g. after Reload tab),
   * not on in-app navigation, so it can trigger refetches of data the page may have changed.
   */
  loadedAt: number;
  url: string | undefined;
  windowId: number;
};

type QueriedTab = Omit<ActiveTab, 'loadedAt'>;

const queryActiveTab = async (): Promise<null | QueriedTab> => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url, windowId: tab.windowId };
};

/** Keeps `loadedAt` for the same tab unless it just finished loading; a different tab counts as freshly seen. */
const withLoadedAt = (previous: ActiveTab | null, next: null | QueriedTab, loaded: boolean): ActiveTab | null => {
  if (!next) return null;
  const keep = previous?.id === next.id && !loaded;
  return { ...next, loadedAt: keep ? previous.loadedAt : Date.now() };
};

/** The active tab in the panel's window, kept current across tab switches and navigations. */
const useActiveTab = () => {
  const [tab, setTab] = useState<ActiveTab | null>(null);

  useEffect(() => {
    let disposed = false;
    const refresh = (loadedTabId: null | number = null) => {
      void queryActiveTab().then(next => {
        if (!disposed) setTab(previous => withLoadedAt(previous, next, next?.id === loadedTabId));
      });
    };
    const onActivated = () => {
      refresh();
    };
    const onUpdated = (tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (changeInfo.status === 'complete') refresh(tabId);
      else if (changeInfo.url !== undefined) refresh();
    };

    refresh();
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows.onFocusChanged.addListener(onActivated);
    return () => {
      disposed = true;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows.onFocusChanged.removeListener(onActivated);
    };
  }, []);

  return tab;
};

export { type ActiveTab, useActiveTab };
