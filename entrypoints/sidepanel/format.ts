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

const changeCount = (count: number) => (count === 1 ? t('changeCountOne') : t('changeCount', [count]));

export { changeCount, formatDate, versionStatus };
