import type { ChangeKind } from '@/lib/compare/types';
import type { MessageKey } from '@/lib/i18n';
import type { ObjectType } from '@/lib/routes';
import type { FormVersionField } from '@/lib/schemas';
import type { SearchTargetType } from '@/lib/search/types';

const OBJECT_TYPE_LABELS: Record<ObjectType, MessageKey> = {
  account: 'typeAccount',
  client: 'typeClient',
  dataset: 'typeDataset',
  employee: 'typeEmployee',
  esignSubmission: 'typeEsignSubmission',
  esignTemplate: 'typeEsignTemplate',
  form: 'typeForm',
  packet: 'typePacket',
  packetTemplate: 'typePacketTemplate',
  role: 'typeRole',
  submission: 'typeSubmission',
  tag: 'typeTag',
};

/** The app page name used in "switch to the … page" hints. */
const OBJECT_PAGE_LABELS: Record<ObjectType, MessageKey> = {
  account: 'pageAccounts',
  client: 'pageClients',
  dataset: 'pageDatasets',
  employee: 'pageEmployees',
  esignSubmission: 'pageEsign',
  esignTemplate: 'pageEsign',
  form: 'pageForms',
  packet: 'pagePackets',
  packetTemplate: 'pagePackets',
  role: 'pageRoles',
  submission: 'pageSubmissions',
  tag: 'pageTags',
};

const TARGET_LABELS: Record<SearchTargetType, MessageKey> = {
  datasets: 'targetDatasets',
  forms: 'targetForms',
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

export { CHANGE_LABELS, FIELD_LABELS, OBJECT_PAGE_LABELS, OBJECT_TYPE_LABELS, TARGET_LABELS };
