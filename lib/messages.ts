// Typed protocol between the side panel, background and content script.
//
//   side panel ──(runtime port "panel")──▶ background ──(tabs.sendMessage)──▶ content script
//   content script ──(runtime.sendMessage: job events)──▶ background ──▶ storage.session + panel port
//
// Jobs run in the Droplet tab's content script so API calls are first-party requests that carry the user's
// session cookie. The background owns per-tab job state so the panel can close and reopen without losing it.
import type { FormVersions, VersionComparison } from './compare/types';
import type { LookupResult } from './lookup/objById';
import type { SearchItemError, SearchProgress, SkippedItem } from './search/run';
import type { SearchHit, SearchOptions, SearchTargetType } from './search/types';

type JobRequest =
  | { formId: string; from: string; kind: 'compareVersions'; to: string }
  | { kind: 'findById'; id: string }
  | { kind: 'findText'; options: SearchOptions; query: string; target: SearchTargetType };

type JobFailure = {
  kind: 'forbidden' | 'network' | 'other' | 'unauthorized';
  message: string;
};

type JobState = {
  comparison: null | VersionComparison;
  error: JobFailure | null;
  finishedAt: null | number;
  hits: SearchHit[];
  itemErrors: SearchItemError[];
  jobId: string;
  lookup: LookupResult | null;
  progress: null | SearchProgress;
  request: JobRequest;
  skipped: SkippedItem[];
  startedAt: number;
  status: 'cancelled' | 'done' | 'error' | 'running';
};

/** Background → content script. */
type ContentMessage =
  | { jobId: string; request: JobRequest; type: 'job:start' }
  | { jobId: string; type: 'job:cancel' }
  | { jobId: string; type: 'job:ping' }
  | { id: string; objectType: string; type: 'page:reveal' }
  | { formId: string; type: 'form:versions' };

/** Content script's reply to "form:versions". Unlike a job it's answered directly, since it only fills a dropdown. */
type FormVersionsReply = { error: JobFailure; ok: false } | { form: FormVersions; ok: true };

/** Content script → background. */
type JobEvent =
  | { comparison: VersionComparison; jobId: string; type: 'job:comparison' }
  | { error: JobFailure; jobId: string; type: 'job:failed' }
  | { error: SearchItemError; jobId: string; type: 'job:itemError' }
  | { hit: SearchHit; jobId: string; type: 'job:hit' }
  | { jobId: string; lookup: LookupResult; type: 'job:lookup' }
  | { jobId: string; progress: SearchProgress; type: 'job:progress' }
  | { item: SkippedItem; jobId: string; type: 'job:skipped' }
  | { jobId: string; status: 'cancelled' | 'done'; type: 'job:finished' };

/** Side panel → background, over the "panel" port. */
type PanelCommand =
  | { request: JobRequest; tabId: number; type: 'start' }
  | { tabId: number; type: 'cancel' }
  | { tabId: number; type: 'clear' }
  | { tabId: number; type: 'subscribe' };

/** Background → side panel, over the "panel" port. */
type PanelUpdate =
  { job: JobState | null; tabId: number; type: 'state' } | { message: string; tabId: number; type: 'error' };

const PANEL_PORT = 'panel';

export {
  type ContentMessage,
  type FormVersionsReply,
  type JobEvent,
  type JobFailure,
  type JobRequest,
  type JobState,
  PANEL_PORT,
  type PanelCommand,
  type PanelUpdate,
};
