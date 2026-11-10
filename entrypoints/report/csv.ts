// The comparison as a spreadsheet: one row per change.
import type { VersionComparison } from '@/lib/compare/types';

import { t } from '@/lib/i18n';

import { CHANGE_LABELS, FIELD_LABELS } from '../sidepanel/labels';

/**
 * Cells hold form content, which is customer data. A spreadsheet would run a cell starting with one of these as a
 * formula, so such cells get a leading apostrophe, which spreadsheets read as "this is text".
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Makes Excel read the file as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const cell = (value: string) => `"${(FORMULA_START.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

const comparisonCsv = (comparison: VersionComparison) => {
  const rows = [[t('reportSection'), t('reportChange'), t('reportWhere'), t('changeBefore'), t('changeAfter')]];
  for (const field of comparison.fields) {
    for (const change of field.changes) {
      rows.push([
        t(FIELD_LABELS[field.field]),
        t(CHANGE_LABELS[change.kind]),
        change.path.join(' › '),
        change.before ?? '',
        change.after ?? '',
      ]);
    }
  }
  return `${BYTE_ORDER_MARK}${rows.map(row => row.map(cell).join(',')).join('\r\n')}\r\n`;
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const csvFileName = ({ form, from, to }: VersionComparison) =>
  `${slug(form.name) || 'form'}-${slug(from.version)}-to-${slug(to.version)}.csv`;

const downloadCsv = (comparison: VersionComparison) => {
  const url = URL.createObjectURL(new Blob([comparisonCsv(comparison)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName(comparison);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the blob is released.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
};

export { comparisonCsv, csvFileName, downloadCsv };
