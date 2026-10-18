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
  email: z.string().nullish(),
  formId: z.string().nullish(),
  fullName: z.string().nullish(),
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

const PROBES: Probe[] = [
  { type: 'form', fetch: byId('forms') },
  { type: 'dataset', fetch: byId('datasets') },
  { type: 'submission', fetch: byId('submissions'), accepts: isNumeric },
  { type: 'esignSubmission', fetch: byId('documentSubmissions'), accepts: isNumeric },
  { type: 'esignTemplate', fetch: byId('documents') },
  { type: 'packet', fetch: byId('packets') },
  { type: 'packetTemplate', fetch: byId('packets/templates') },
  { type: 'client', fetch: byId('clients') },
  { type: 'employee', fetch: byId('employees') },
  { type: 'role', fetch: byId('roles') },
  { type: 'tag', fetch: byId('tags') },
  {
    type: 'account',
    fetch: async (api, id, signal) => {
      const accounts = await api.post('accounts/entities', { ids: [id] }, z.array(entity), { signal });
      return accounts[0] ?? null;
    },
  },
];

const labelFor = (found: Entity, id: string) => found.name ?? found.title ?? found.fullName ?? found.email ?? id;

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
