import { useEffect, useState } from 'react';

import type { FieldComparison, VersionComparison, VersionInfo } from '@/lib/compare/types';
import type { JobState } from '@/lib/messages';

import { totalChanges } from '@/lib/compare/documents';
import { t } from '@/lib/i18n';
import { jobStorageKey } from '@/lib/jobState';

import { Tooltip } from '../sidepanel/components/Tooltip';
import { changeCount, formatDate, versionStatus } from '../sidepanel/format';
import { CHANGE_LABELS, FIELD_LABELS } from '../sidepanel/labels';
import { downloadCsv } from './csv';

const VersionRow = ({ label, version }: { label: string; version: VersionInfo }) => (
  <tr>
    <th scope="row">{label}</th>
    <td>{version.version}</td>
    <td>{versionStatus(version)}</td>
    <td>{formatDate(version.modified)}</td>
  </tr>
);

const FieldTable = ({ field }: { field: FieldComparison }) => (
  <section>
    <h2>
      {t(FIELD_LABELS[field.field])} · {changeCount(field.changes.length)}
    </h2>
    {field.mode === 'text' && <p className="hint">{t('compareTextMode')}</p>}
    <table className="report-table report-table--changes">
      <thead>
        <tr>
          <th scope="col">{t('reportChange')}</th>
          <th scope="col">{t('reportWhere')}</th>
          <th scope="col">{t('changeBefore')}</th>
          <th scope="col">{t('changeAfter')}</th>
        </tr>
      </thead>
      <tbody>
        {field.changes.map((change, index) => (
          <tr key={index}>
            <td>
              <span className={`tag tag--${change.kind}`}>{t(CHANGE_LABELS[change.kind])}</span>
            </td>
            <td className="report-table__where">{change.path.join(' › ')}</td>
            <td className={change.before === undefined ? undefined : 'report-table__before'}>
              <pre>{change.before}</pre>
            </td>
            <td className={change.after === undefined ? undefined : 'report-table__after'}>
              <pre>{change.after}</pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

/** The full comparison for one Droplet tab, in its own window: wide enough to read, printable, exportable. */
const Report = ({ tabId }: { tabId: null | number }) => {
  // undefined while loading; null when the tab has no comparison (any more).
  const [comparison, setComparison] = useState<null | undefined | VersionComparison>(tabId === null ? null : undefined);

  // Read once: the report keeps showing this comparison even if the tab goes on to run something else.
  useEffect(() => {
    if (tabId === null) return;
    let disposed = false;
    void storage.getItem<JobState>(jobStorageKey(tabId)).then(job => {
      if (!disposed) setComparison(job?.comparison ?? null);
    });
    return () => {
      disposed = true;
    };
  }, [tabId]);

  // The title is what the print dialog suggests as the PDF's file name.
  useEffect(() => {
    if (!comparison) return;
    const { form, from, to } = comparison;
    document.title = `${form.name} ${t('compareHeading', [from.version, to.version])}`;
  }, [comparison]);

  if (comparison === undefined) return null;
  if (comparison === null) {
    return (
      <main className="report">
        <p className="notice">{t('reportUnavailable')}</p>
      </main>
    );
  }

  const changed = comparison.fields.filter(field => field.changes.length > 0);

  return (
    <main className="report">
      <header className="report__header">
        <div>
          <h1>{t('reportTitle')}</h1>
          <p>
            {t('reportForm')}: <strong>{comparison.form.name}</strong>{' '}
            <span className="hint">
              ({t('reportFormId')}: {comparison.form.id})
            </span>
          </p>
        </div>
        <div className="report__actions">
          <Tooltip text={t('reportSavePdfHint')}>
            {describedBy => (
              <button
                type="button"
                className="button"
                aria-describedby={describedBy}
                onClick={() => {
                  window.print();
                }}
              >
                {t('reportSavePdf')}
              </button>
            )}
          </Tooltip>
          <button
            type="button"
            className="button button--quiet"
            disabled={changed.length === 0}
            onClick={() => {
              downloadCsv(comparison);
            }}
          >
            {t('reportDownloadCsv')}
          </button>
        </div>
      </header>

      <table className="report-table report-table--narrow">
        <thead>
          <tr>
            <td />
            <th scope="col">{t('reportVersion')}</th>
            <th scope="col">{t('reportStatus')}</th>
            <th scope="col">{t('reportModified')}</th>
          </tr>
        </thead>
        <tbody>
          <VersionRow label={t('compareFromLabel')} version={comparison.from} />
          <VersionRow label={t('compareToLabel')} version={comparison.to} />
        </tbody>
      </table>

      <h2>
        {t('reportSummary')}: {changeCount(totalChanges(comparison.fields))}
      </h2>
      {changed.length === 0 ? (
        <p className="notice">{t('compareIdentical')}</p>
      ) : (
        <table className="report-table report-table--narrow">
          <tbody>
            {comparison.fields.map(field => (
              <tr key={field.field}>
                <th scope="row">{t(FIELD_LABELS[field.field])}</th>
                <td>{field.changes.length === 0 ? t('reportNoChanges') : changeCount(field.changes.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {changed.map(field => (
        <FieldTable key={field.field} field={field} />
      ))}
    </main>
  );
};

export { Report };
