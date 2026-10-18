import type { JobFailure } from '@/lib/messages';

import { t } from '@/lib/i18n';

const MESSAGE_KEYS = {
  forbidden: 'errorForbidden',
  network: 'errorNetwork',
  unauthorized: 'errorUnauthorized',
} as const;

const JobError = ({ error }: { error: JobFailure }) => (
  <p className="notice notice--error" role="alert">
    {error.kind === 'other' ? error.message : t(MESSAGE_KEYS[error.kind])}
  </p>
);

export { JobError };
