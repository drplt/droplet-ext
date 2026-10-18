import { z } from 'zod';

import type { ApiClient } from '../api';
import type { SearchItem, VersionRef } from './types';

import { chunk, mapPool } from '../pool';
import { allIds, versionList } from '../schemas';

// drplt caps POST /<resource>/entities at 50 ids (getAllMaxIds).
const ENTITIES_BATCH_SIZE = 50;

const listableEntity = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
  publishedVersion: z.string().nullish(),
});

/** Every active object id in the org (no `page` → unpaginated), then names/published versions in batches. */
const listEntities = async (
  resource: 'datasets' | 'forms',
  api: ApiClient,
  signal: AbortSignal,
): Promise<SearchItem[]> => {
  const { ids } = await api.get(`${resource}/ids`, allIds, { signal });
  const batches = await mapPool(
    chunk(ids, ENTITIES_BATCH_SIZE),
    batch => api.post(`${resource}/entities`, { ids: batch }, z.array(listableEntity), { signal }),
    { concurrency: 2, signal },
  );
  return batches.flat().map(entity => ({
    id: entity.id,
    name: entity.name ?? entity.id,
    publishedVersion: entity.publishedVersion ?? null,
  }));
};

const byNewest = (a: { modified?: null | string }, b: { modified?: null | string }) =>
  (b.modified ?? '').localeCompare(a.modified ?? '');

/**
 * Which versions of an item to search: its published version, plus — when drafts are included — its newest version
 * if that's a newer unpublished draft. An empty list means there's nothing to search (never published, drafts off).
 */
const resolveVersions = async (
  resource: 'datasets' | 'forms',
  api: ApiClient,
  item: SearchItem,
  includeDrafts: boolean,
  signal: AbortSignal,
): Promise<VersionRef[]> => {
  const published: VersionRef[] = item.publishedVersion ? [{ kind: 'published', version: item.publishedVersion }] : [];
  if (!includeDrafts) return published;

  const { versions } = await api.get(`${resource}/${encodeURIComponent(item.id)}/versions`, versionList, { signal });
  const newest = [...versions].sort(byNewest)[0];
  if (!newest || newest.version === item.publishedVersion || newest.locked === true) return published;
  return [...published, { kind: 'draft', version: newest.version }];
};

export { listEntities, resolveVersions };
