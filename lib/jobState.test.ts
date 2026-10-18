import type { JobRequest } from './messages';

import { applyJobEvent, createJob, interruptJob } from './jobState';

const request: JobRequest = { kind: 'findText', target: 'forms', query: 'x', options: { includeDrafts: false } };
const hit = { id: 'f1', name: 'Form', objectType: 'form' as const, matchCount: 1, matches: [] };

describe('job state', () => {
  it('accumulates progress and hits, then finishes', () => {
    let job = createJob('j1', request, 1);
    job = applyJobEvent(job, { type: 'job:progress', jobId: 'j1', progress: { done: 1, total: 2 } }, 2)!;
    job = applyJobEvent(job, { type: 'job:hit', jobId: 'j1', hit }, 3)!;
    job = applyJobEvent(job, { type: 'job:finished', jobId: 'j1', status: 'done' }, 4)!;
    expect(job).toMatchObject({ status: 'done', finishedAt: 4, hits: [hit], progress: { done: 1, total: 2 } });
  });

  it('collects skipped items', () => {
    const job = applyJobEvent(
      createJob('j1', request, 1),
      { type: 'job:skipped', jobId: 'j1', item: { id: 'f2', name: 'Draft only' } },
      2,
    );
    expect(job?.skipped).toEqual([{ id: 'f2', name: 'Draft only' }]);
  });

  it('ignores events from a different job', () => {
    const job = createJob('j2', request, 1);
    expect(applyJobEvent(job, { type: 'job:hit', jobId: 'j1', hit }, 2)).toBe(job);
    expect(applyJobEvent(null, { type: 'job:hit', jobId: 'j1', hit }, 2)).toBeNull();
  });

  it('does not let a late failure overwrite a finished job', () => {
    const done = applyJobEvent(
      createJob('j1', request, 1),
      { type: 'job:finished', jobId: 'j1', status: 'cancelled' },
      2,
    );
    const after = applyJobEvent(done, { type: 'job:failed', jobId: 'j1', error: { kind: 'other', message: 'x' } }, 3);
    expect(after?.status).toBe('cancelled');
  });

  it('interrupts only running jobs', () => {
    const running = createJob('j1', request, 1);
    expect(interruptJob(running, 'reloaded', 5)).toMatchObject({ status: 'error', error: { message: 'reloaded' } });
    const done = { ...running, status: 'done' as const };
    expect(interruptJob(done, 'reloaded', 5)).toBe(done);
  });
});
