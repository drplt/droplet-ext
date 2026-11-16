import type { SubmitEvent } from 'react';

import { useId, useState } from 'react';

import type { LookupHit } from '@/lib/lookup/objById';
import type { JobRequest, JobState } from '@/lib/messages';

import { t } from '@/lib/i18n';
import { PROBES } from '@/lib/lookup/objById';

import type { ActiveTab } from '../hooks/useActiveTab';
import type { LookupOutcome } from '../summaries';

import { listOf, noun, OBJECT_TYPE_LABELS } from '../labels';
import { lookupOutcome, lookupSentences } from '../summaries';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';
import { Notice } from './Notice';
import { ObjectActions } from './ObjectActions';
import { ReplacesHint } from './ReplacesHint';

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

/** Submissions have no name of their own, so they're titled by number; the tag already says what they are. */
const titleFor = (hit: LookupHit) =>
  hit.type === 'submission' || hit.type === 'esignSubmission' ? `#${hit.id}` : hit.label;

/** "Works for forms, … Numeric IDs also check submissions and eSign submissions.", built from `PROBES`. */
const idHint = () => {
  const plural = (probes: typeof PROBES) =>
    listOf(
      probes.map(probe => noun(probe.type, 2)),
      'conjunction',
    );
  return t('idHint', [plural(PROBES.filter(probe => !probe.accepts)), plural(PROBES.filter(probe => probe.accepts))]);
};

type ResultsProps = {
  outcome: LookupOutcome;
  running: boolean;
  /** Set when the input no longer matches the ID these results are for. */
  staleNote: null | string;
  tab: ActiveTab;
};

const LookupResults = ({ outcome, running, staleNote, tab }: ResultsProps) => {
  const sentences = lookupSentences(outcome);
  const stale = staleNote && <p className="hint">{staleNote}</p>;

  if (outcome.kind !== 'found') {
    return (
      <div className="results">
        {stale}
        <Notice tone="info">{sentences.join(' ')}</Notice>
      </div>
    );
  }

  const lead = outcome.hits.length > 1 ? sentences[0] : null;
  const caveat = outcome.unchecked.length > 0 ? sentences.at(-1) : null;

  return (
    <div className={staleNote ? 'results results--stale' : 'results'}>
      <h2 className="visually-hidden">{t('idResultsHeading')}</h2>
      {stale}
      {lead && <p className="results__meta">{lead}</p>}
      <ul className="result-list">
        {outcome.hits.map(hit => (
          <li key={`${hit.type}:${hit.id}`} className="result">
            <div className="result__title">
              <h3 className="result__name">{titleFor(hit)}</h3>
              <span className="tag tag--neutral">{t(OBJECT_TYPE_LABELS[hit.type])}</span>
            </div>
            <ObjectActions
              tab={tab}
              label={titleFor(hit)}
              jobRunning={running}
              objectRef={{ type: hit.type, id: hit.id, formId: hit.formId }}
            />
          </li>
        ))}
      </ul>
      {caveat && <Notice tone="info">{caveat}</Notice>}
    </div>
  );
};

const FindById = ({ job, onCancel, onStart, tab }: Props) => {
  const ids = { input: useId(), hint: useId() };
  const idJob = job?.request.kind === 'findById' ? { ...job, request: job.request } : null;
  const [objectId, setObjectId] = useState('');

  // Restore the input from this tab's job (e.g. after reopening the panel). Runs once per job.
  const [restoredJobId, setRestoredJobId] = useState<null | string>(null);
  if (idJob && idJob.jobId !== restoredJobId) {
    setRestoredJobId(idJob.jobId);
    setObjectId(idJob.request.id);
  }
  const running = job?.status === 'running';

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!objectId.trim() || running) return;
    onStart({ kind: 'findById', id: objectId.trim() });
  };

  const outcome = idJob?.lookup ? lookupOutcome(idJob.request.id, idJob.lookup) : null;
  const stale = idJob !== null && objectId.trim() !== idJob.request.id;
  // Once the results for this input are showing, they say what was checked; the hint returns when the input changes.
  const showHint = outcome === null || stale;

  return (
    <section>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor={ids.input}>{t('idLabel')}</label>
          <div className="input-row">
            <input
              id={ids.input}
              type="search"
              value={objectId}
              placeholder={t('idPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={showHint ? ids.hint : undefined}
              onChange={event => {
                setObjectId(event.target.value);
              }}
            />
            <button type="submit" className="button" disabled={running || !objectId.trim()}>
              {t('findButton')}
            </button>
          </div>
          {showHint && (
            <p id={ids.hint} className="hint">
              {idHint()}
            </p>
          )}
          <ReplacesHint job={job} tool="findById" show={objectId.trim() !== ''} />
        </div>
      </form>

      {idJob && <JobStatus job={idJob} onCancel={onCancel} />}
      {idJob?.error && (
        <div className="results">
          <JobError error={idJob.error} forbidden="other" tabId={tab.id} />
        </div>
      )}
      {idJob && outcome && (
        <LookupResults
          outcome={outcome}
          running={running}
          staleNote={stale ? t('idStaleResults', [idJob.request.id]) : null}
          tab={tab}
        />
      )}
    </section>
  );
};

export { FindById };
