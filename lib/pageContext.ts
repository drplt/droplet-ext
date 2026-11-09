import type { SearchTargetType } from './search/types';

import { getDropletEnv } from './env';

/** The search target implied by the page the user is on, e.g. /forms or /forms/abc123/edit → forms. */
const getTargetFromUrl = (pageUrl: string | undefined): null | SearchTargetType => {
  if (!getDropletEnv(pageUrl) || !pageUrl) return null;
  const [first] = new URL(pageUrl).pathname.split('/').filter(Boolean);
  if (first === 'forms' || first === 'form') return 'forms';
  if (first === 'datasets') return 'datasets';
  return null;
};

/** The form the page is about, e.g. /forms/abc123/edit or /form/abc123/submission/9 → abc123. */
const getFormIdFromUrl = (pageUrl: string | undefined): null | string => {
  if (!getDropletEnv(pageUrl) || !pageUrl) return null;
  const [first, id] = new URL(pageUrl).pathname.split('/').filter(Boolean);
  return (first === 'forms' || first === 'form') && id ? decodeURIComponent(id) : null;
};

export { getFormIdFromUrl, getTargetFromUrl };
