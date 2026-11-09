import type { FormVersionField } from '../schemas';

type ChangeKind = 'added' | 'changed' | 'moved' | 'removed';

/** One difference between two versions. Values are source text (JSON or JSX), ready to show as-is. */
type Change = {
  after?: string;
  before?: string;
  kind: ChangeKind;
  /** Where the change is, outermost first, e.g. ["start", "permissions", "field2"]. */
  path: string[];
};

type FieldComparison = {
  changes: Change[];
  field: FormVersionField;
  /** "text" means the document couldn't be parsed, so it was compared line by line instead. */
  mode: 'structure' | 'text';
};

type VersionInfo = {
  locked: boolean;
  modified: null | string;
  published: boolean;
  version: string;
};

type FormVersions = {
  id: string;
  name: string;
  /** Newest first. */
  versions: VersionInfo[];
};

type VersionComparison = {
  fields: FieldComparison[];
  form: { id: string; name: string };
  from: VersionInfo;
  to: VersionInfo;
};

export type { Change, ChangeKind, FieldComparison, FormVersions, VersionComparison, VersionInfo };
