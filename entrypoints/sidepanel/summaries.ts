// Plain-text summaries of a job, shared by the visible result headers and the panel's live region, so a screen reader
// hears the same sentence that's on screen.
import type { LookupHit, LookupResult } from '@/lib/lookup/objById';
import type { JobState } from '@/lib/messages';
import type { ObjectType } from '@/lib/routes';

import { totalChanges } from '@/lib/compare/documents';
import { t } from '@/lib/i18n';
import { PROBES } from '@/lib/lookup/objById';

import { changeCount } from './format';
import { countOf, listOf, noun, TARGET_OBJECT_TYPES } from './labels';

type FindTextJob = JobState & { request: Extract<JobState['request'], { kind: 'findText' }> };

/** How far a text search got. `searched` excludes skipped and failed items, so the parts add up to the total. */
type TextCounts = {
  failed: number;
  matched: number;
  /** The run stopped early (cancelled or failed), so counts cover only what it reached. */
  partial: boolean;
  searched: number;
  skipped: number;
  type: ObjectType;
};

const textCounts = (job: FindTextJob): null | TextCounts => {
  if (!job.progress) return null;
  const partial = job.status !== 'done';
  const reached = partial ? job.progress.done : job.progress.total;
  const skipped = job.skipped.length;
  const failed = job.itemErrors.length;
  return {
    type: TARGET_OBJECT_TYPES[job.request.target],
    matched: job.hits.length,
    searched: Math.max(0, reached - skipped - failed),
    skipped,
    failed,
    partial,
  };
};

/** "Found in 3 of 209 forms", "Found in 1 of 61 forms searched", or "Searched 214 forms" when nothing matched. */
const textFoundLine = (counts: TextCounts) =>
  counts.matched === 0 && !counts.partial
    ? t('resultsSearched', [countOf(counts.type, counts.searched)])
    : t(counts.partial ? 'resultsFoundPartial' : 'resultsFound', [
        counts.matched,
        countOf(counts.type, counts.searched),
      ]);

const textNoMatches = (job: FindTextJob) =>
  [
    t('noTextMatches', [noun(TARGET_OBJECT_TYPES[job.request.target], 2), job.request.query]),
    job.request.options.includeDrafts ? null : t('noTextMatchesDrafts'),
  ]
    .filter(Boolean)
    .join(' ');

/** Which types a lookup of this ID tries. Mirrors `PROBES` in lib/lookup/objById.ts, the source of truth. */
const probedTypes = (id: string): ObjectType[] =>
  PROBES.filter(probe => probe.accepts?.(id.trim()) ?? true).map(probe => probe.type);

const typeList = (types: ObjectType[], count: number, joiner: 'conjunction' | 'disjunction') =>
  listOf(
    types.map(type => noun(type, count)),
    joiner,
  );

/** "Checking forms, datasets, eSign templates and packet templates…" */
const lookingUpText = (id: string) => t('lookingUp', [typeList(probedTypes(id), 2, 'conjunction')]);

/**
 * What a finished lookup means. Types the user's role can't read are "unchecked": a match there can't be ruled out,
 * so "not found" is only definite when everything was checked.
 */
type LookupOutcome =
  | { checked: ObjectType[]; kind: 'notFound' }
  | { hits: LookupHit[]; kind: 'found'; unchecked: ObjectType[] }
  | { kind: 'notFoundPartial'; unchecked: ObjectType[] };

const lookupOutcome = (id: string, lookup: LookupResult): LookupOutcome =>
  lookup.hits.length > 0
    ? { kind: 'found', hits: lookup.hits, unchecked: lookup.forbidden }
    : lookup.forbidden.length > 0
      ? { kind: 'notFoundPartial', unchecked: lookup.forbidden }
      : { kind: 'notFound', checked: probedTypes(id) };

/** The sentences that explain a lookup outcome, in reading order. */
const lookupSentences = (outcome: LookupOutcome): string[] => {
  switch (outcome.kind) {
    case 'notFound':
      return [t('idNotFound', [typeList(outcome.checked, 1, 'disjunction')])];
    case 'notFoundPartial':
      return [t('idNotFoundPartial', [typeList(outcome.unchecked, 2, 'disjunction')])];
    case 'found':
      return [
        outcome.hits.length > 1 ? t('idMatchesMany', [outcome.hits.length]) : null,
        outcome.unchecked.length > 0 ? t('idUncheckedAlso', [typeList(outcome.unchecked, 2, 'disjunction')]) : null,
      ].filter((sentence): sentence is string => sentence !== null);
  }
};

const lookupAnnouncement = (outcome: LookupOutcome) => {
  const [hit, ...others] = outcome.kind === 'found' ? outcome.hits : [];
  if (!hit || others.length > 0) return lookupSentences(outcome).join(' ');
  return [t('idFoundOne', [noun(hit.type, 1), hit.label]), ...lookupSentences(outcome)].join(' ');
};

const isFindText = (job: JobState): job is FindTextJob => job.request.kind === 'findText';

/** One sentence when a job starts and one when it finishes. Failures are announced by their own alert instead. */
const jobAnnouncement = (job: JobState): null | string => {
  const { request } = job;
  if (job.status === 'error') return null;

  if (job.status === 'running') {
    switch (request.kind) {
      case 'findText':
        return t('announceSearching', [noun(TARGET_OBJECT_TYPES[request.target], 2), request.query]);
      case 'findById':
        return lookingUpText(request.id);
      case 'compareVersions':
        return t('announceComparing', [request.from, request.to]);
    }
  }

  if (isFindText(job)) {
    const counts = textCounts(job);
    if (!counts) return job.status === 'cancelled' ? t('cancelled') : null;
    const found = counts.matched === 0 && !counts.partial ? textNoMatches(job) : textFoundLine(counts);
    return job.status === 'cancelled' ? `${t('cancelled')} ${found}` : found;
  }
  if (request.kind === 'findById') {
    return job.lookup ? lookupAnnouncement(lookupOutcome(request.id, job.lookup)) : null;
  }
  const { comparison } = job;
  if (!comparison) return null;
  return `${t('compareHeading', [comparison.from.version, comparison.to.version])} · ${changeCount(totalChanges(comparison.fields))}`;
};

export {
  type FindTextJob,
  isFindText,
  jobAnnouncement,
  lookingUpText,
  lookupOutcome,
  type LookupOutcome,
  lookupSentences,
  textCounts,
  type TextCounts,
  textFoundLine,
  textNoMatches,
};
