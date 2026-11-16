import { createContext, useContext, useEffect, useState } from 'react';

import type { JobState } from '@/lib/messages';

import type { ActiveTab } from './useActiveTab';

import { isUnreachableJob, reloadTab } from '../actions';

/** Give up waiting for the tab to finish loading after this long, so the button can't stay on "Reloading…". */
const RELOAD_TIMEOUT_MS = 15_000;

/**
 * The panel's "Reload tab" flow. Reloading is only ever started by the user pressing the button:
 *
 *   idle ──press──▶ reloading ──tab finished loading──▶ reloaded ──dismiss / switch tool / new job / other tab──▶ idle
 *                       └──reload rejected, or 15s pass──▶ idle
 *
 * When the reload finishes, the tab's job is cleared only if, at the press, it was the job that failed because the
 * extension couldn't reach the tab, and it's still that job. A reload never clears anything else: finished searches,
 * partial results of a failed search, and comparisons all survive reloads, and the report window depends on that.
 */
type ReloadFlow =
  | { clearJobId: null | string; jobIdAfter: null | string; kind: 'reloaded'; tabId: number }
  | { kind: 'idle' }
  | { kind: 'reloading'; since: number; tabId: number; unreachableJobId: null | string };

type TabReload = {
  /** True between pressing Reload tab and the tab finishing loading. */
  reloading: boolean;
  reload: () => void;
};

/** Provided by App; ErrorNotice falls back to a bare reload when it's rendered outside the panel (e.g. in tests). */
const TabReloadContext = createContext<null | TabReload>(null);

const IDLE: ReloadFlow = { kind: 'idle' };

type Options = {
  clear: () => void;
  dismissError: () => void;
  job: JobState | null;
  tab: ActiveTab | null;
};

/** Owns the reload flow for the panel. */
const useTabReloadFlow = ({ clear, dismissError, job, tab }: Options) => {
  const [flow, setFlow] = useState<ReloadFlow>(IDLE);
  const jobId = job?.jobId ?? null;

  // The tab finished loading after the user asked for it: move on, remembering which job (if any) to clear.
  if (flow.kind === 'reloading' && tab?.id === flow.tabId && tab.loadedAt > flow.since) {
    const clearJobId = flow.unreachableJobId !== null && flow.unreachableJobId === jobId ? jobId : null;
    setFlow({ kind: 'reloaded', tabId: flow.tabId, clearJobId, jobIdAfter: clearJobId ? null : jobId });
  }

  // A reload that never reports back (e.g. the tab was closed mid-way) returns to idle.
  useEffect(() => {
    if (flow.kind !== 'reloading') return;
    const timer = setTimeout(() => {
      setFlow(current => (current === flow ? IDLE : current));
    }, RELOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [flow]);

  // Only ever the exact can't-reach-this-tab job seen when the user pressed Reload tab.
  const pendingClear = flow.kind === 'reloaded' && flow.clearJobId !== null && flow.clearJobId === jobId;
  useEffect(() => {
    if (flow.kind !== 'reloaded') return;
    dismissError();
    if (pendingClear) clear();
  }, [clear, dismissError, flow, pendingClear]);

  const value: null | TabReload = tab && {
    reloading: flow.kind === 'reloading' && flow.tabId === tab.id,
    reload: () => {
      const reloading: ReloadFlow = {
        kind: 'reloading',
        tabId: tab.id,
        since: tab.loadedAt,
        unreachableJobId: isUnreachableJob(job) ? job.jobId : null,
      };
      setFlow(reloading);
      reloadTab(tab.id).catch(() => {
        setFlow(current => (current === reloading ? IDLE : current));
      });
    },
  };

  // "Tab reloaded" stays until it's dismissed, the user switches tools, a new job starts, or the panel changes tab.
  const showReloaded =
    flow.kind === 'reloaded' && tab?.id === flow.tabId && (jobId === flow.jobIdAfter || pendingClear);
  const dismissReloaded = () => {
    if (flow.kind === 'reloaded') setFlow(IDLE);
  };

  return { dismissReloaded, showReloaded, value };
};

/** For ErrorNotice: the panel's reload flow, or a plain reload of `tabId` outside the panel. */
const useTabReload = (tabId: number): TabReload =>
  useContext(TabReloadContext) ?? { reloading: false, reload: () => void reloadTab(tabId) };

export { RELOAD_TIMEOUT_MS, TabReloadContext, useTabReload, useTabReloadFlow };
