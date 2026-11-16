import type { JobState } from '@/lib/messages';

import { t } from '@/lib/i18n';

import { countOf, TARGET_OBJECT_TYPES } from '../labels';
import { lookingUpText } from '../summaries';

type Props = {
  job: JobState;
  onCancel: () => void;
};

const statusLabel = (job: JobState) => {
  const { progress, request } = job;
  switch (request.kind) {
    case 'compareVersions':
      return t('comparing');
    case 'findById':
      return lookingUpText(request.id);
    case 'findText': {
      const type = TARGET_OBJECT_TYPES[request.target];
      return progress
        ? t('progress', [progress.done, countOf(type, progress.total)])
        : t(type === 'dataset' ? 'preparingDatasets' : 'preparingForms');
    }
  }
};

/**
 * Progress for a running job, with a Stop button. Not a live region: the panel announces start and finish once
 * (see useAnnouncement), so screen readers don't hear every progress tick.
 */
const JobStatus = ({ job, onCancel }: Props) => {
  if (job.status !== 'running') return null;
  const { progress } = job;
  const label = statusLabel(job);

  return (
    <div className="status">
      <div className="status__row">
        <span>{label}</span>
        <button type="button" className="button button--text" onClick={onCancel}>
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
