import { z } from 'zod';

import type { ApiClient } from '../api';
import type { FormVersions, VersionComparison, VersionInfo } from './types';

import { FORM_VERSION_FIELDS, formVersion, versionList } from '../schemas';
import { compareDocuments } from './documents';

const formSummary = z.looseObject({
  name: z.string().nullish(),
  publishedVersion: z.string().nullish(),
});

const byNewest = (a: VersionInfo, b: VersionInfo) => (b.modified ?? '').localeCompare(a.modified ?? '');

/** A form's name and every version of it, newest first. */
const listFormVersions = async (api: ApiClient, formId: string, signal?: AbortSignal): Promise<FormVersions> => {
  const path = `forms/${encodeURIComponent(formId)}`;
  const [form, { versions }] = await Promise.all([
    api.get(path, formSummary, { signal }),
    api.get(`${path}/versions`, versionList, { signal }),
  ]);
  return {
    id: formId,
    name: form.name ?? formId,
    versions: versions
      .map(version => ({
        version: version.version,
        modified: version.modified ?? null,
        locked: version.locked === true,
        published: version.version === form.publishedVersion,
      }))
      .sort(byNewest),
  };
};

const compareFormVersions = async (
  api: ApiClient,
  { formId, from, to }: { formId: string; from: string; to: string },
  signal: AbortSignal,
): Promise<VersionComparison> => {
  const getDocuments = (version: string) =>
    api.get(`forms/${encodeURIComponent(formId)}/versions/${encodeURIComponent(version)}`, formVersion, {
      query: { include: FORM_VERSION_FIELDS.join(',') },
      signal,
    });
  const [form, before, after] = await Promise.all([
    listFormVersions(api, formId, signal),
    getDocuments(from),
    getDocuments(to),
  ]);
  const info = (version: string): VersionInfo =>
    form.versions.find(candidate => candidate.version === version) ?? {
      version,
      modified: null,
      locked: false,
      published: false,
    };

  return {
    form: { id: form.id, name: form.name },
    from: info(from),
    to: info(to),
    fields: compareDocuments(before, after),
  };
};

export { compareFormVersions, listFormVersions };
