import type { MessageKey } from '@/lib/i18n';
import type { JobState } from '@/lib/messages';

import { t } from '@/lib/i18n';

type Tool = JobState['request']['kind'];

const TOOL_LABELS: Record<Tool, MessageKey> = {
  compareVersions: 'tabCompare',
  findById: 'tabFindById',
  findText: 'tabFindText',
};

type Props = {
  /** Callers decide when it's relevant, e.g. only once there's something to submit. */
  show: boolean;
  job: JobState | null;
  tool: Tool;
};

/**
 * A tab holds one job, so starting this tool replaces another tool's finished results. Shown under the submit row.
 * (Another tool's *running* job is handled by the panel's notice above the tool.)
 */
const ReplacesHint = ({ job, show, tool }: Props) =>
  show && job && job.request.kind !== tool && job.status !== 'running' ? (
    <p className="hint">{t('otherJobReplaces', [t(TOOL_LABELS[job.request.kind])])}</p>
  ) : null;

export { ReplacesHint, TOOL_LABELS };
