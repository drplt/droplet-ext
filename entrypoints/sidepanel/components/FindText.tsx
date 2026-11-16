import type { MouseEvent, SubmitEvent } from 'react';

import { useEffect, useId, useState } from 'react';

import type { JobRequest, JobState } from '@/lib/messages';
import type { SearchHit, SearchTargetType } from '@/lib/search/types';

import { t } from '@/lib/i18n';
import { getTargetFromUrl } from '@/lib/pageContext';
import { isSearchTargetType, SEARCH_TARGET_TYPES } from '@/lib/targets';

import type { ActiveTab } from '../hooks/useActiveTab';
import type { FindTextJob, TextCounts } from '../summaries';

import { countOf, TARGET_LABELS, TARGET_OBJECT_TYPES } from '../labels';
import { isFindText, textCounts, textFoundLine, textNoMatches } from '../summaries';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';
import { Notice, NoticeIcon } from './Notice';
import { ObjectActions } from './ObjectActions';
import { ReplacesHint } from './ReplacesHint';
import { Snippet } from './Snippet';

const lastTarget = storage.defineItem<SearchTargetType>('local:lastSearchTarget', { fallback: 'forms' });

const PLACEHOLDERS = {
  datasets: 'searchTextPlaceholderDatasets',
  forms: 'searchTextPlaceholderForms',
} as const;

/** In-page anchors from the summary line to the detail notices. One Find text panel exists at a time. */
const SKIPPED_ID = 'find-text-skipped';
const FAILED_ID = 'find-text-failed';

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onClear: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

const matchCountText = (count: number) => (count === 1 ? t('matchCountOne') : t('matchCount', [count]));

const HitCard = ({ hit, running, tab }: { hit: SearchHit; running: boolean; tab: ActiveTab }) => (
  <li className="result">
    <div className="result__title">
      <h3 className="result__name">{hit.name}</h3>
      <span className="result__aside">{matchCountText(hit.matchCount)}</span>
    </div>
    <ul className="match-list">
      {hit.matches.map((match, index) => (
        <li key={index}>
          <div className="match-list__location">
            {/* Published is the norm, so it's part of the quiet location line; a draft gets a tag. */}
            {match.version.kind === 'draft' ? (
              <>
                <span>{match.location}</span>
                <span className="tag tag--draft">{t('versionTag', [t('versionDraft'), match.version.version])}</span>
              </>
            ) : (
              <span>
                {match.location} · {t('versionTag', [t('versionPublished'), match.version.version])}
              </span>
            )}
          </div>
          <Snippet snippet={match.snippet} />
        </li>
      ))}
      {hit.matchCount > hit.matches.length && (
        <li className="match-list__more">{t('moreMatches', [hit.matchCount - hit.matches.length])}</li>
      )}
    </ul>
    <ObjectActions tab={tab} label={hit.name} jobRunning={running} objectRef={{ type: hit.objectType, id: hit.id }} />
  </li>
);

/** Opens the item-errors disclosure and moves focus to it, so the summary link lands somewhere useful. */
const revealItemErrors = (event: MouseEvent<HTMLAnchorElement>) => {
  const details = document.getElementById(FAILED_ID)?.querySelector('details');
  if (!details) return;
  event.preventDefault();
  details.open = true;
  // Focusing also scrolls it into view.
  details.querySelector('summary')?.focus();
};

/** "Found in 3 of 209 forms · 3 never published · 2 couldn't be searched", the caveats linking to their details. */
const SummaryLine = ({ counts, includeDrafts }: { counts: TextCounts; includeDrafts: boolean }) => (
  <p className="results__meta">
    <span>{textFoundLine(counts)}</span>
    {counts.skipped > 0 && (
      <>
        {' '}
        <span>
          {'· '}
          <a href={`#${SKIPPED_ID}`}>
            {t(includeDrafts ? 'summaryNothingToSearch' : 'summarySkipped', [counts.skipped])}
          </a>
        </span>
      </>
    )}
    {counts.failed > 0 && (
      <>
        {' '}
        <span>
          {'· '}
          <a href={`#${FAILED_ID}`} onClick={revealItemErrors}>
            {t('summaryFailed', [counts.failed])}
          </a>
        </span>
      </>
    )}
  </p>
);

const ItemErrors = ({ job }: { job: FindTextJob }) => {
  const type = TARGET_OBJECT_TYPES[job.request.target];
  const anyForbidden = job.itemErrors.some(error => error.kind === 'forbidden');
  return (
    // The id sits on a wrapper: tabindex on <details> itself drops its <summary> out of the tab order in Chrome.
    <div id={FAILED_ID}>
      <details className="notice notice--warning notice--details">
        <summary>
          <NoticeIcon tone="warning" />
          <span>{t('itemErrors', [countOf(type, job.itemErrors.length)])}</span>
        </summary>
        <ul className="item-errors">
          {job.itemErrors.map(error => (
            <li key={error.id} className="item-error">
              <span>{error.name}</span>
              <span className="item-error__reason">
                {error.kind === 'forbidden' ? t('itemErrorNoAccess') : error.message}
              </span>
            </li>
          ))}
        </ul>
        {anyForbidden && (
          <p className="notice__footer">
            {t(job.request.target === 'datasets' ? 'errorForbiddenDatasets' : 'errorForbiddenFormRead')}
          </p>
        )}
      </details>
    </div>
  );
};

type ResultsProps = {
  job: FindTextJob;
  onClear: () => void;
  stale: boolean;
  tab: ActiveTab;
};

const Results = ({ job, onClear, stale, tab }: ResultsProps) => {
  const running = job.status === 'running';
  const counts = textCounts(job);
  const type = TARGET_OBJECT_TYPES[job.request.target];
  // Keep arrival order while results stream in, so cards don't jump; sort by name once the run ends.
  const hits = running ? job.hits : [...job.hits].sort((a, b) => a.name.localeCompare(b.name));
  const { includeDrafts } = job.request.options;

  // The run failed before it searched anything (e.g. it couldn't list forms): there are no results to head.
  if (job.error && job.progress === null && hits.length === 0) {
    return (
      <div className="results">
        <JobError
          error={job.error}
          forbidden={job.request.target === 'datasets' ? 'datasets' : 'formList'}
          tabId={tab.id}
        />
      </div>
    );
  }

  return (
    <div className={stale ? 'results results--stale' : 'results'}>
      {running ? (
        <>
          <h2 className="visually-hidden">
            {t('resultsFor', [job.request.query, t(TARGET_LABELS[job.request.target])])}
          </h2>
          <p className="hint">{t('showOpensNewTab')}</p>
        </>
      ) : (
        <div className="results__header">
          <h2 className="results__title">
            {t('resultsFor', [job.request.query, t(TARGET_LABELS[job.request.target])])}
          </h2>
          <div className="results__actions">
            <button type="button" className="button button--text" onClick={onClear}>
              {t('clearButton')}
            </button>
          </div>
          {counts && <SummaryLine counts={counts} includeDrafts={includeDrafts} />}
        </div>
      )}
      {job.error && (
        <JobError
          error={job.error}
          // A whole-run failure comes from listing; reading one item's versions fails per item (see ItemErrors).
          forbidden={job.request.target === 'datasets' ? 'datasets' : 'formList'}
          tabId={tab.id}
        />
      )}
      {stale && <p className="hint">{t('staleResults')}</p>}
      {job.status === 'cancelled' && <Notice tone="info">{t('cancelled')}</Notice>}
      {job.status === 'done' && hits.length === 0 && <Notice tone="info">{textNoMatches(job)}</Notice>}
      {hits.length > 0 && (
        <ul className="result-list">
          {hits.map(hit => (
            <HitCard key={hit.id} hit={hit} running={running} tab={tab} />
          ))}
        </ul>
      )}
      {!running && job.skipped.length > 0 && (
        <Notice tone="info" id={SKIPPED_ID} focusable>
          {/* With drafts on, a skipped item had nothing at all to search, so "turn on drafts" would be wrong. */}
          {t(
            includeDrafts
              ? job.skipped.length === 1
                ? 'skippedNoVersionsOne'
                : 'skippedNoVersions'
              : job.skipped.length === 1
                ? 'skippedUnpublishedOne'
                : 'skippedUnpublished',
            [countOf(type, job.skipped.length)],
          )}
        </Notice>
      )}
      {!running && job.itemErrors.length > 0 && <ItemErrors job={job} />}
    </div>
  );
};

const FindText = ({ job, onCancel, onClear, onStart, tab }: Props) => {
  const ids = { query: useId(), target: useId(), drafts: useId(), draftsHint: useId() };
  const pageTarget = getTargetFromUrl(tab.url);
  const textJob = job && isFindText(job) ? job : null;

  const [savedTarget, setSavedTarget] = useState<null | SearchTargetType>(null);
  const [chosenTarget, setChosenTarget] = useState<null | SearchTargetType>(null);
  const [query, setQuery] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // The page the user is on wins; a manual choice overrides it until they move to a different kind of page.
  const [seenPageTarget, setSeenPageTarget] = useState(pageTarget);
  if (seenPageTarget !== pageTarget) {
    setSeenPageTarget(pageTarget);
    setChosenTarget(null);
  }

  // Restore the form from this tab's job (e.g. after reopening the panel). Runs once per job.
  const [restoredJobId, setRestoredJobId] = useState<null | string>(null);
  if (textJob && textJob.jobId !== restoredJobId) {
    setRestoredJobId(textJob.jobId);
    setQuery(textJob.request.query);
    setChosenTarget(textJob.request.target);
    setIncludeDrafts(textJob.request.options.includeDrafts);
  }

  useEffect(() => {
    void lastTarget.getValue().then(setSavedTarget);
  }, []);

  const target = chosenTarget ?? pageTarget ?? savedTarget ?? 'forms';

  const running = job?.status === 'running';

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!query.trim() || running) return;
    onStart({ kind: 'findText', target, query: query.trim(), options: { includeDrafts } });
  };

  // Results stay up while the form changes, but say they're for the previous search.
  const stale =
    textJob !== null &&
    textJob.status !== 'running' &&
    (query.trim() !== textJob.request.query ||
      target !== textJob.request.target ||
      includeDrafts !== textJob.request.options.includeDrafts);

  return (
    <section>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor={ids.target}>
            {t('searchInLabel')}
            {pageTarget === target && <span className="hint"> · {t('fromCurrentPage')}</span>}
          </label>
          <select
            id={ids.target}
            value={target}
            disabled={running}
            onChange={event => {
              if (!isSearchTargetType(event.target.value)) return;
              setChosenTarget(event.target.value);
              void lastTarget.setValue(event.target.value);
            }}
          >
            {SEARCH_TARGET_TYPES.map(type => (
              <option key={type} value={type}>
                {t(TARGET_LABELS[type])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.query}>{t('searchTextLabel')}</label>
          <div className="input-row">
            <input
              id={ids.query}
              type="search"
              value={query}
              placeholder={t(PLACEHOLDERS[target])}
              autoComplete="off"
              spellCheck={false}
              onChange={event => {
                setQuery(event.target.value);
              }}
            />
            <button type="submit" className="button" disabled={running || !query.trim()}>
              {t('searchButton')}
            </button>
          </div>
          <ReplacesHint job={job} tool="findText" show={query.trim() !== ''} />
        </div>
        <div className="checkbox">
          <input
            id={ids.drafts}
            type="checkbox"
            checked={includeDrafts}
            disabled={running}
            aria-describedby={ids.draftsHint}
            onChange={event => {
              setIncludeDrafts(event.target.checked);
            }}
          />
          <label htmlFor={ids.drafts}>
            {t('includeDraftsLabel')}
            <span id={ids.draftsHint} className="hint checkbox__hint">
              {t(target === 'datasets' ? 'includeDraftsHintDatasets' : 'includeDraftsHintForms')}
            </span>
          </label>
        </div>
      </form>

      {textJob && <JobStatus job={textJob} onCancel={onCancel} />}
      {textJob && (textJob.status !== 'running' || textJob.hits.length > 0) && (
        <Results job={textJob} onClear={onClear} stale={stale} tab={tab} />
      )}
    </section>
  );
};

export { FindText };
