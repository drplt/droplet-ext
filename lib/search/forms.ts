import type { FormVersionField } from '../schemas';
import type { SearchTarget, VersionMatch } from './types';

import { FORM_VERSION_FIELDS, formVersion } from '../schemas';
import { toSearchableText } from './match';
import { listEntities } from './shared';

const FIELD_LABELS: Record<FormVersionField, string> = {
  attributes: 'Attributes',
  datasets: 'Datasets',
  integrations: 'Integrations',
  layout: 'Layout',
  notifications: 'Notifications',
  steps: 'Visibility',
  tagExpressions: 'Tags',
  translations: 'Translations',
  workflow: 'Workflow',
};

const formsTarget: SearchTarget = {
  type: 'forms',
  resource: 'forms',
  objectType: 'form',
  listItems: (api, signal) => listEntities('forms', api, signal),
  searchVersion: async ({ api, item, matcher, signal, version }) => {
    const doc = await api.get(
      `forms/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(version)}`,
      formVersion,
      // `include` selects exactly which fields come back.
      { query: { include: FORM_VERSION_FIELDS.join(',') }, signal },
    );

    let matchCount = 0;
    const matches: VersionMatch[] = [];
    for (const field of FORM_VERSION_FIELDS) {
      const { count, snippets } = matcher(toSearchableText(doc[field]));
      matchCount += count;
      for (const snippet of snippets) matches.push({ location: FIELD_LABELS[field], snippet });
    }
    return { matchCount, matches };
  },
};

export { formsTarget };
