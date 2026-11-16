import type { ChangeKind } from '@/lib/compare/types';
import type { MessageKey } from '@/lib/i18n';
import type { ObjectType } from '@/lib/routes';
import type { FormVersionField } from '@/lib/schemas';
import type { SearchTargetType } from '@/lib/search/types';

import { t } from '@/lib/i18n';

const OBJECT_TYPE_LABELS: Record<ObjectType, MessageKey> = {
  dataset: 'typeDataset',
  esignSubmission: 'typeEsignSubmission',
  esignTemplate: 'typeEsignTemplate',
  form: 'typeForm',
  packetTemplate: 'typePacketTemplate',
  submission: 'typeSubmission',
};

/** Lower-case nouns for running text: "3 forms", "No form or dataset has this ID". */
const OBJECT_TYPE_NOUNS: Record<ObjectType, { one: MessageKey; other: MessageKey }> = {
  dataset: { one: 'nounDataset', other: 'nounDatasets' },
  esignSubmission: { one: 'nounEsignSubmission', other: 'nounEsignSubmissions' },
  esignTemplate: { one: 'nounEsignTemplate', other: 'nounEsignTemplates' },
  form: { one: 'nounForm', other: 'nounForms' },
  packetTemplate: { one: 'nounPacketTemplate', other: 'nounPacketTemplates' },
  submission: { one: 'nounSubmission', other: 'nounSubmissions' },
};

/** The app page name used in "switch to the … page" hints. */
const OBJECT_PAGE_LABELS: Record<ObjectType, MessageKey> = {
  dataset: 'pageDatasets',
  esignSubmission: 'pageEsign',
  esignTemplate: 'pageEsign',
  form: 'pageForms',
  packetTemplate: 'pagePackets',
  submission: 'pageSubmissions',
};

const TARGET_LABELS: Record<SearchTargetType, MessageKey> = {
  datasets: 'targetDatasets',
  forms: 'targetForms',
};

/** What each search target lists, for counts and sentences. */
const TARGET_OBJECT_TYPES: Record<SearchTargetType, ObjectType> = {
  datasets: 'dataset',
  forms: 'form',
};

const FIELD_LABELS: Record<FormVersionField, MessageKey> = {
  attributes: 'fieldAttributes',
  datasets: 'fieldDatasets',
  integrations: 'fieldIntegrations',
  layout: 'fieldLayout',
  notifications: 'fieldNotifications',
  steps: 'fieldSteps',
  tagExpressions: 'fieldTagExpressions',
  translations: 'fieldTranslations',
  workflow: 'fieldWorkflow',
};

const CHANGE_LABELS: Record<ChangeKind, MessageKey> = {
  added: 'changeAdded',
  changed: 'changeChanged',
  moved: 'changeMoved',
  removed: 'changeRemoved',
};

const noun = (type: ObjectType, count: number) => t(OBJECT_TYPE_NOUNS[type][count === 1 ? 'one' : 'other']);

/** "1 form", "3 forms". */
const countOf = (type: ObjectType, count: number) => t('countNoun', [count, noun(type, count)]);

/** "forms, datasets, and eSign templates" / "eSign templates or packet templates", in the extension's UI language. */
const listOf = (items: string[], type: 'conjunction' | 'disjunction') =>
  new Intl.ListFormat(browser.i18n.getUILanguage(), { style: 'long', type }).format(items);

export {
  CHANGE_LABELS,
  countOf,
  FIELD_LABELS,
  listOf,
  noun,
  OBJECT_PAGE_LABELS,
  OBJECT_TYPE_LABELS,
  OBJECT_TYPE_NOUNS,
  TARGET_LABELS,
  TARGET_OBJECT_TYPES,
};
