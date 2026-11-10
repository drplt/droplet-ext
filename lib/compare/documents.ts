// Compares the documents of two form versions, field by field. The API returns each document as text: the layout
// is JSX and the rest are JSON, so comparing the raw strings would mostly report formatting.
import type { FormVersionField } from '../schemas';
import type { Change, FieldComparison } from './types';

import { FORM_VERSION_FIELDS } from '../schemas';
import { diffJson } from './json';
import { diffLayout } from './layout';
import { diffLines } from './lines';

type VersionDocuments = Partial<Record<FormVersionField, unknown>>;

const toText = (value: unknown) => {
  if (typeof value === 'string') return value;
  return value == null ? '' : JSON.stringify(value, null, 2);
};

type Parsed = { ok: false } | { ok: true; value: unknown };

/** A missing or blank document counts as an empty object, so "{}" → absent isn't reported as a change. */
const parseDocument = (value: unknown): Parsed => {
  if (value == null) return { ok: true, value: {} };
  if (typeof value !== 'string') return { ok: true, value };
  if (!value.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Drops each step's `position`: where it sits on the workflow canvas, which says nothing about how the form behaves. */
const withoutStepPositions = (workflow: unknown): unknown => {
  if (!isRecord(workflow) || !isRecord(workflow.steps)) return workflow;
  const steps = Object.entries(workflow.steps).map(([name, step]): [string, unknown] => {
    if (!isRecord(step)) return [name, step];
    const { position: _position, ...rest } = step;
    return [name, rest];
  });
  return { ...workflow, steps: Object.fromEntries(steps) };
};

const compareField = (field: FormVersionField, before: unknown, after: unknown): FieldComparison => {
  const asText = (): FieldComparison => ({ field, mode: 'text', changes: diffLines(toText(before), toText(after)) });

  if (field === 'layout') {
    const changes: Change[] | null = diffLayout(toText(before), toText(after));
    return changes ? { field, mode: 'structure', changes } : asText();
  }

  const oldDocument = parseDocument(before);
  const newDocument = parseDocument(after);
  if (!oldDocument.ok || !newDocument.ok) return asText();
  const clean = field === 'workflow' ? withoutStepPositions : (value: unknown) => value;
  return { field, mode: 'structure', changes: diffJson(clean(oldDocument.value), clean(newDocument.value)) };
};

const compareDocuments = (before: VersionDocuments, after: VersionDocuments): FieldComparison[] =>
  FORM_VERSION_FIELDS.map(field => compareField(field, before[field], after[field]));

const totalChanges = (fields: FieldComparison[]) => fields.reduce((total, field) => total + field.changes.length, 0);

export { compareDocuments, totalChanges, type VersionDocuments };
