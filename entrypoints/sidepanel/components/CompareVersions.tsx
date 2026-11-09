import type { SubmitEvent } from 'react';

import { useEffect, useId, useState } from 'react';

import type { FieldComparison, VersionInfo } from '@/lib/compare/types';
import type { FormVersionsReply, JobRequest, JobState } from '@/lib/messages';

import { totalChanges } from '@/lib/compare/documents';
import { t } from '@/lib/i18n';
import { getFormIdFromUrl } from '@/lib/pageContext';

import type { ActiveTab } from '../hooks/useActiveTab';

import { loadFormVersions, openReport } from '../actions';
import { changeCount, formatDate, versionStatus } from '../format';
import { CHANGE_LABELS, FIELD_LABELS } from '../labels';
import { JobError } from './JobError';
import { JobStatus } from './JobStatus';

type Props = {
  job: JobState | null;
  onCancel: () => void;
  onClear: () => void;
  onStart: (request: JobRequest) => void;
  tab: ActiveTab;
};

type VersionsRequest = { formId: string };

const versionLabel = (version: VersionInfo) =>
  [version.version, versionStatus(version), formatDate(version.modified)].filter(Boolean).join(' · ');

const FieldChanges = ({ field }: { field: FieldComparison }) => (
  <details className="result" open>
    <summary className="result__title">
      <strong>{t(FIELD_LABELS[field.field])}</strong>
      <span className="hint">{changeCount(field.changes.length)}</span>
    </summary>
    {field.mode === 'text' && <p className="hint">{t('compareTextMode')}</p>}
    <ul className="change-list">
      {field.changes.map((change, index) => (
        <li key={index} className="change">
          <span className={`tag tag--${change.kind}`}>{t(CHANGE_LABELS[change.kind])}</span>{' '}
          <span className="change__path">{change.path.join(' › ')}</span>
          {change.before !== undefined && (
            <del className="change__value change__value--before" aria-label={`${t('changeBefore')}: ${change.before}`}>
              {change.before}
            </del>
          )}
          {change.after !== undefined && (
            <ins className="change__value change__value--after" aria-label={`${t('changeAfter')}: ${change.after}`}>
              {change.after}
            </ins>
          )}
        </li>
      ))}
    </ul>
  </details>
);

const CompareVersions = ({ job, onCancel, onClear, onStart, tab }: Props) => {
  const ids = { form: useId(), from: useId(), to: useId() };
  const pageFormId = getFormIdFromUrl(tab.url);
  const compareJob = job?.request.kind === 'compareVersions' ? job : null;

  const [formId, setFormId] = useState(pageFormId ?? '');
  // Which form's versions to show. A new object each time, so pressing Load again refetches.
  const [request, setRequest] = useState<null | VersionsRequest>(pageFormId ? { formId: pageFormId } : null);
  const [loaded, setLoaded] = useState<null | { reply: FormVersionsReply; request: VersionsRequest }>(null);
  const [choice, setChoice] = useState<{ from?: string; to?: string }>({});

  // Follow the user to another form's page.
  const [seenPageFormId, setSeenPageFormId] = useState(pageFormId);
  if (seenPageFormId !== pageFormId) {
    setSeenPageFormId(pageFormId);
    if (pageFormId) {
      setFormId(pageFormId);
      setRequest({ formId: pageFormId });
      setChoice({});
    }
  }

  // Restore the form from this tab's job (e.g. after reopening the panel). Runs once per job.
  const [restoredJobId, setRestoredJobId] = useState<null | string>(null);
  if (compareJob?.request.kind === 'compareVersions' && compareJob.jobId !== restoredJobId) {
    setRestoredJobId(compareJob.jobId);
    setFormId(compareJob.request.formId);
    if (request?.formId !== compareJob.request.formId) setRequest({ formId: compareJob.request.formId });
    setChoice({ from: compareJob.request.from, to: compareJob.request.to });
  }

  useEffect(() => {
    if (!request) return;
    let disposed = false;
    void loadFormVersions(tab.id, request.formId).then(reply => {
      if (!disposed) setLoaded({ reply, request });
    });
    return () => {
      disposed = true;
    };
  }, [request, tab.id]);

  const reply = loaded?.request === request ? loaded.reply : null;
  const loading = request !== null && reply === null;
  const versions = reply?.ok ? reply.form.versions : [];
  const has = (version: string | undefined) => versions.some(candidate => candidate.version === version);

  // Defaults answer the usual question: what does the newest version change relative to the published one?
  const to = (has(choice.to) ? choice.to : versions[0]?.version) ?? '';
  const defaultFrom =
    versions.find(version => version.published && version.version !== to) ??
    versions.find(version => version.version !== to);
  const from = (has(choice.from) ? choice.from : defaultFrom?.version) ?? '';

  const running = job?.status === 'running';
  const canCompare = request !== null && from !== '' && to !== '' && from !== to && !running;

  const load = (event: SubmitEvent) => {
    event.preventDefault();
    if (!formId.trim()) return;
    setRequest({ formId: formId.trim() });
    setChoice({});
  };

  const comparison = compareJob?.comparison;
  const changed = comparison?.fields.filter(field => field.changes.length > 0) ?? [];
  const unchanged = comparison?.fields.filter(field => field.changes.length === 0) ?? [];

  return (
    <section>
      <form className="stack" onSubmit={load}>
        <div className="field">
          <label htmlFor={ids.form}>
            {t('compareFormIdLabel')}
            {pageFormId !== null && pageFormId === formId.trim() && (
              <span className="hint"> · {t('fromCurrentPage')}</span>
            )}
          </label>
          <div className="input-row">
            <input
              id={ids.form}
              type="search"
              value={formId}
              placeholder={t('compareFormIdPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              onChange={event => {
                setFormId(event.target.value);
              }}
            />
            <button type="submit" className="button button--quiet" disabled={!formId.trim() || loading}>
              {t('compareLoadButton')}
            </button>
          </div>
        </div>
      </form>

      {loading && (
        <p className="hint" role="status">
          {t('compareLoading')}
        </p>
      )}
      {reply?.ok === false && <JobError error={reply.error} />}
      {reply?.ok && versions.length < 2 && <p className="notice">{t('compareOneVersion')}</p>}

      {reply?.ok && versions.length >= 2 && (
        <div className="stack compare-form">
          <strong className="compare-form__name">{reply.form.name}</strong>
          {(
            [
              { id: ids.from, key: 'from', label: t('compareFromLabel'), value: from },
              { id: ids.to, key: 'to', label: t('compareToLabel'), value: to },
            ] as const
          ).map(({ id, key, label, value }) => (
            <div key={key} className="field">
              <label htmlFor={id}>{label}</label>
              <select
                id={id}
                value={value}
                disabled={running}
                onChange={event => {
                  setChoice({ from, to, [key]: event.target.value });
                }}
              >
                {versions.map(version => (
                  <option key={version.version} value={version.version}>
                    {versionLabel(version)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {from === to && <p className="hint">{t('compareSameVersion')}</p>}
          <button
            type="button"
            className="button"
            disabled={!canCompare}
            onClick={() => {
              if (request) onStart({ kind: 'compareVersions', formId: request.formId, from, to });
            }}
          >
            {t('compareButton')}
          </button>
        </div>
      )}

      {compareJob && <JobStatus job={compareJob} onCancel={onCancel} />}
      {compareJob?.error && <JobError error={compareJob.error} />}

      {comparison && (
        <div className="results">
          <div className="results__header">
            <span>
              <strong>{comparison.form.name}</strong> ·{' '}
              {t('compareHeading', [comparison.from.version, comparison.to.version])} ·{' '}
              {changeCount(totalChanges(comparison.fields))}
            </span>
            <div className="results__actions">
              <button type="button" className="button button--small" onClick={() => void openReport(tab)}>
                {t('openReport')}
              </button>
              <button type="button" className="button button--small button--quiet" onClick={onClear}>
                {t('clearButton')}
              </button>
            </div>
          </div>
          {changed.length === 0 && <p className="notice">{t('compareIdentical')}</p>}
          {changed.map(field => (
            <FieldChanges key={field.field} field={field} />
          ))}
          {changed.length > 0 && unchanged.length > 0 && (
            <p className="hint">
              {t('compareUnchanged', [unchanged.map(field => t(FIELD_LABELS[field.field])).join(', ')])}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export { CompareVersions };
