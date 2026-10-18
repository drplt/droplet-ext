import type { JobState } from '@/lib/messages';

import { t } from '@/lib/i18n';

type Props = {
  job: JobState;
  onCancel: () => void;
};

const JobStatus = ({ job, onCancel }: Props) => {
  if (job.status !== 'running') return null;
  const { progress } = job;
  const label =
    job.request.kind === 'findById'
      ? t('lookingUp')
      : progress
        ? t('progress', [progress.done, progress.total])
        : t('preparing');

  return (
    <div className="status" role="status" aria-live="polite">
      <div className="status__row">
        <span>{label}</span>
        <button type="button" className="button button--small button--quiet" onClick={onCancel}>
          {t('cancelButton')}
        </button>
      </div>
      {progress && progress.total > 0 ? (
        <progress className="status__bar" max={progress.total} value={progress.done} aria-label={label} />
      ) : (
        <progress className="status__bar" aria-label={label} />
      )}
    </div>
  );
};

export { JobStatus };
