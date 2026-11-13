// Object type → Droplet web-app path. Paths come from drplt/src/ui/app-routes/index.ts.

type ObjectType = 'dataset' | 'esignSubmission' | 'esignTemplate' | 'form' | 'packetTemplate' | 'submission';

type ObjectRef = {
  id: string;
  /** Needed for submissions, whose app route is nested under their form. */
  formId?: null | string;
  type: ObjectType;
};

const enc = encodeURIComponent;

const getObjectPath = ({ formId, id, type }: ObjectRef): null | string => {
  switch (type) {
    case 'dataset':
      return `/datasets/${enc(id)}/edit`;
    case 'esignSubmission':
      return `/esign-submissions/${enc(id)}`;
    case 'esignTemplate':
      return `/esign/${enc(id)}/edit`;
    case 'form':
      return `/forms/${enc(id)}/edit`;
    case 'packetTemplate':
      return `/packets/templates/${enc(id)}/edit`;
    case 'submission':
      return formId ? `/form/${enc(formId)}/submission/${enc(id)}` : null;
  }
};

// App sections (path prefixes) where each object type lives. "Show" only works while the user is in the matching
// section — e.g. a dataset can't be highlighted or navigated to sensibly from the Forms page.
const OBJECT_SECTIONS: Record<ObjectType, readonly string[]> = {
  dataset: ['/datasets'],
  esignSubmission: ['/esign-submissions', '/document-submissions'],
  esignTemplate: ['/esign', '/documents'],
  form: ['/forms', '/form'],
  packetTemplate: ['/packets'],
  submission: ['/submissions', '/form'],
};

const isInSection = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Whether the page at `pageUrl` is in the part of the app where objects of `type` live. */
const isOnObjectPage = (type: ObjectType, pageUrl: string | undefined): boolean => {
  if (!pageUrl) return false;
  let pathname: string;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return false;
  }
  return OBJECT_SECTIONS[type].some(prefix => isInSection(pathname, prefix));
};

const getObjectUrl = (appOrigin: string, ref: ObjectRef): null | string => {
  const path = getObjectPath(ref);
  return path === null ? null : new URL(path, appOrigin).toString();
};

export { getObjectPath, getObjectUrl, isOnObjectPage, type ObjectRef, type ObjectType };
