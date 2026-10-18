import type { SubmitEvent } from 'react';

import { useId, useState } from 'react';

import type { JobRequest, JobState } from '@/lib/messages';

import { t } from '@/lib/i18n';

import type { ActiveTab } from '../hooks/useActiveTab';

import { OBJECT_TYPE_LABELS } from '../labels';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';
import { ObjectActions } from './ObjectActions';

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

const FindById = ({ job, onCancel, onStart, tab }: Props) => {
  const inputId = useId();
  const idJob = job?.request.kind === 'findById' ? job : null;
  const [objectId, setObjectId] = useState('');

  // Restore the input from this tab's job (e.g. after reopening the panel). Runs once per job.
  const [restoredJobId, setRestoredJobId] = useState<null | string>(null);
  if (idJob?.request.kind === 'findById' && idJob.jobId !== restoredJobId) {
    setRestoredJobId(idJob.jobId);
    setObjectId(idJob.request.id);
  }
  const running = job?.status === 'running';

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!objectId.trim() || running) return;
    onStart({ kind: 'findById', id: objectId.trim() });
  };

  const lookup = idJob?.lookup;

  return (
    <section>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor={inputId}>{t('idLabel')}</label>
          <div className="input-row">
            <input
              id={inputId}
              type="search"
              value={objectId}
              placeholder={t('idPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              onChange={event => {
                setObjectId(event.target.value);
              }}
            />
            <button type="submit" className="button" disabled={running || !objectId.trim()}>
              {t('findButton')}
            </button>
          </div>
        </div>
      </form>

      {idJob && <JobStatus job={idJob} onCancel={onCancel} />}
      {idJob?.error && <JobError error={idJob.error} />}

      {lookup && (
        <div className="results">
          {lookup.hits.length === 0 && <p className="notice">{t('noIdMatches')}</p>}
          <ul className="result-list">
            {lookup.hits.map(hit => (
              <li key={`${hit.type}:${hit.id}`} className="result">
                <div className="result__title">
                  <span className="badge">{t(OBJECT_TYPE_LABELS[hit.type])}</span>
                  <strong>{hit.label}</strong>
                </div>
                <ObjectActions
                  tab={tab}
                  label={hit.label}
                  jobRunning={running}
                  objectRef={{ type: hit.type, id: hit.id, formId: hit.formId }}
                />
              </li>
            ))}
          </ul>
          {lookup.forbidden.length > 0 && (
            <p className="notice notice--warning">
              {t('forbiddenTypes', [lookup.forbidden.map(type => t(OBJECT_TYPE_LABELS[type])).join(', ')])}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export { FindById };
