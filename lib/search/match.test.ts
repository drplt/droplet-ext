import { createMatcher, toSearchableText } from './match';

describe('createMatcher', () => {
  it('returns null for a blank query', () => {
    expect(createMatcher('   ')).toBeNull();
  });

  it('matches case-insensitively and keeps original casing in the snippet', () => {
    const match = createMatcher('patient')!;
    const result = match('First PATIENT name, then patient id');
    expect(result.count).toBe(2);
    expect(result.snippets[0]).toEqual({ before: 'First ', match: 'PATIENT', after: ' name, then patient id' });
  });

  it('treats regex characters literally', () => {
    const match = createMatcher('a.b (c)')!;
    expect(match('axb (c)').count).toBe(0);
    expect(match('see a.b (c) here').count).toBe(1);
  });

  it('limits snippets but still counts every match', () => {
    const result = createMatcher('x')!('x x x x x', { limit: 2 });
    expect(result.count).toBe(5);
    expect(result.snippets).toHaveLength(2);
  });

  it('trims context with ellipses and collapses whitespace', () => {
    const text = `${'a'.repeat(50)}\n\n  needle  \n${'b'.repeat(50)}`;
    const [snippet] = createMatcher('needle')!(text, { context: 10 }).snippets;
    expect(snippet?.before.startsWith('…')).toBe(true);
    expect(snippet?.after.endsWith('…')).toBe(true);
    expect(snippet?.before).not.toMatch(/\n/);
  });

  it('handles non-ASCII text', () => {
    expect(createMatcher('ÉCOLE')!('Nom de l’école').count).toBe(1);
  });
});

describe('toSearchableText', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['text', 'text'],
    [12, '12'],
    [true, 'true'],
    [{ a: 'b' }, '{"a":"b"}'],
  ])('%j → %j', (value, expected) => {
    expect(toSearchableText(value)).toBe(expected);
  });
});
