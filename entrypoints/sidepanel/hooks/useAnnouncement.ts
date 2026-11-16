import { createContext, useCallback, useContext, useState } from 'react';

import type { JobState } from '@/lib/messages';

import { jobAnnouncement } from '../summaries';

/** A job is announced once when it starts and once when it ends. */
const phaseOf = (job: JobState | null) =>
  job ? `${job.jobId}:${job.status === 'running' ? 'running' : 'ended'}` : 'none';

/** `phase` is null until this tab's state has arrived. */
type Seen = { phase: null | string; tabId: null | number };

/**
 * The text for the panel's live region. It changes only when a job starts or finishes while the panel is watching
 * this tab, so progress ticks aren't read out, and reopening the panel or switching tabs doesn't replay old results.
 *
 * `synced` is false until the background has sent this tab's state; until then there's nothing to compare against.
 */
const useAnnouncement = (tabId: null | number, job: JobState | null, synced: boolean) => {
  const phase = synced ? phaseOf(job) : null;
  const [seen, setSeen] = useState<Seen>({ tabId, phase: null });
  const [message, setMessage] = useState('');

  if (seen.tabId !== tabId) {
    setSeen({ tabId, phase });
    setMessage('');
  } else if (phase !== seen.phase) {
    setSeen({ tabId, phase });
    // The first synced state is what was already there: remember it, don't announce it.
    if (seen.phase !== null && phase !== null && job) setMessage(jobAnnouncement(job) ?? '');
  }

  // For status changes that aren't a job starting or ending (e.g. Compare's version list refreshing). Repeating the
  // same sentence toggles a trailing no-break space, so the region's text still changes and is read again.
  const announce = useCallback((text: string) => {
    setMessage(previous => (previous === text ? `${text}\u00A0` : text));
  }, []);

  return { announce, message };
};

/**
 * `announce(sentence)` puts one sentence in the panel's live region (role="status", polite). Use it for a status
 * change the user didn't directly cause and can't see happen, once per change; don't use it for progress ticks.
 * Outside the panel (e.g. component tests without App) it does nothing.
 */
const AnnounceContext = createContext<(text: string) => void>(() => undefined);

const useAnnounce = () => useContext(AnnounceContext);

export { AnnounceContext, useAnnounce, useAnnouncement };
