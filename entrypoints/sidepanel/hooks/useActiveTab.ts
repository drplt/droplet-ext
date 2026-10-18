import { useEffect, useState } from 'react';

type ActiveTab = {
  id: number;
  url: string | undefined;
  windowId: number;
};

const queryActiveTab = async (): Promise<ActiveTab | null> => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url, windowId: tab.windowId };
};

/** The active tab in the panel's window, kept current across tab switches and navigations. */
const useActiveTab = () => {
  const [tab, setTab] = useState<ActiveTab | null>(null);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      void queryActiveTab().then(next => {
        if (!disposed) setTab(next);
      });
    };
    const onUpdated = (_tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (changeInfo.url !== undefined || changeInfo.status === 'complete') refresh();
    };

    refresh();
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows.onFocusChanged.addListener(refresh);
    return () => {
      disposed = true;
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows.onFocusChanged.removeListener(refresh);
    };
  }, []);

  return tab;
};

export { type ActiveTab, useActiveTab };
