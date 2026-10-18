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

export { getTargetFromUrl };
