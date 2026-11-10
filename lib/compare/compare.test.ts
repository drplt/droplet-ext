import { formVersionV1, formVersionV2, layoutV1, layoutV2 } from '@/test/fixtures/formVersions';

import { compareDocuments } from './documents';
import { diffJson } from './json';
import { diffLayout } from './layout';
import { diffLines } from './lines';

describe('diffJson', () => {
  it('ignores key order and reports each difference by path', () => {
    const before = { a: 1, nested: { keep: true, drop: 'x', edit: 'old' } };
    const after = { nested: { edit: 'new', keep: true, extra: [1] }, a: 1 };
    expect(diffJson(before, after)).toEqual([
      { kind: 'removed', path: ['nested', 'drop'], before: '"x"' },
      { kind: 'changed', path: ['nested', 'edit'], before: '"old"', after: '"new"' },
      { kind: 'added', path: ['nested', 'extra'], after: '[1]' },
    ]);
  });

  it('aligns arrays, so an inserted item is one addition rather than a cascade of edits', () => {
    expect(diffJson([{ t: 'a' }, { t: 'b' }, { t: 'c' }], [{ t: 'a' }, { t: 'new' }, { t: 'b' }, { t: 'c' }])).toEqual([
      { kind: 'added', path: ['[1]'], after: '{"t":"new"}' },
    ]);
  });

  it('compares an item replaced in place with its replacement', () => {
    expect(diffJson({ list: [{ id: 1, v: 'x' }] }, { list: [{ id: 1, v: 'y' }] })).toEqual([
      { kind: 'changed', path: ['list', '[0]', 'v'], before: '"x"', after: '"y"' },
    ]);
  });
});

describe('diffLayout', () => {
  it('reports nothing when a layout is only reformatted', () => {
    // Re-wrap everything above the hidden section; its multi-line formula string is content, not formatting.
    const [visible = '', hidden = ''] = layoutV1.split('<Actions />');
    const reformatted = `${visible.replace(/\n\s*/g, ' ').replace('" }, ]', '" }]')}<Actions />${hidden}`;
    expect(reformatted).not.toBe(layoutV1);
    expect(diffLayout(layoutV1, reformatted)).toEqual([]);
  });

  it('describes edits component by component', () => {
    const view = 'Form › View';
    const lines = diffLayout(layoutV1, layoutV2)?.map(change =>
      [change.kind, change.path.join(' › '), change.before, change.after].filter(Boolean).join(' | '),
    );
    expect(lines).toEqual([
      `changed | ${view} › Section #header › Text #title › h1 › b › text | 90-Day Evaluation | Annual Evaluation`,
      `changed | ${view} › Section 1 › Input #employeeName › label | "Employee Name" | "Staff Name"`,
      `changed | ${view} › Section 2 › marginTop | {30} | {10}`,
      `changed | ${view} › Section 2 › Radio #rating › options | {[ { 1: "Unsatisfactory" }, { 2: "Basic" }, { 3: "Proficient" }, ]} | {[{ 1: "Unsatisfactory" }, { 2: "Basic" }, { 3: "Proficient" }, { 4: "Distinguished" }]}`,
      `moved | Form › Section #hiddenFields › Textarea #comment | ${view} › Section 2 | Form › Section #hiddenFields`,
      `added | ${view} › Section 2 › Signature #signature | <Signature id="signature" label="Evaluator's Signature" columns={8}>`,
    ]);
  });

  it('summarizes a removed container by its text and the fields inside it', () => {
    const before = '<Form><Section><Text><p>Intro</p></Text><Input id="a" /></Section><Tile /></Form>';
    expect(diffLayout(before, '<Form><Tile /></Form>')).toEqual([
      { kind: 'removed', path: ['Form', 'Section'], before: '<Section> “Intro” (contains #a)' },
    ]);
  });

  it('reports a reorder within the same parent as a move', () => {
    const changes = diffLayout('<F><A id="a" /><B id="b" /></F>', '<F><B id="b" /><A id="a" /></F>');
    expect(changes).toHaveLength(1);
    expect(changes?.[0]).toMatchObject({ kind: 'moved' });
    expect(changes?.[0]?.before).toBeUndefined();
  });

  it('gives up on text that is not a single JSX element', () => {
    expect(diffLayout('<Form><Section></Form>', '<Form />')).toBeNull();
    expect(diffLayout('not jsx', '<Form />')).toBeNull();
  });
});

describe('diffLines', () => {
  it('groups neighbouring changed lines', () => {
    expect(diffLines('a\nb\nc\nd', 'a\nB\nC\nd\ne')).toEqual([
      { kind: 'changed', path: ['line 2'], before: 'b\nc', after: 'B\nC' },
      { kind: 'added', path: ['line 5'], after: 'e' },
    ]);
  });
});

describe('compareDocuments', () => {
  const fields = compareDocuments(formVersionV1, formVersionV2);
  const changesIn = (name: string) => fields.find(field => field.field === name)?.changes;

  it('finds the workflow and visibility changes despite reordered keys', () => {
    expect(changesIn('workflow')).toEqual([
      { kind: 'added', path: ['steps', 'start', 'onSubmit', '[0]'], after: '{"target":"review"}' },
      { kind: 'changed', path: ['steps', 'employee', 'label'], before: '"Employee Step"', after: '"Staff Step"' },
      { kind: 'added', path: ['steps', 'review'], after: '{"status":"pending"}' },
    ]);
    expect(changesIn('steps')).toEqual([
      { kind: 'changed', path: ['start', 'permissions', 'employeeName'], before: '"editable"', after: '"readonly"' },
      { kind: 'removed', path: ['start', 'permissions', 'comment'], before: '"editable"' },
      { kind: 'added', path: ['employee', 'permissions', 'signature'], after: '"editable"' },
    ]);
  });

  it('ignores where steps sit on the workflow canvas', () => {
    const workflow = (position: number[]) => ({
      workflow: JSON.stringify({ steps: { start: { position, label: 'Start' } } }),
    });
    const moved = compareDocuments(workflow([160, 80]), workflow([448, -272]));
    expect(moved.every(field => field.changes.length === 0)).toBe(true);
  });

  it('treats reformatted, empty and missing documents as unchanged', () => {
    expect(changesIn('datasets')).toEqual([]);
    expect(changesIn('translations')).toEqual([]);
    expect(changesIn('attributes')).toEqual([]);
  });

  it('falls back to a line comparison when a document is not valid JSON', () => {
    const [workflow] = compareDocuments({ workflow: '{"a": 1,\n' }, { workflow: '{"a": 2,\n' }).filter(
      field => field.field === 'workflow',
    );
    expect(workflow).toEqual({
      field: 'workflow',
      mode: 'text',
      changes: [{ kind: 'changed', path: ['line 1'], before: '{"a": 1,', after: '{"a": 2,' }],
    });
  });
});
