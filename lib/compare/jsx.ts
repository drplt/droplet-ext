// A small, tolerant parser for form layouts (JSX). It only needs the shape — elements, their props and text — so
// expressions in braces are kept as source text rather than evaluated. Returns null for anything it can't read, and
// the caller falls back to a line-by-line comparison.

type JsxValue = {
  /** Whitespace-insensitive form, for telling whether two values are the same. */
  key: string;
  /** Source text to show. */
  text: string;
};

type JsxText = { type: 'text'; value: string };

type JsxElement = {
  children: JsxNode[];
  props: Map<string, JsxValue>;
  tag: string;
  type: 'element';
};

type JsxNode = JsxElement | JsxText;

const QUOTES = new Set(['"', "'", '`']);
const NAME = /[A-Za-z_$][\w$.:-]*/y;
const TEXT = /[^<{]*/y;

/** Index just past the string literal that opens at `start`, or -1 if it never closes. */
const endOfString = (source: string, start: number) => {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') index++;
    else if (source[index] === quote) return index + 1;
  }
  return -1;
};

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Reformatting an expression (line wrapping, trailing commas) must not read as a change. String literals inside it
 * are left exactly as written.
 */
const toValue = (expression: string): JsxValue => {
  let key = '';
  let text = '';
  let index = 0;
  while (index < expression.length) {
    const end = QUOTES.has(expression[index] ?? '') ? endOfString(expression, index) : -1;
    if (end !== -1) {
      const literal = expression.slice(index, end);
      key += literal;
      text += literal;
      index = end;
      continue;
    }
    let next = index + 1;
    while (next < expression.length && !QUOTES.has(expression[next] ?? '')) next++;
    const code = expression.slice(index, next);
    key += code.replace(/\s+/g, '');
    text += code.replace(/\s+/g, ' ');
    index = next;
  }
  return { key: key.replace(/,([\])}])/g, '$1'), text: text.trim() };
};

// Prettier writes `{" "}` where a line break would otherwise swallow a space.
const isSpacer = (value: JsxValue) => value.key === '{" "}' || value.key === "{' '}";

const parseJsx = (source: string): JsxElement | null => {
  let pos = 0;

  const fail = (): never => {
    throw new SyntaxError(`Unexpected layout syntax at ${pos}`);
  };

  const skipSpace = () => {
    while (/\s/.test(source[pos] ?? '')) pos++;
  };

  const readName = () => {
    NAME.lastIndex = pos;
    const [name] = NAME.exec(source) ?? fail();
    pos += name.length;
    return name;
  };

  // JSX attribute strings have no escapes: they run to the next matching quote.
  const readQuoted = () => {
    const end = source.indexOf(source[pos] ?? '', pos + 1);
    if (end === -1) fail();
    const raw = source.slice(pos, end + 1);
    pos = end + 1;
    return raw;
  };

  const readBraces = () => {
    const start = pos;
    let depth = 0;
    while (pos < source.length) {
      const char = source[pos] ?? '';
      if (QUOTES.has(char)) {
        const end = endOfString(source, pos);
        if (end === -1) fail();
        pos = end;
        continue;
      }
      if (source.startsWith('/*', pos)) {
        const end = source.indexOf('*/', pos + 2);
        if (end === -1) fail();
        pos = end + 2;
        continue;
      }
      pos++;
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return source.slice(start, pos);
    }
    return fail();
  };

  const parseChildren = (closing: null | string): JsxNode[] => {
    const children: JsxNode[] = [];
    while (pos < source.length) {
      if (source.startsWith('</', pos)) {
        if (closing === null) fail();
        pos += 2;
        skipSpace();
        const name = source[pos] === '>' ? '' : readName();
        skipSpace();
        if (name !== closing || source[pos] !== '>') fail();
        pos++;
        return children;
      }
      const char = source[pos];
      if (char === '<') {
        children.push(parseElement());
      } else if (char === '{') {
        const value = toValue(readBraces());
        if (!isSpacer(value)) children.push({ type: 'text', value: value.text });
      } else {
        TEXT.lastIndex = pos;
        const [raw] = TEXT.exec(source) ?? fail();
        pos += raw.length;
        const value = collapse(raw);
        if (value) children.push({ type: 'text', value });
      }
    }
    if (closing !== null) fail();
    return children;
  };

  const parseElement = (): JsxElement => {
    pos++;
    const tag = source[pos] === '>' ? '' : readName();
    const props = new Map<string, JsxValue>();
    for (;;) {
      skipSpace();
      if (source.startsWith('/>', pos)) {
        pos += 2;
        return { type: 'element', tag, props, children: [] };
      }
      if (source[pos] === '>') {
        pos++;
        return { type: 'element', tag, props, children: parseChildren(tag) };
      }
      if (source[pos] === '{') {
        const spread = toValue(readBraces());
        props.set(spread.key, spread);
        continue;
      }
      const name = readName();
      skipSpace();
      if (source[pos] !== '=') {
        props.set(name, { key: '{true}', text: '{true}' });
        continue;
      }
      pos++;
      skipSpace();
      const char = source[pos];
      if (char === '"' || char === "'") {
        const raw = readQuoted();
        props.set(name, { key: raw, text: raw });
      } else if (char === '{') {
        props.set(name, toValue(readBraces()));
      } else {
        fail();
      }
    }
  };

  try {
    const [root, ...rest] = parseChildren(null);
    return root?.type === 'element' && rest.length === 0 ? root : null;
  } catch {
    return null;
  }
};

export { type JsxElement, type JsxNode, type JsxValue, parseJsx };
