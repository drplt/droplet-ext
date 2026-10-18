// Minimal response schemas modelled on drplt/src/models/* and drplt/src/sdk/schema. Only the fields the extension
// reads are declared; loose objects tolerate the API adding fields.
import { z } from 'zod';

// Extension CSP forbids eval; tell zod not to probe for it (avoids CSP violation reports and store-review flags).
z.config({ jitless: true });

const envelope = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.unknown().optional() }),
  z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

const allIds = z.object({
  count: z.number(),
  ids: z.array(z.string().min(1)),
});

const versionList = z.object({
  count: z.number().optional(),
  versions: z.array(
    z.looseObject({
      version: z.string(),
      locked: z.boolean().nullish(),
      modified: z.string().nullish(),
    }),
  ),
});

// Searchable documents on a form version (drplt/src/models/forms formVersionDoc). Values are raw JSX/JSON text.
const FORM_VERSION_FIELDS = [
  'layout',
  'workflow',
  'steps',
  'attributes',
  'datasets',
  'notifications',
  'integrations',
  'translations',
  'tagExpressions',
] as const;

// `include=` selects exactly which fields the API returns; only request (and declare) what's read.
const formVersion = z.looseObject({
  ...Object.fromEntries(FORM_VERSION_FIELDS.map(field => [field, z.unknown().optional()])),
});

const datasetVersion = z.looseObject({
  data: z.unknown().optional(),
  configuration: z
    .looseObject({
      columnConfigurations: z
        .array(z.looseObject({ identifier: z.string().nullish(), name: z.string().nullish() }))
        .nullish(),
    })
    .nullish(),
});

type DatasetVersion = z.infer<typeof datasetVersion>;
type FormVersionField = (typeof FORM_VERSION_FIELDS)[number];

export {
  allIds,
  type DatasetVersion,
  datasetVersion,
  envelope,
  FORM_VERSION_FIELDS,
  formVersion,
  type FormVersionField,
  versionList,
};
