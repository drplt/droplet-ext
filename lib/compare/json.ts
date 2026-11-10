// Structural diff of two JSON values. Key order and whitespace never count as a change; array items are aligned so
// inserting one item doesn't report every item after it as changed.
import type { Change } from './types';

import { alignSequences } from './align';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortKeys(value[key])]),
  );
};

/** Canonical text for equality checks. Values come from JSON.parse, so they always serialize. */
const stableKey = (value: unknown) => JSON.stringify(sortKeys(value));

const show = (value: unknown) => JSON.stringify(value);

const diffJson = (before: unknown, after: unknown, path: string[] = [], changes: Change[] = []): Change[] => {
  if (stableKey(before) === stableKey(after)) return changes;

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const keyPath = [...path, key];
      if (!Object.hasOwn(before, key)) changes.push({ kind: 'added', path: keyPath, after: show(after[key]) });
      else if (!Object.hasOwn(after, key)) changes.push({ kind: 'removed', path: keyPath, before: show(before[key]) });
      else diffJson(before[key], after[key], keyPath, changes);
    }
    return changes;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const oldItems: unknown[] = before;
    const newItems: unknown[] = after;
    for (const step of alignSequences(oldItems.map(stableKey), newItems.map(stableKey))) {
      if (step.type === 'match') continue;
      // Items replaced in the same spot are compared with each other; the rest were added or removed outright.
      const paired = Math.min(step.removed.length, step.added.length);
      step.removed.forEach((oldIndex, position) => {
        const newIndex = step.added[position];
        if (newIndex === undefined) {
          changes.push({ kind: 'removed', path: [...path, `[${oldIndex}]`], before: show(oldItems[oldIndex]) });
        } else {
          diffJson(oldItems[oldIndex], newItems[newIndex], [...path, `[${newIndex}]`], changes);
        }
      });
      for (const newIndex of step.added.slice(paired)) {
        changes.push({ kind: 'added', path: [...path, `[${newIndex}]`], after: show(newItems[newIndex]) });
      }
    }
    return changes;
  }

  changes.push({ kind: 'changed', path, before: show(before), after: show(after) });
  return changes;
};

export { diffJson };
