import type { SubmitEvent } from 'react';

import { useEffect, useId, useReducer, useRef, useState } from 'react';

import type { Change, FieldComparison, FormVersions, VersionComparison, VersionInfo } from '@/lib/compare/types';
import type { JobFailure, JobRequest, JobState } from '@/lib/messages';

import { totalChanges } from '@/lib/compare/documents';
import { t } from '@/lib/i18n';
import { getFormIdFromUrl } from '@/lib/pageContext';

import type { ActiveTab } from '../hooks/useActiveTab';

import { loadFormVersions } from '../actions';
import { changeCount, versionOptionLabel } from '../format';
import { useAnnounce } from '../hooks/useAnnouncement';
import { CHANGE_LABELS, FIELD_LABELS, listOf } from '../labels';
import { reportWindows } from '../reportWindows';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';
import { Notice } from './Notice';
import { ReplacesHint } from './ReplacesHint';
import {
  type Choice,
  initialPickerState,
  listedFormId,
  type PickerEvent,
  pickerReducer,
  type Refresh,
  type RefreshNews,
  resolveSelection,
  type Selection,
  type Versions,
} from './versionPicker';
import './CompareVersions.css';

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onClear: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

type CompareRequest = Extract<JobRequest, { kind: 'compareVersions' }>;

/** This tab's comparison job, as the results area shows it. */
type Outcome =
  | { comparison: VersionComparison; jobId: string; request: CompareRequest; status: 'compared' }
  | { error: JobFailure; status: 'failed' }
  | { job: JobState; status: 'running' }
  | { status: 'cancelled' }
  | { status: 'none' };

/** Whether the shown comparison still matches the form and versions picked above it. */
type Freshness = { status: 'current' } | { status: 'otherForm' } | { selection: Selection; status: 'otherVersions' };

const outcomeOf = (job: JobState | null): Outcome => {
  if (job?.request.kind !== 'compareVersions') return { status: 'none' };
  if (job.status === 'running') return { status: 'running', job };
  if (job.error) return { status: 'failed', error: job.error };
  if (job.comparison) {
    return { status: 'compared', jobId: job.jobId, request: job.request, comparison: job.comparison };
  }
  return job.status === 'cancelled' ? { status: 'cancelled' } : { status: 'none' };
};

const freshnessOf = (request: CompareRequest, versions: Versions, selection: null | Selection): Freshness => {
  if (listedFormId(versions) !== request.formId) return { status: 'otherForm' };
  if (selection && (selection.from !== request.from || selection.to !== request.to)) {
    return { status: 'otherVersions', selection };
  }
  return { status: 'current' };
};

/** Versions are listed newest first, so a lower index is newer. */
const isReversed = (versions: VersionInfo[], { from, to }: Selection) => {
  const indexOf = (version: string) => versions.findIndex(candidate => candidate.version === version);
  return from !== to && indexOf(from) < indexOf(to);
};

/** "…reset to published → newest" only when the default old version really is the published one. */
const resetMessage = (versions: VersionInfo[], choice: Choice) => {
  const { from } = resolveSelection(versions, choice);
  const fromPublished = versions.some(version => version.version === from && version.published);
  return t(fromPublished ? 'compareVersionsChanged' : 'compareVersionsChangedNewest');
};

const refreshNewsText = (news: RefreshNews, versions: Versions) =>
  news.kind === 'failed'
    ? t('compareRefreshFailedShort')
    : news.kind === 'updated'
      ? t('compareListUpdated')
      : versions.status === 'loaded'
        ? resetMessage(versions.form.versions, {})
        : '';

/** How long "Updated" stays up after a refresh the user asked for. */
const UPDATED_NOTE_MS = 3000;

const Chevron = () => (
  <svg className="compare-field__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** "Form › Section › label", with the part that changed set apart from where it lives. */
const ChangePath = ({ path }: { path: string[] }) => {
  const leaf = path.at(-1);
  return (
    <span className="change__path">
      {path.slice(0, -1).map((segment, index) => (
        <span key={index} className="change__ancestor">
          {segment}
          <span className="change__separator"> › </span>
        </span>
      ))}
      <span className="change__leaf">{leaf}</span>
    </span>
  );
};

const ChangeRow = ({ change }: { change: Change }) => (
  <li className="change">
    <span className={`tag tag--${change.kind}`}>{t(CHANGE_LABELS[change.kind])}</span> <ChangePath path={change.path} />{' '}
    {(change.before !== undefined || change.after !== undefined) && (
      <div className="change__values">
        {change.before !== undefined && (
          <div className="change__value change__value--before">
            <span className="change__label">{t('changeBefore')}</span>{' '}
            <del className="change__code">{change.before}</del>
          </div>
        )}{' '}
        {change.after !== undefined && (
          <div className="change__value change__value--after">
            <span className="change__label">{t('changeAfter')}</span> <ins className="change__code">{change.after}</ins>
          </div>
        )}
      </div>
    )}
  </li>
);

const FieldChanges = ({ field }: { field: FieldComparison }) => (
  <details className="result compare-field" open>
    <summary className="compare-field__summary">
      <Chevron />
      <span className="result__name">{t(FIELD_LABELS[field.field])}</span>
      <span className="result__aside">{changeCount(field.changes.length)}</span>
    </summary>
    {field.mode === 'text' && <p className="hint compare-field__note">{t('compareTextMode')}</p>}
    <ul className="change-list">
      {field.changes.map((change, index) => (
        <ChangeRow key={index} change={change} />
      ))}
    </ul>
  </details>
);

type ResultsProps = {
  comparison: VersionComparison;
  freshness: Freshness;
  onClear: () => void;
  onOpenReport: () => void;
};

const Results = ({ comparison, freshness, onClear, onOpenReport }: ResultsProps) => {
  const headingId = useId();
  const changed = comparison.fields.filter(field => field.changes.length > 0);
  const unchanged = comparison.fields.filter(field => field.changes.length === 0);
  const total = totalChanges(comparison.fields);

  return (
    <section
      className={freshness.status === 'current' ? 'results' : 'results results--stale'}
      aria-labelledby={headingId}
    >
      <div className="results__header">
        <h2 id={headingId} className="results__heading">
          <span className="results__title">
            {t('compareHeading', [comparison.from.version, comparison.to.version])}
          </span>
          {total > 0 && (
            <>
              {' '}
              <span className="results__meta compare-nowrap">· {changeCount(total)}</span>
            </>
          )}
        </h2>
        <div className="results__actions">
          <button type="button" className="button button--text" onClick={onOpenReport}>
            {t('openReport')}
          </button>
          <button type="button" className="button button--text" onClick={onClear}>
            {t('clearButton')}
          </button>
        </div>
      </div>

      {freshness.status === 'otherVersions' && (
        <Notice tone="info">{t('compareStale', [freshness.selection.from, freshness.selection.to])}</Notice>
      )}
      {freshness.status === 'otherForm' && <Notice tone="info">{t('compareStaleForm', [comparison.form.name])}</Notice>}

      {changed.length === 0 ? (
        <div className="result compare-identical">
          <p className="result__name">{t('compareNoChanges')}</p>
          <p className="hint">{t('compareIgnored')}</p>
        </div>
      ) : (
        <>
          {changed.map(field => (
            <FieldChanges key={field.field} field={field} />
          ))}
          {unchanged.length > 0 && (
            <p className="hint compare-unchanged">
              {t('compareUnchanged', [
                listOf(
                  unchanged.map(field => t(FIELD_LABELS[field.field])),
                  'disjunction',
                ),
              ])}
            </p>
          )}
        </>
      )}
    </section>
  );
};

type PickerProps = {
  /** A job is running in this tab, so a comparison can't start (and the list doesn't refresh). The selects stay usable. */
  busy: boolean;
  choice: Choice;
  /** The results below already answer this selection, so comparing again is the quieter action. */
  current: boolean;
  dispatch: (event: PickerEvent) => void;
  form: FormVersions;
  /** This tab's job, so the picker can say when comparing would replace another tool's results. */
  job: JobState | null;
  onCompare: (selection: Selection) => void;
  refresh: Refresh;
  reset: boolean;
};

const VersionPicker = ({ busy, choice, current, dispatch, form, job, onCompare, refresh, reset }: PickerProps) => {
  const ids = { from: useId(), hint: useId(), reset: useId() };
  const { versions } = form;
  const selection = resolveSelection(versions, choice);
  const same = selection.from === selection.to;
  const reversed = isReversed(versions, selection);
  const refreshing = refresh.status === 'running' && refresh.manual;
  const describedBy = [same || reversed ? ids.hint : null, reset ? ids.reset : null].filter(Boolean).join(' ');
  const choose = (next: Choice) => {
    dispatch({ type: 'choose', choice: next });
  };

  return (
    <fieldset className="compare-picker">
      <legend className="compare-picker__name">{form.name}</legend>
      <div className="compare-picker__meta">
        <span>{t('compareVersionCount', [versions.length])}</span>
        <button
          type="button"
          className="button button--text"
          aria-disabled={refreshing || busy}
          onClick={() => {
            if (!refreshing && !busy) dispatch({ type: 'refresh', manual: true, at: Date.now() });
          }}
        >
          {refreshing ? t('compareRefreshing') : t('compareRefresh')}
        </button>
        {refresh.status === 'updated' && <span className="compare-picker__updated">{t('compareUpdated')}</span>}
      </div>
      {refresh.status === 'failed' && <p className="hint compare-picker__note">{t('compareRefreshFailed')}</p>}

      {versions.length < 2 ? (
        <Notice tone="info">{t('compareOneVersion')}</Notice>
      ) : (
        <>
          {(
            [
              { id: ids.from, key: 'from', label: t('compareFromLabel') },
              { id: `${ids.from}-to`, key: 'to', label: t('compareToLabel') },
            ] as const
          ).map(({ id, key, label }) => (
            <div key={key} className="field">
              <label htmlFor={id}>{label}</label>
              <select
                id={id}
                value={selection[key]}
                aria-describedby={describedBy || undefined}
                onChange={event => {
                  choose({ ...selection, [key]: event.target.value });
                }}
              >
                {versions.map(version => (
                  <option key={version.version} value={version.version}>
                    {versionOptionLabel(version)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {reset && (
            <p id={ids.reset} className="hint compare-picker__hint">
              {resetMessage(versions, choice)}
            </p>
          )}
          {same && (
            <p id={ids.hint} className="hint compare-picker__hint">
              {t('compareSameVersion')}
            </p>
          )}
          {reversed && (
            <p className="hint compare-picker__hint">
              <span id={ids.hint}>{t('compareReversed')}</span>{' '}
              <button
                type="button"
                className="button button--text"
                onClick={() => {
                  choose({ from: selection.to, to: selection.from });
                }}
              >
                {t('compareSwap')}
              </button>
            </p>
          )}
          <button
            type="button"
            className={current ? 'button button--secondary' : 'button'}
            disabled={same || busy}
            onClick={() => {
              onCompare(selection);
            }}
          >
            {t('compareButton')}
          </button>
          <ReplacesHint job={job} tool="compareVersions" show />
        </>
      )}
    </fieldset>
  );
};

const CompareVersions = ({ job, onCancel, onClear, onStart, tab }: Props) => {
  const announce = useAnnounce();
  const ids = { form: useId(), formHint: useId() };
  const pageFormId = getFormIdFromUrl(tab.url);
  const outcome = outcomeOf(job);
  const comparing = outcome.status === 'running';

  const [formId, setFormId] = useState(pageFormId ?? '');
  const [state, dispatch] = useReducer(pickerReducer, pageFormId, initialPickerState);
  const { choice, fetch, reset, versions } = state;

  // Follow the user to another form's page.
  const [seenPageFormId, setSeenPageFormId] = useState(pageFormId);
  if (seenPageFormId !== pageFormId) {
    setSeenPageFormId(pageFormId);
    if (pageFormId) {
      setFormId(pageFormId);
      dispatch({ type: 'show', formId: pageFormId });
    }
  }

  // Restore the form and versions from this tab's job (e.g. after reopening the panel). Runs once per job.
  const [restoredJobId, setRestoredJobId] = useState<null | string>(null);
  if (job?.request.kind === 'compareVersions' && job.jobId !== restoredJobId) {
    setRestoredJobId(job.jobId);
    setFormId(job.request.formId);
    dispatch({ type: 'show', formId: job.request.formId, choice: { from: job.request.from, to: job.request.to } });
  }

  // The Droplet tab finished loading (e.g. after Reload tab): retry a failed load, or quietly refresh the list.
  const [seenLoadedAt, setSeenLoadedAt] = useState(tab.loadedAt);
  if (seenLoadedAt !== tab.loadedAt) {
    setSeenLoadedAt(tab.loadedAt);
    dispatch({ type: 'tabLoaded' });
  }

  useEffect(() => {
    if (!fetch) return;
    let disposed = false;
    void loadFormVersions(tab.id, fetch.formId).then(reply => {
      if (!disposed) dispatch({ type: 'received', seq: fetch.seq, reply, at: Date.now() });
    });
    return () => {
      disposed = true;
    };
  }, [fetch, tab.id]);

  // Coming back to the panel (say, after publishing in the Droplet tab) quietly re-reads the list.
  useEffect(() => {
    if (comparing) return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') dispatch({ type: 'refresh', manual: false, at: Date.now() });
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [comparing]);

  const updated = versions.status === 'loaded' && versions.refresh.status === 'updated';
  useEffect(() => {
    if (!updated) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'settled' });
    }, UPDATED_NOTE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [updated]);

  // Refresh outcomes that change what the user sees (or fail) are said once through the live region.
  const { news } = state;
  const announced = useRef<null | number>(null);
  useEffect(() => {
    if (!news || news.id === announced.current) return;
    announced.current = news.id;
    announce(refreshNewsText(news, versions));
  }, [announce, news, versions]);

  const typedId = formId.trim();
  const fromPage = pageFormId !== null && pageFormId === typedId;
  // Load versions is only offered when it would do something: a new ID, or a retry after a failure.
  const canLoad = typedId !== '' && !(listedFormId(versions) === typedId && versions.status !== 'failed');

  const load = (event: SubmitEvent) => {
    event.preventDefault();
    if (typedId) dispatch({ type: 'load', formId: typedId });
  };

  const loaded = versions.status === 'loaded' ? versions : null;
  const selection = loaded && loaded.form.versions.length >= 2 ? resolveSelection(loaded.form.versions, choice) : null;
  const freshness = outcome.status === 'compared' ? freshnessOf(outcome.request, versions, selection) : null;

  return (
    <div className="compare">
      <form className="field" onSubmit={load}>
        <label htmlFor={ids.form}>
          {t('compareFormIdLabel')}
          {fromPage && <span className="field__aside"> · {t('fromCurrentPage')}</span>}
        </label>
        <div className="input-row">
          <input
            id={ids.form}
            type="search"
            value={formId}
            placeholder={t('compareFormIdPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={versions.status === 'idle' ? ids.formHint : undefined}
            onChange={event => {
              setFormId(event.target.value);
            }}
          />
          {(canLoad || versions.status === 'idle') && (
            <button type="submit" className="button button--secondary" disabled={!canLoad}>
              {t('compareLoadButton')}
            </button>
          )}
        </div>
        {versions.status === 'idle' && (
          <p id={ids.formHint} className="hint">
            {t('compareFormIdHint')}
          </p>
        )}
      </form>

      {versions.status === 'loading' && (
        <p className="hint compare__loading" role="status">
          {t('compareLoading')}
        </p>
      )}
      {versions.status === 'failed' && (
        <div className="compare__error">
          <JobError error={versions.error} forbidden="formList" tabId={tab.id} />
        </div>
      )}
      {loaded && (
        <VersionPicker
          form={loaded.form}
          job={job}
          refresh={loaded.refresh}
          choice={choice}
          reset={reset && outcome.status !== 'compared'}
          busy={job?.status === 'running'}
          current={freshness?.status === 'current'}
          dispatch={dispatch}
          onCompare={({ from, to }) => {
            onStart({ kind: 'compareVersions', formId: loaded.formId, from, to });
          }}
        />
      )}

      {outcome.status === 'running' && <JobStatus job={outcome.job} onCancel={onCancel} />}
      {outcome.status === 'failed' && (
        <div className="compare__error">
          <JobError error={outcome.error} forbidden="formRead" tabId={tab.id} />
        </div>
      )}
      {outcome.status === 'cancelled' && <p className="hint compare__cancelled">{t('compareCancelled')}</p>}
      {outcome.status === 'compared' && freshness && (
        <Results
          comparison={outcome.comparison}
          freshness={freshness}
          onClear={onClear}
          onOpenReport={() => void reportWindows.show(tab, outcome.jobId)}
        />
      )}
    </div>
  );
};

export { CompareVersions };
