import type { Browser } from 'wxt/browser';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { JobRequest, JobState, PanelCommand, PanelUpdate } from '@/lib/messages';

import { PANEL_PORT } from '@/lib/messages';

/** Subscribes to the background's job state for one tab and exposes commands for it. */
const useJob = (tabId: null | number) => {
  const portRef = useRef<Browser.runtime.Port | null>(null);
  // State is tagged with its tab so switching tabs never shows the previous tab's job, even for one render.
  const [state, setState] = useState<{ error: null | string; job: JobState | null; tabId: null | number }>({
    error: null,
    job: null,
    tabId: null,
  });
  const current = state.tabId === tabId ? state : { error: null, job: null };

  // Opens (or re-opens) the port to the background and subscribes to this tab's job. Returns the new port.
  const connectRef = useRef<(() => Browser.runtime.Port) | null>(null);

  useEffect(() => {
    if (tabId === null) return;
    let disposed = false;

    const connect = () => {
      const port = browser.runtime.connect({ name: PANEL_PORT });
      portRef.current = port;

      port.onMessage.addListener((update: PanelUpdate) => {
        if (update.tabId !== tabId) return;
        if (update.type === 'state') {
          setState({ tabId, job: update.job, error: null });
        } else {
          setState(previous => ({ tabId, job: previous.tabId === tabId ? previous.job : null, error: update.message }));
        }
      });
      // MV3 stops an idle background service worker, which disconnects this port. Reconnecting wakes it again and
      // re-syncs state from storage, so a search running in the tab keeps streaming into the panel.
      port.onDisconnect.addListener(() => {
        if (portRef.current === port) portRef.current = null;
        if (!disposed) connect();
      });
      port.postMessage({ type: 'subscribe', tabId } satisfies PanelCommand);
      return port;
    };

    connectRef.current = connect;
    connect();

    return () => {
      disposed = true;
      connectRef.current = null;
      const port = portRef.current;
      portRef.current = null;
      port?.disconnect();
    };
  }, [tabId]);

  const send = useCallback((command: PanelCommand) => {
    const port = portRef.current;
    try {
      if (!port) throw new Error('Not connected');
      port.postMessage(command);
    } catch {
      // The port died between the disconnect event and this call; reconnect and retry once.
      connectRef.current?.().postMessage(command);
    }
  }, []);

  const start = useCallback(
    (request: JobRequest) => {
      if (tabId !== null) send({ type: 'start', tabId, request });
    },
    [send, tabId],
  );
  const cancel = useCallback(() => {
    if (tabId !== null) send({ type: 'cancel', tabId });
  }, [send, tabId]);
  const clear = useCallback(() => {
    if (tabId !== null) send({ type: 'clear', tabId });
  }, [send, tabId]);

  return { cancel, clear, error: current.error, job: current.job, start };
};

export { useJob };
