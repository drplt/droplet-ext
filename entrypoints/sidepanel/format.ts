import type { VersionInfo } from '@/lib/compare/types';

import { t } from '@/lib/i18n';

const versionStatus = (version: VersionInfo) =>
  t(version.published ? 'versionPublished' : version.locked ? 'versionLocked' : 'versionDraft');

const formatDate = (iso: null | string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/** A date that fits a narrow control: "Oct 2", with the year only when it isn't this year ("Oct 2, 2025"). */
const formatShortDate = (iso: null | string, now = new Date()) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** One line per version for a picker: "v14 · Published · Oct 2". */
const versionOptionLabel = (version: VersionInfo, now = new Date()) =>
  [version.version, versionStatus(version), formatShortDate(version.modified, now)].filter(Boolean).join(' · ');

const changeCount = (count: number) => (count === 1 ? t('changeCountOne') : t('changeCount', [count]));

export { changeCount, formatDate, formatShortDate, versionOptionLabel, versionStatus };
