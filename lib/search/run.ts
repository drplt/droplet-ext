import type { ApiClient } from '../api';
import type { Matcher } from './match';
import type { MatchLocation, SearchHit, SearchItem, SearchOptions, SearchTarget } from './types';

import { ApiError } from '../api';
import { mapPool } from '../pool';
import { createMatcher } from './match';
import { resolveVersions } from './shared';

const DEFAULT_CONCURRENCY = 4;

type SearchItemError = {
  id: string;
  kind: ApiError['kind'];
  message: string;
  name: string;
};

/** An item with nothing to search under the current options (never published, drafts off). */
type SkippedItem = {
  id: string;
  name: string;
};

type SearchProgress = {
  done: number;
  total: number;
};

type SearchCallbacks = {
  onHit?: (hit: SearchHit) => void;
  onItemError?: (error: SearchItemError) => void;
  onProgress?: (progress: SearchProgress) => void;
  onSkip?: (item: SkippedItem) => void;
};

type SearchSummary = {
  errors: SearchItemError[];
  hits: SearchHit[];
  searched: number;
  skipped: SkippedItem[];
  total: number;
};

const toApiError = (error: unknown) =>
  error instanceof ApiError ? error : new ApiError('invalid', error instanceof Error ? error.message : String(error));

type ItemOutcome = { hit: null | SearchHit; kind: 'searched' } | { kind: 'skipped' };

/** Searches the published version and, if requested, the newest draft; matches are labelled with their version. */
const searchItem = async (
  api: ApiClient,
  target: SearchTarget,
  item: SearchItem,
  matcher: Matcher,
  options: SearchOptions,
  signal: AbortSignal,
): Promise<ItemOutcome> => {
  const versions = await resolveVersions(target.resource, api, item, options.includeDrafts, signal);
  if (versions.length === 0) return { kind: 'skipped' };

  let matchCount = 0;
  const matches: MatchLocation[] = [];
  for (const version of versions) {
    const found = await target.searchVersion({ api, item, matcher, signal, version: version.version });
    matchCount += found.matchCount;
    for (const match of found.matches) matches.push({ ...match, version });
  }

  return {
    kind: 'searched',
    hit: matchCount === 0 ? null : { id: item.id, name: item.name, objectType: target.objectType, matchCount, matches },
  };
};

/**
 * Searches every object of one type in the org. Per-object failures are collected rather than aborting the run;
 * failures to list objects at all (401/403/network) and cancellation are thrown.
 */
const runSearch = async ({
  api,
  callbacks = {},
  concurrency = DEFAULT_CONCURRENCY,
  options,
  query,
  signal,
  target,
}: {
  api: ApiClient;
  callbacks?: SearchCallbacks;
  concurrency?: number;
  options: SearchOptions;
  query: string;
  signal: AbortSignal;
  target: SearchTarget;
}): Promise<SearchSummary> => {
  const matcher = createMatcher(query);
  if (!matcher) return { errors: [], hits: [], searched: 0, skipped: [], total: 0 };

  // A fatal error in one worker (e.g. the session ended) must stop the others too.
  const fatal = new AbortController();
  const runSignal = AbortSignal.any([signal, fatal.signal]);

  const items = await target.listItems(api, runSignal);
  const summary: SearchSummary = { errors: [], hits: [], searched: 0, skipped: [], total: items.length };
  callbacks.onProgress?.({ done: 0, total: items.length });

  await mapPool(
    items,
    async item => {
      try {
        const outcome = await searchItem(api, target, item, matcher, options, runSignal);
        if (outcome.kind === 'skipped') {
          const skipped = { id: item.id, name: item.name };
          summary.skipped.push(skipped);
          callbacks.onSkip?.(skipped);
        } else if (outcome.hit) {
          summary.hits.push(outcome.hit);
          callbacks.onHit?.(outcome.hit);
        }
      } catch (error) {
        const apiError = toApiError(error);
        // Session loss and cancellation affect every remaining item, so stop the whole run.
        if (apiError.kind === 'aborted' || apiError.kind === 'unauthorized') {
          fatal.abort(apiError);
          throw apiError;
        }
        const itemError = { id: item.id, name: item.name, kind: apiError.kind, message: apiError.message };
        summary.errors.push(itemError);
        callbacks.onItemError?.(itemError);
      }
      summary.searched++;
      callbacks.onProgress?.({ done: summary.searched, total: items.length });
    },
    { concurrency, signal: runSignal },
  );

  return summary;
};

export {
  runSearch,
  type SearchCallbacks,
  type SearchItemError,
  type SearchProgress,
  type SearchSummary,
  type SkippedItem,
};
