import type { ApiClient } from '../api';
import type { ObjectType } from '../routes';
import type { Matcher, Snippet } from './match';

type SearchTargetType = 'datasets' | 'forms';

type SearchOptions = {
  /** Also search each object's newest unpublished draft (in addition to its published version). */
  includeDrafts: boolean;
};

type SearchItem = {
  id: string;
  name: string;
  publishedVersion: null | string;
};

type VersionRef = {
  kind: 'draft' | 'published';
  version: string;
};

type VersionMatch = {
  /** Where the text was found, e.g. "Layout" or "Row 12 · Email". */
  location: string;
  snippet: Snippet;
};

type MatchLocation = VersionMatch & { version: VersionRef };

type VersionMatches = {
  matchCount: number;
  matches: VersionMatch[];
};

type SearchHit = {
  id: string;
  matchCount: number;
  matches: MatchLocation[];
  name: string;
  objectType: ObjectType;
};

type SearchTarget = {
  listItems: (api: ApiClient, signal: AbortSignal) => Promise<SearchItem[]>;
  objectType: ObjectType;
  /** API resource, e.g. "forms" → /v1/forms/:id/versions. */
  resource: SearchTargetType;
  /** Fetch one version of one item and find matches in it. */
  searchVersion: (context: {
    api: ApiClient;
    item: SearchItem;
    matcher: Matcher;
    signal: AbortSignal;
    version: string;
  }) => Promise<VersionMatches>;
  type: SearchTargetType;
};

export type {
  MatchLocation,
  SearchHit,
  SearchItem,
  SearchOptions,
  SearchTarget,
  SearchTargetType,
  VersionMatch,
  VersionMatches,
  VersionRef,
};
