import type { Snippet as SnippetData } from '@/lib/search/match';

/** Renders "…before <mark>match</mark> after…" as text nodes — never as HTML. */
const Snippet = ({ snippet }: { snippet: SnippetData }) => (
  <q className="snippet">
    {snippet.before}
    <mark>{snippet.match}</mark>
    {snippet.after}
  </q>
);

export { Snippet };
