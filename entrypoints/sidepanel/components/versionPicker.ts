// The Compare tool's version picker as a small state machine: which form's versions are listed, what the user chose,
// and the quiet refreshes that keep the list current after a publish. Pure, so the component only wires events to it.
import type { FormVersions, VersionInfo } from '@/lib/compare/types';
import type { FormVersionsReply, JobFailure } from '@/lib/messages';

/** What the user picked in the selects. Missing or unknown versions fall back to the defaults. */
type Choice = { from?: string; to?: string };
type Selection = { from: string; to: string };

/** A re-read of a list that's already showing. Only a refresh the user asked for shows its progress. */
type Refresh =
  | { manual: boolean; status: 'running' }
  | { status: 'failed' }
  | { status: 'idle' }
  | { status: 'updated' };

type Versions =
  | { error: JobFailure; formId: string; status: 'failed' }
  | { form: FormVersions; formId: string; refresh: Refresh; status: 'loaded' }
  | { formId: string; status: 'loading' }
  | { status: 'idle' };

/**
 * What a finished refresh should tell screen-reader users, if anything. `id` is the request's seq, so the component
 * announces each one once.
 */
type RefreshNews = { id: number; kind: 'failed' | 'reset' | 'updated' };

type PickerState = {
  choice: Choice;
  /** The request in flight. A new object per request, so the component's effect runs once for each. */
  fetch: null | { formId: string; seq: number };
  /** When the list last arrived, to space out refreshes the user didn't ask for. */
  fetchedAt: number;
  /** A refresh moved the selects back to the defaults, because the chosen versions are gone or the defaults moved. */
  reset: boolean;
  /** The latest refresh outcome worth announcing. */
  news: null | RefreshNews;
  /** Counts requests, so each has its own number even after earlier ones finish. */
  seq: number;
  versions: Versions;
};

type PickerEvent =
  /** Show a form's versions, fetching them unless that list is already showing. */
  | { choice?: Choice; formId: string; type: 'show' }
  | { at: number; reply: FormVersionsReply; seq: number; type: 'received' }
  | { at: number; manual: boolean; type: 'refresh' }
  | { choice: Choice; type: 'choose' }
  /** Fetch a form's versions, even if they're showing (the Load versions button). */
  | { formId: string; type: 'load' }
  /** The "Updated" note has been up long enough. */
  | { type: 'settled' }
  /** The Droplet tab finished loading, e.g. after Reload tab. */
  | { type: 'tabLoaded' };

/** Refreshes the user didn't ask for (the panel regaining focus) happen at most this often. */
const AUTO_REFRESH_MS = 5000;

/** Defaults answer the usual question: what does the newest version change relative to the published one? */
const resolveSelection = (versions: VersionInfo[], choice: Choice): Selection => {
  const has = (version: string | undefined): version is string =>
    versions.some(candidate => candidate.version === version);
  const to = has(choice.to) ? choice.to : (versions[0]?.version ?? '');
  const fallbackFrom =
    versions.find(version => version.published && version.version !== to) ??
    versions.find(version => version.version !== to);
  return { from: has(choice.from) ? choice.from : (fallbackFrom?.version ?? ''), to };
};

const sameSelection = (a: Selection, b: Selection) => a.from === b.from && a.to === b.to;

/** Keep the user's pair only if both versions still exist; otherwise start over from the defaults. */
const reconcileChoice = (versions: VersionInfo[], choice: Choice): Choice => {
  const exists = (version: string | undefined) =>
    version === undefined || versions.some(candidate => candidate.version === version);
  return exists(choice.from) && exists(choice.to) ? choice : {};
};

const initialPickerState = (formId: null | string): PickerState =>
  formId
    ? {
        choice: {},
        fetch: { formId, seq: 1 },
        fetchedAt: 0,
        news: null,
        reset: false,
        seq: 1,
        versions: { status: 'loading', formId },
      }
    : { choice: {}, fetch: null, fetchedAt: 0, news: null, reset: false, seq: 0, versions: { status: 'idle' } };

const listedFormId = (versions: Versions) => (versions.status === 'idle' ? null : versions.formId);

const startLoading = (state: PickerState, formId: string, choice: Choice = {}): PickerState => ({
  choice,
  fetch: { formId, seq: state.seq + 1 },
  fetchedAt: state.fetchedAt,
  news: state.news,
  reset: false,
  seq: state.seq + 1,
  versions: { status: 'loading', formId },
});

const startRefresh = (state: PickerState, manual: boolean): PickerState =>
  state.versions.status === 'loaded'
    ? {
        ...state,
        fetch: { formId: state.versions.formId, seq: state.seq + 1 },
        seq: state.seq + 1,
        versions: { ...state.versions, refresh: { status: 'running', manual } },
      }
    : state;

const receive = (state: PickerState, reply: FormVersionsReply, at: number, seq: number): PickerState => {
  const { versions } = state;
  const settled = { ...state, fetch: null, fetchedAt: at };

  if (versions.status === 'loading') {
    return {
      ...settled,
      versions: reply.ok
        ? { status: 'loaded', formId: versions.formId, form: reply.form, refresh: { status: 'idle' } }
        : { status: 'failed', formId: versions.formId, error: reply.error },
    };
  }
  if (versions.status !== 'loaded' || versions.refresh.status !== 'running') return state;

  const { manual } = versions.refresh;
  const announce = (kind: RefreshNews['kind']): RefreshNews => ({ id: seq, kind });

  // A failed refresh keeps the list that's showing; the picker says it may be out of date. A quiet refresh that keeps
  // failing (each time the panel regains focus) is announced once, not on every retry.
  if (!reply.ok) {
    const repeat = !manual && state.news?.kind === 'failed';
    return {
      ...settled,
      news: repeat ? state.news : announce('failed'),
      versions: { ...versions, refresh: { status: 'failed' } },
    };
  }

  const choice = reconcileChoice(reply.form.versions, state.choice);
  const before = resolveSelection(versions.form.versions, state.choice);
  const after = resolveSelection(reply.form.versions, choice);
  const reset = versions.form.versions.length >= 2 && !sameSelection(before, after);
  return {
    ...settled,
    choice,
    news: reset ? announce('reset') : manual ? announce('updated') : null,
    reset: state.reset || reset,
    versions: {
      ...versions,
      form: reply.form,
      refresh: { status: versions.refresh.manual ? 'updated' : 'idle' },
    },
  };
};

const pickerReducer = (state: PickerState, event: PickerEvent): PickerState => {
  switch (event.type) {
    case 'show': {
      const showing = listedFormId(state.versions) === event.formId && state.versions.status !== 'failed';
      return showing
        ? { ...state, choice: event.choice ?? {}, reset: false }
        : startLoading(state, event.formId, event.choice);
    }
    case 'load':
      return startLoading(state, event.formId);
    case 'choose':
      return { ...state, choice: event.choice, reset: false };
    case 'refresh': {
      const { versions } = state;
      if (versions.status !== 'loaded' || versions.refresh.status === 'running') return state;
      if (!event.manual && event.at - state.fetchedAt < AUTO_REFRESH_MS) return state;
      return startRefresh(state, event.manual);
    }
    case 'tabLoaded': {
      const { versions } = state;
      if (versions.status === 'failed') return startLoading(state, versions.formId, state.choice);
      if (versions.status === 'loaded' && versions.refresh.status !== 'running') return startRefresh(state, false);
      return state;
    }
    case 'received':
      return event.seq === state.fetch?.seq ? receive(state, event.reply, event.at, event.seq) : state;
    case 'settled':
      return state.versions.status === 'loaded' && state.versions.refresh.status === 'updated'
        ? { ...state, versions: { ...state.versions, refresh: { status: 'idle' } } }
        : state;
  }
};

export {
  AUTO_REFRESH_MS,
  type Choice,
  initialPickerState,
  listedFormId,
  type PickerEvent,
  pickerReducer,
  type PickerState,
  type Refresh,
  type RefreshNews,
  resolveSelection,
  type Selection,
  type Versions,
};
