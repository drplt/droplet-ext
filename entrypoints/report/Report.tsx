import { Fragment, useEffect, useRef, useState } from 'react';

import type { Change, FieldComparison, VersionComparison, VersionInfo } from '@/lib/compare/types';
import type { JobState } from '@/lib/messages';

import { totalChanges } from '@/lib/compare/documents';
import { t } from '@/lib/i18n';
import { jobStorageKey } from '@/lib/jobState';

import { DropletMark } from '../sidepanel/components/DropletMark';
import { Tooltip } from '../sidepanel/components/Tooltip';
import { changeCount, formatDate, versionStatus } from '../sidepanel/format';
import { CHANGE_LABELS, FIELD_LABELS, listOf } from '../sidepanel/labels';
import { csvFileName, downloadCsv } from './csv';

/** What the report has to show. The comparison is read once from the tab's job, so it never changes after loading. */
type Loaded =
  | { comparedAt: null | number; comparison: VersionComparison; status: 'ready' }
  | { status: 'loading' }
  | { status: 'missing' };

/** How long the "download started" line stays up. */
const CSV_NOTICE_MS = 5000;

/** Keeps a date on one line, so a narrow column breaks before it ("Modified" / "Nov 14, 2026, 9:42 AM"). */
const unbroken = (text: string) => text.replaceAll(' ', '\u00a0');

const sectionId = (field: FieldComparison) => `section-${field.field}`;

const Version = ({ label, version }: { label: string; version: VersionInfo }) => (
  <div className="report-meta__item">
    <dt>{label}</dt>
    <dd>
      <span className="report-meta__value">
        {version.version} · {versionStatus(version)}
      </span>
      {version.modified && (
        <span className="report-meta__sub">{t('reportModifiedOn', [unbroken(formatDate(version.modified))])}</span>
      )}
    </dd>
  </div>
);

const Path = ({ path }: { path: string[] }) => (
  <>
    {path.map((part, index) => (
      <Fragment key={index}>
        {index > 0 && (
          <>
            {' '}
            <span className="report-path__sep">›</span>{' '}
          </>
        )}
        {part}
      </Fragment>
    ))}
  </>
);

/** A Before or After cell. The −/+ gutter repeats the column's meaning without colour, so greyscale prints still read. */
const Value = ({ side, value }: { side: 'after' | 'before'; value: Change['after'] }) =>
  value === undefined ? (
    <td className="report-table__value">
      <span className="report-table__none" aria-hidden="true">
        —
      </span>
    </td>
  ) : (
    <td className="report-table__value">
      <div className={`report-value report-value--${side}`}>
        <span className="report-value__sign" aria-hidden="true">
          {side === 'before' ? '−' : '+'}
        </span>
        <pre>{value}</pre>
      </div>
    </td>
  );

const FieldTable = ({ field }: { field: FieldComparison }) => (
  <section className="report-section" aria-labelledby={sectionId(field)}>
    <h2 id={sectionId(field)} className="report-section__heading">
      <span>{t(FIELD_LABELS[field.field])}</span>{' '}
      <span className="report-section__count">{changeCount(field.changes.length)}</span>
    </h2>
    {field.mode === 'text' && <p className="report-section__note">{t('compareTextMode')}</p>}
    <table className="report-table">
      <colgroup>
        <col className="report-table__col-kind" />
        <col className="report-table__col-where" />
        <col />
        <col />
      </colgroup>
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
            <td className="report-table__where">
              <Path path={change.path} />
            </td>
            <Value side="before" value={change.before} />
            <Value side="after" value={change.after} />
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

const Missing = () => (
  <main className="report report--missing">
    <div className="report-missing">
      <DropletMark />
      <h1>{t('reportMissingTitle')}</h1>
      <p>{t('reportMissingBody')}</p>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          window.close();
        }}
      >
        {t('reportClose')}
      </button>
    </div>
  </main>
);

const Comparison = ({ comparedAt, comparison }: { comparedAt: null | number; comparison: VersionComparison }) => {
  // The file name of the CSV download just started, shown briefly so the click visibly did something.
  const [csvStarted, setCsvStarted] = useState<null | string>(null);
  const csvTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(csvTimer.current);
    },
    [],
  );

  const changed = comparison.fields.filter(field => field.changes.length > 0);
  const unchanged = comparison.fields.filter(field => field.changes.length === 0);

  return (
    <main className="report">
      <header className="report__header">
        <div className="report__title">
          <p className="report__eyebrow">{t('reportTitle')}</p>
          <h1>{comparison.form.name}</h1>
        </div>
        <div className="report__actions">
          <div className="report__buttons">
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
            {changed.length > 0 && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  downloadCsv(comparison);
                  setCsvStarted(csvFileName(comparison));
                  clearTimeout(csvTimer.current);
                  csvTimer.current = setTimeout(() => {
                    setCsvStarted(null);
                  }, CSV_NOTICE_MS);
                }}
              >
                {t('reportDownloadCsv')}
              </button>
            )}
          </div>
          <p className="report__status" role="status">
            {csvStarted !== null && t('reportCsvStarted', [csvStarted])}
          </p>
        </div>
      </header>

      <dl className="report-meta">
        <Version label={t('compareFromLabel')} version={comparison.from} />
        <Version label={t('compareToLabel')} version={comparison.to} />
        {comparedAt !== null && (
          <div className="report-meta__item">
            <dt>{t('reportCompared')}</dt>
            <dd>
              <span className="report-meta__value">{formatDate(new Date(comparedAt).toISOString())}</span>
            </dd>
          </div>
        )}
        <div className="report-meta__item">
          <dt>{t('reportFormId')}</dt>
          <dd>
            <span className="report-meta__value report-meta__value--id">{comparison.form.id}</span>
          </dd>
        </div>
      </dl>

      {changed.length === 0 ? (
        <div className="report-summary">
          <p className="report-summary__total">{t('compareNoChanges')}</p>
          <p className="report-summary__unchanged">{t('compareIgnored')}</p>
        </div>
      ) : (
        <nav className="report-summary" aria-label={t('reportSectionsLabel')}>
          <p className="report-summary__total">{changeCount(totalChanges(comparison.fields))}</p>
          <ul className="report-summary__sections">
            {changed.map(field => (
              <li key={field.field}>
                <a
                  href={`#${sectionId(field)}`}
                  aria-label={`${t(FIELD_LABELS[field.field])}, ${changeCount(field.changes.length)}`}
                >
                  {t(FIELD_LABELS[field.field])}
                  <span className="report-summary__count">{field.changes.length}</span>
                </a>
              </li>
            ))}
          </ul>
          {unchanged.length > 0 && (
            <p className="report-summary__unchanged">
              {t('compareUnchanged', [
                listOf(
                  unchanged.map(field => t(FIELD_LABELS[field.field])),
                  'disjunction',
                ),
              ])}
            </p>
          )}
        </nav>
      )}

      {changed.map(field => (
        <FieldTable key={field.field} field={field} />
      ))}
    </main>
  );
};

/** The full comparison for one Droplet tab, in its own window: wide enough to read, printable, exportable. */
const Report = ({ tabId }: { tabId: null | number }) => {
  const [loaded, setLoaded] = useState<Loaded>(tabId === null ? { status: 'missing' } : { status: 'loading' });

  // Read once: the report keeps showing this comparison even if the tab goes on to run something else.
  useEffect(() => {
    if (tabId === null) return;
    let disposed = false;
    void storage.getItem<JobState>(jobStorageKey(tabId)).then(job => {
      if (disposed) return;
      setLoaded(
        job?.comparison
          ? { status: 'ready', comparison: job.comparison, comparedAt: job.finishedAt }
          : { status: 'missing' },
      );
    });
    return () => {
      disposed = true;
    };
  }, [tabId]);

  // The title is what the print dialog suggests as the PDF's file name.
  useEffect(() => {
    if (loaded.status === 'missing') document.title = t('reportMissingTitle');
    if (loaded.status !== 'ready') return;
    const { form, from, to } = loaded.comparison;
    document.title = t('reportDocumentTitle', [form.name, from.version, to.version]);
  }, [loaded]);

  switch (loaded.status) {
    case 'loading':
      return null;
    case 'missing':
      return <Missing />;
    case 'ready':
      return <Comparison comparison={loaded.comparison} comparedAt={loaded.comparedAt} />;
  }
};

export { Report };
