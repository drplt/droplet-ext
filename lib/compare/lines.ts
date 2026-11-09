// Line-by-line fallback for documents that can't be parsed. Trailing whitespace is ignored.
import type { Change } from './types';

import { alignSequences } from './align';

const toLines = (text: string) => text.split(/\r?\n/).map(line => line.trimEnd());

const diffLines = (before: string, after: string): Change[] => {
  const oldLines = toLines(before);
  const newLines = toLines(after);
  const changes: Change[] = [];

  for (const step of alignSequences(oldLines, newLines)) {
    if (step.type === 'match') continue;
    const removed = step.removed.map(index => oldLines[index] ?? '').join('\n');
    const added = step.added.map(index => newLines[index] ?? '').join('\n');
    const [firstRemoved] = step.removed;
    const [firstAdded] = step.added;
    if (firstRemoved !== undefined && firstAdded !== undefined) {
      changes.push({ kind: 'changed', path: [`line ${firstAdded + 1}`], before: removed, after: added });
    } else if (firstAdded !== undefined) {
      changes.push({ kind: 'added', path: [`line ${firstAdded + 1}`], after: added });
    } else if (firstRemoved !== undefined) {
      changes.push({ kind: 'removed', path: [`line ${firstRemoved + 1}`], before: removed });
    }
  }
  return changes;
};

export { diffLines };
