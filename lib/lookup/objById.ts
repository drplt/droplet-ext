// Droplet ids are per-type salted hashids (or plain integers for submissions), so an id alone doesn't say what it
// refers to. Probe every getById route the current user can reach and report each one that resolves.
import { z } from 'zod';

import type { ApiClient } from '../api';
import type { ObjectType } from '../routes';

import { ApiError } from '../api';

type LookupHit = {
  formId: null | string;
  id: string;
  label: string;
  type: ObjectType;
};

type LookupResult = {
  /** Types the user isn't permitted to read, so a match there can't be ruled out. */
  forbidden: ObjectType[];
  hits: LookupHit[];
};

const entity = z.looseObject({
  id: z.union([z.string(), z.number()]),
  formId: z.string().nullish(),
  name: z.string().nullish(),
  title: z.string().nullish(),
});

type Entity = z.infer<typeof entity>;

type Probe = {
  fetch: (api: ApiClient, id: string, signal: AbortSignal) => Promise<Entity | null>;
  /** Only probe when the id looks like this type's id format. */
  accepts?: (id: string) => boolean;
  type: ObjectType;
};

const isNumeric = (id: string) => /^\d+$/.test(id);

const byId =
  (resource: string): Probe['fetch'] =>
  (api, id, signal) =>
    api.get(`${resource}/${encodeURIComponent(id)}`, entity, { signal });

// GET submissions/:id wraps the submission alongside its form version.
const submissionResponse = z.looseObject({ submission: entity });

// Paths are the drplt spec base paths (`Spec('esign', …)`), not the spec registry keys (`documents`, …).
const PROBES: Probe[] = [
  { type: 'form', fetch: byId('forms') },
  { type: 'dataset', fetch: byId('datasets') },
  {
    type: 'submission',
    accepts: isNumeric,
    fetch: async (api, id, signal) => {
      const { submission } = await api.get(`submissions/${encodeURIComponent(id)}`, submissionResponse, { signal });
      return submission;
    },
  },
  { type: 'esignTemplate', fetch: byId('esign') },
  { type: 'esignSubmission', fetch: byId('esignSubmissions'), accepts: isNumeric },
  { type: 'packetTemplate', fetch: byId('packets/templates') },
];

const labelFor = (found: Entity, id: string) => found.name ?? found.title ?? id;

const findObjById = async (api: ApiClient, rawId: string, signal: AbortSignal): Promise<LookupResult> => {
  const id = rawId.trim();
  const result: LookupResult = { forbidden: [], hits: [] };
  if (!id) return result;

  const probes = PROBES.filter(probe => probe.accepts?.(id) ?? true);
  const settled = await Promise.allSettled(probes.map(probe => probe.fetch(api, id, signal)));
  signal.throwIfAborted();

  settled.forEach((outcome, index) => {
    const probe = probes[index];
    if (!probe) return;
    if (outcome.status === 'fulfilled') {
      if (outcome.value) {
        result.hits.push({
          type: probe.type,
          id,
          label: labelFor(outcome.value, id),
          formId: outcome.value.formId ?? null,
        });
      }
      return;
    }
    const error: unknown = outcome.reason;
    if (!(error instanceof ApiError)) return;
    // A dead session or network failure means we learned nothing; surface it instead of saying "not found".
    if (error.kind === 'unauthorized' || error.kind === 'network') throw error;
    if (error.kind === 'forbidden') result.forbidden.push(probe.type);
  });

  return result;
};

export { findObjById, type LookupHit, type LookupResult, PROBES };
