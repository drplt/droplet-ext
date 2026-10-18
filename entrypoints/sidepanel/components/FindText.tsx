import type { SubmitEvent } from 'react';

import { useEffect, useId, useState } from 'react';

import type { JobRequest, JobState } from '@/lib/messages';
import type { SearchTargetType } from '@/lib/search/types';

import { t } from '@/lib/i18n';
import { getTargetFromUrl } from '@/lib/pageContext';
import { isSearchTargetType, SEARCH_TARGET_TYPES } from '@/lib/targets';

import type { ActiveTab } from '../hooks/useActiveTab';

import { TARGET_LABELS } from '../labels';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';
import { ObjectActions } from './ObjectActions';
import { Snippet } from './Snippet';

const lastTarget = storage.defineItem<SearchTargetType>('local:lastSearchTarget', { fallback: 'forms' });

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onClear: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

const FindText = ({ job, onCancel, onClear, onStart, tab }: Props) => {
  const ids = { query: useId(), target: useId(), drafts: useId(), draftsHint: useId() };
  const pageTarget = getTargetFromUrl(tab.url);
  const textJob = job?.request.kind === 'findText' ? job : null;

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
  if (textJob?.request.kind === 'findText' && textJob.jobId !== restoredJobId) {
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

  const sortedHits = textJob ? [...textJob.hits].sort((a, b) => a.name.localeCompare(b.name)) : [];
  const finished = textJob !== null && textJob.status !== 'running';

  return (
    <section aria-labelledby={ids.query}>
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
              placeholder={t('searchTextPlaceholder')}
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
              {t('includeDraftsHint')}
            </span>
          </label>
        </div>
      </form>

      {textJob && <JobStatus job={textJob} onCancel={onCancel} />}
      {textJob?.error && <JobError error={textJob.error} />}

      {textJob && (finished || sortedHits.length > 0) && (
        <div className="results">
          <div className="results__header">
            <span>
              {textJob.progress
                ? t('resultsSummary', [sortedHits.length, textJob.progress.total - textJob.skipped.length])
                : null}
            </span>
            {finished && (
              <button type="button" className="button button--small button--quiet" onClick={onClear}>
                {t('clearButton')}
              </button>
            )}
          </div>
          {textJob.status === 'cancelled' && <p className="notice">{t('cancelled')}</p>}
          {textJob.status === 'done' && sortedHits.length === 0 && <p className="notice">{t('noTextMatches')}</p>}
          <ul className="result-list">
            {sortedHits.map(hit => (
              <li key={hit.id} className="result">
                <div className="result__title">
                  <strong>{hit.name}</strong>
                  <span className="hint">{t('matchCount', [hit.matchCount])}</span>
                </div>
                <ul className="match-list">
                  {hit.matches.map((match, index) => (
                    <li key={index}>
                      <span className="match-list__location">
                        <span
                          className={`tag tag--${match.version.kind}`}
                          title={t('versionTitle', [match.version.version])}
                        >
                          {t(match.version.kind === 'draft' ? 'versionDraft' : 'versionPublished')}
                        </span>{' '}
                        {match.location}
                      </span>
                      <Snippet snippet={match.snippet} />
                    </li>
                  ))}
                  {hit.matchCount > hit.matches.length && (
                    <li className="hint">{t('moreMatches', [hit.matchCount - hit.matches.length])}</li>
                  )}
                </ul>
                <ObjectActions
                  tab={tab}
                  label={hit.name}
                  jobRunning={running}
                  objectRef={{ type: hit.objectType, id: hit.id }}
                />
              </li>
            ))}
          </ul>
          {finished && textJob.skipped.length > 0 && (
            <p className="notice">{t('skippedUnpublished', [textJob.skipped.length])}</p>
          )}
          {textJob.itemErrors.length > 0 && (
            <details className="notice notice--warning">
              <summary>{t('itemErrors', [textJob.itemErrors.length])}</summary>
              <ul>
                {textJob.itemErrors.map(error => (
                  <li key={error.id}>
                    {error.name}: {error.kind === 'forbidden' ? t('errorForbidden') : error.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
};

export { FindText };
