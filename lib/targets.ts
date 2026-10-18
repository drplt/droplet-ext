import type { SearchTarget, SearchTargetType } from './search/types';

import { datasetsTarget } from './search/datasets';
import { formsTarget } from './search/forms';

// Registry of searchable object types. Add a target here to make it available in the side panel's dropdown.
const SEARCH_TARGETS: Record<SearchTargetType, SearchTarget> = {
  datasets: datasetsTarget,
  forms: formsTarget,
};

const SEARCH_TARGET_TYPES = Object.keys(SEARCH_TARGETS) as SearchTargetType[];

const isSearchTargetType = (value: unknown): value is SearchTargetType =>
  typeof value === 'string' && Object.hasOwn(SEARCH_TARGETS, value);

export { isSearchTargetType, SEARCH_TARGET_TYPES, SEARCH_TARGETS };
