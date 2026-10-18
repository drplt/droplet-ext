// Case-insensitive, Unicode-aware text matching with surrounding context for display.

type Snippet = {
  after: string;
  before: string;
  match: string;
};

type FindOptions = {
  /** Characters of context on each side of a match. */
  context?: number;
  /** Maximum snippets to return; `count` still reflects every occurrence. */
  limit?: number;
};

type FindResult = {
  count: number;
  snippets: Snippet[];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collapse = (value: string) => value.replace(/\s+/g, ' ');

/** Builds a reusable matcher; returns null for blank queries. */
const createMatcher = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const pattern = new RegExp(escapeRegExp(trimmed), 'giu');

  return (text: string, { context = 40, limit = 3 }: FindOptions = {}): FindResult => {
    let count = 0;
    const snippets: Snippet[] = [];
    for (const found of text.matchAll(pattern)) {
      count++;
      if (snippets.length >= limit) continue;
      const start = found.index;
      const end = start + found[0].length;
      const before = collapse(text.slice(Math.max(0, start - context), start));
      const after = collapse(text.slice(end, end + context));
      snippets.push({
        before: start > context ? `…${before.trimStart()}` : before.trimStart(),
        match: found[0],
        after: end + context < text.length ? `${after.trimEnd()}…` : after.trimEnd(),
      });
    }
    return { count, snippets };
  };
};

type Matcher = NonNullable<ReturnType<typeof createMatcher>>;

/** Form/dataset documents arrive as raw strings (JSX / JSON text) or already-parsed JSON. */
const toSearchableText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export { createMatcher, type FindResult, type Matcher, type Snippet, toSearchableText };
