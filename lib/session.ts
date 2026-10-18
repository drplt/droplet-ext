// Reads the Droplet app's current organization from its own localStorage (drplt/src/lib/settings, namespace
// "drplt", key "organization"). Only used to renew an expired access token for the same organization.

const ORGANIZATION_KEY = 'drplt.organization';

const getOrganizationId = (storage: Pick<Storage, 'getItem'> = window.localStorage): null | string => {
  let raw: null | string;
  try {
    raw = storage.getItem(ORGANIZATION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'string') return parsed.id;
  } catch {
    return null;
  }
  return null;
};

export { getOrganizationId };
