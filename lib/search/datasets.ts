import type { DatasetVersion } from '../schemas';
import type { SearchTarget, VersionMatch } from './types';

import { datasetVersion } from '../schemas';
import { toSearchableText } from './match';
import { listEntities } from './shared';

const MAX_MATCHES_PER_VERSION = 10;

type PathSegment = number | string;

/** Visits every primitive leaf in arbitrary JSON, depth-first, with its path. */
const walkLeaves = (value: unknown, visit: (text: string, path: PathSegment[]) => void, path: PathSegment[] = []) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      walkLeaves(child, visit, [...path, index]);
    });
  } else if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walkLeaves(child, visit, [...path, key]);
  } else {
    visit(toSearchableText(value), path);
  }
};

const columnNames = (configuration: DatasetVersion['configuration']) =>
  new Map(
    (configuration?.columnConfigurations ?? []).flatMap(column =>
      column.identifier ? [[column.identifier, column.name ?? column.identifier] as const] : [],
    ),
  );

/** "Row 3 · Email" for tabular data, falling back to a dotted path for anything else. */
const describeLocation = (path: PathSegment[], columns: Map<string, string>) => {
  const [row, column, ...rest] = path;
  const parts: string[] = [];
  if (typeof row === 'number') parts.push(`Row ${row + 1}`);
  else if (row !== undefined) parts.push(row);
  if (column !== undefined) parts.push(typeof column === 'string' ? (columns.get(column) ?? column) : `[${column}]`);
  if (rest.length) parts.push(rest.map(String).join('.'));
  return parts.join(' · ') || 'Value';
};

const datasetsTarget: SearchTarget = {
  type: 'datasets',
  resource: 'datasets',
  objectType: 'dataset',
  listItems: (api, signal) => listEntities('datasets', api, signal),
  searchVersion: async ({ api, item, matcher, signal, version }) => {
    const doc = await api.get(
      `datasets/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(version)}`,
      datasetVersion,
      { query: { include: 'data,configuration' }, signal },
    );

    const columns = columnNames(doc.configuration);
    let matchCount = 0;
    const matches: VersionMatch[] = [];
    walkLeaves(doc.data, (text, path) => {
      const { count, snippets } = matcher(text, { limit: 1 });
      matchCount += count;
      const [snippet] = snippets;
      if (snippet && matches.length < MAX_MATCHES_PER_VERSION) {
        matches.push({ location: describeLocation(path, columns), snippet });
      }
    });
    return { matchCount, matches };
  },
};

export { datasetsTarget, describeLocation, walkLeaves };
