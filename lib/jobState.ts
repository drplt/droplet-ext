// Pure state transitions for a tab's current job, shared by the background (source of truth) and tests.
import type { JobEvent, JobRequest, JobState } from './messages';

const createJob = (jobId: string, request: JobRequest, now: number): JobState => ({
  jobId,
  request,
  status: 'running',
  startedAt: now,
  finishedAt: null,
  progress: null,
  hits: [],
  itemErrors: [],
  skipped: [],
  lookup: null,
  error: null,
});

const applyJobEvent = (job: JobState | null, event: JobEvent, now: number): JobState | null => {
  // Ignore stragglers from an older job (e.g. a cancelled run still flushing).
  if (job?.jobId !== event.jobId) return job;

  switch (event.type) {
    case 'job:progress':
      return { ...job, progress: event.progress };
    case 'job:hit':
      return { ...job, hits: [...job.hits, event.hit] };
    case 'job:skipped':
      return { ...job, skipped: [...job.skipped, event.item] };
    case 'job:itemError':
      return { ...job, itemErrors: [...job.itemErrors, event.error] };
    case 'job:lookup':
      return { ...job, lookup: event.lookup };
    case 'job:failed':
      return job.status === 'running' ? { ...job, status: 'error', error: event.error, finishedAt: now } : job;
    case 'job:finished':
      return job.status === 'running' ? { ...job, status: event.status, finishedAt: now } : job;
  }
};

/** Marks a running job as interrupted, e.g. when its tab reloads and takes the content script with it. */
const interruptJob = (job: JobState | null, message: string, now: number): JobState | null =>
  job?.status === 'running' ? { ...job, status: 'error', error: { kind: 'other', message }, finishedAt: now } : job;

export { applyJobEvent, createJob, interruptJob };
