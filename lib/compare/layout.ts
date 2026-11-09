// Compares two form layouts component by component rather than line by line, so the result reads as "this field's
// label changed" or "this component moved" and reformatting alone reports nothing.
//
// Components with an `id` are followed wherever they go. Components without one are matched to the most similar
// sibling of the same kind.
import type { JsxElement, JsxNode } from './jsx';
import type { Change } from './types';

import { alignSequences } from './align';
import { parseJsx } from './jsx';

type Located = {
  element: JsxElement;
  label: string;
  /** Labels of the ancestors, outermost first. */
  trail: string[];
};

const SUMMARY_TEXT_LENGTH = 120;

const idOf = (element: JsxElement): null | string => {
  const raw = element.props.get('id')?.text;
  if (!raw) return null;
  return /^(["']).*\1$/s.test(raw) ? raw.slice(1, -1) : raw;
};

const keys = new WeakMap<JsxElement, string>();

/** Canonical text of an element and everything in it: equal keys mean nothing changed. */
const keyOf = (element: JsxElement): string => {
  const cached = keys.get(element);
  if (cached !== undefined) return cached;
  const props = [...element.props]
    .map(([name, value]) => `${name}=${value.key}`)
    .sort()
    .join(' ');
  const children = element.children.map(child => (child.type === 'text' ? JSON.stringify(child.value) : keyOf(child)));
  const key = `<${element.tag} ${props}>${children.join('')}</>`;
  keys.set(element, key);
  return key;
};

const identityOf = (node: JsxNode) => {
  if (node.type === 'text') return `text:${node.value}`;
  const id = idOf(node);
  return id === null ? `anonymous:${keyOf(node)}` : `id:${id}`;
};

const tagName = (element: JsxElement) => element.tag || 'Fragment';

/** A label for each child: "Input #email" with an id, otherwise "Section 3" (its position among the sections). */
const childLabels = (children: JsxNode[]): string[] => {
  const totals = new Map<string, number>();
  for (const child of children) {
    if (child.type === 'element' && idOf(child) === null) totals.set(child.tag, (totals.get(child.tag) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return children.map(child => {
    if (child.type === 'text') return 'text';
    const id = idOf(child);
    if (id !== null) return `${tagName(child)} #${id}`;
    const position = (seen.get(child.tag) ?? 0) + 1;
    seen.set(child.tag, position);
    return (totals.get(child.tag) ?? 0) > 1 ? `${tagName(child)} ${position}` : tagName(child);
  });
};

const rootLabel = (root: JsxElement) => childLabels([root])[0] ?? tagName(root);

const descendantIds = (element: JsxElement, ids: string[] = []): string[] => {
  for (const child of element.children) {
    if (child.type !== 'element') continue;
    const id = idOf(child);
    if (id !== null) ids.push(id);
    descendantIds(child, ids);
  }
  return ids;
};

const textOf = (element: JsxElement): string =>
  element.children
    .map(child => (child.type === 'text' ? child.value : textOf(child)))
    .filter(Boolean)
    .join(' ');

/** One line describing a whole component: its opening tag, its text, and the ids it contains. */
const summarize = (element: JsxElement) => {
  const props = [...element.props].map(([name, value]) => (value.key === '{true}' ? name : `${name}=${value.text}`));
  const text = textOf(element);
  const ids = descendantIds(element);
  return [
    `<${[tagName(element), ...props].join(' ')}>`,
    text && `“${text.length > SUMMARY_TEXT_LENGTH ? `${text.slice(0, SUMMARY_TEXT_LENGTH)}…` : text}”`,
    ids.length > 0 && `(contains ${ids.map(id => `#${id}`).join(', ')})`,
  ]
    .filter(Boolean)
    .join(' ');
};

const indexById = (root: JsxElement) => {
  const index = new Map<string, Located>();
  const visit = (element: JsxElement, label: string, trail: string[]) => {
    const id = idOf(element);
    if (id !== null && !index.has(id)) index.set(id, { element, label, trail });
    const labels = childLabels(element.children);
    element.children.forEach((child, position) => {
      if (child.type === 'element') visit(child, labels[position] ?? tagName(child), [...trail, label]);
    });
  };
  visit(root, rootLabel(root), []);
  return index;
};

const sharedCount = (a: string[], b: Set<string>) => a.filter(id => b.has(id)).length;

/** Returns null when either layout can't be parsed. */
const diffLayout = (beforeSource: string, afterSource: string): Change[] | null => {
  const before = parseJsx(beforeSource);
  const after = parseJsx(afterSource);
  if (!before || !after) return null;

  const changes: Change[] = [];
  // Components with ids that vanished from, or appeared in, a parent. Settled at the end, once it's known whether
  // each was really removed/added or just moved.
  const removedRoots: Located[] = [];
  const addedRoots: Located[] = [];

  const diffElement = (a: JsxElement, b: JsxElement, path: string[]) => {
    if (keyOf(a) === keyOf(b)) return;
    if (a.tag !== b.tag) {
      changes.push({ kind: 'changed', path: [...path, 'component'], before: tagName(a), after: tagName(b) });
    }
    for (const name of new Set([...a.props.keys(), ...b.props.keys()])) {
      const oldValue = a.props.get(name);
      const newValue = b.props.get(name);
      const propPath = [...path, name];
      if (!oldValue && newValue) changes.push({ kind: 'added', path: propPath, after: newValue.text });
      else if (oldValue && !newValue) changes.push({ kind: 'removed', path: propPath, before: oldValue.text });
      else if (oldValue && newValue && oldValue.key !== newValue.key) {
        changes.push({ kind: 'changed', path: propPath, before: oldValue.text, after: newValue.text });
      }
    }
    diffChildren(a.children, b.children, path);
  };

  const diffChildren = (oldNodes: JsxNode[], newNodes: JsxNode[], path: string[]) => {
    const oldLabels = childLabels(oldNodes);
    const newLabels = childLabels(newNodes);

    for (const step of alignSequences(oldNodes.map(identityOf), newNodes.map(identityOf))) {
      if (step.type === 'match') {
        const oldNode = oldNodes[step.a];
        const newNode = newNodes[step.b];
        if (oldNode?.type === 'element' && newNode?.type === 'element') {
          diffElement(oldNode, newNode, [...path, newLabels[step.b] ?? tagName(newNode)]);
        }
        continue;
      }

      const unclaimed = new Set(step.added);
      for (const oldIndex of step.removed) {
        const oldNode = oldNodes[oldIndex];
        if (!oldNode) continue;
        const oldLabel = oldLabels[oldIndex] ?? '';

        if (oldNode.type === 'text') {
          const newIndex = [...unclaimed].find(index => newNodes[index]?.type === 'text');
          const newNode = newIndex === undefined ? undefined : newNodes[newIndex];
          if (newIndex !== undefined && newNode?.type === 'text') {
            unclaimed.delete(newIndex);
            changes.push({ kind: 'changed', path: [...path, 'text'], before: oldNode.value, after: newNode.value });
          } else {
            changes.push({ kind: 'removed', path: [...path, 'text'], before: oldNode.value });
          }
          continue;
        }

        if (idOf(oldNode) !== null) {
          removedRoots.push({ element: oldNode, label: oldLabel, trail: path });
          continue;
        }

        // No id: treat the same-kind newcomer sharing the most contents as the edited version of this one.
        const oldIds = new Set(descendantIds(oldNode));
        let best: null | { element: JsxElement; index: number; score: number } = null;
        for (const index of unclaimed) {
          const candidate = newNodes[index];
          if (candidate?.type !== 'element' || candidate.tag !== oldNode.tag || idOf(candidate) !== null) continue;
          const score = sharedCount(descendantIds(candidate), oldIds);
          if (!best || score > best.score) best = { element: candidate, index, score };
        }
        if (best) {
          unclaimed.delete(best.index);
          diffElement(oldNode, best.element, [...path, newLabels[best.index] ?? tagName(best.element)]);
        } else {
          changes.push({ kind: 'removed', path: [...path, oldLabel], before: summarize(oldNode) });
        }
      }

      for (const newIndex of unclaimed) {
        const newNode = newNodes[newIndex];
        if (!newNode) continue;
        const newLabel = newLabels[newIndex] ?? '';
        if (newNode.type === 'text') changes.push({ kind: 'added', path: [...path, 'text'], after: newNode.value });
        else if (idOf(newNode) !== null) addedRoots.push({ element: newNode, label: newLabel, trail: path });
        else changes.push({ kind: 'added', path: [...path, newLabel], after: summarize(newNode) });
      }
    }
  };

  const oldIndex = indexById(before);
  const newIndex = indexById(after);
  const settled = new Set<string>();

  const settle = (from: Located | undefined, to: Located | undefined, id: string) => {
    if (settled.has(id)) return;
    settled.add(id);
    if (from && to) {
      const sameParent = from.trail.join('\n') === to.trail.join('\n');
      changes.push({
        kind: 'moved',
        path: [...to.trail, to.label],
        ...(!sameParent && { before: from.trail.join(' › '), after: to.trail.join(' › ') }),
      });
      diffElement(from.element, to.element, [...to.trail, to.label]);
    } else if (from) {
      changes.push({ kind: 'removed', path: [...from.trail, from.label], before: summarize(from.element) });
    } else if (to) {
      changes.push({ kind: 'added', path: [...to.trail, to.label], after: summarize(to.element) });
    }
  };

  const rootPath = [rootLabel(after)];
  diffElement(before, after, rootPath);

  // Comparing a moved component's contents can surface more moves, so keep going until both lists are empty.
  for (;;) {
    const removed = removedRoots.shift();
    const added = removed ? undefined : addedRoots.shift();
    const root = removed ?? added;
    if (!root) break;
    const id = idOf(root.element);
    if (id === null) continue;
    settle(removed ?? oldIndex.get(id), added ?? newIndex.get(id), id);
  }

  return changes;
};

export { diffLayout };
