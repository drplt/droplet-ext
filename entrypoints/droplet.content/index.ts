import type { ContentMessage, JobEvent, JobFailure, JobRequest } from '@/lib/messages';

import { ApiError, createApiClient } from '@/lib/api';
import { getDropletEnv } from '@/lib/env';
import { findObjById } from '@/lib/lookup/objById';
import { runSearch } from '@/lib/search/run';
import { getOrganizationId } from '@/lib/session';
import { SEARCH_TARGETS } from '@/lib/targets';

import { revealOnPage } from './reveal';
import './style.css';

// Firefox runs content-script fetch() with the extension's principal; `content.fetch` issues the request as the
// page itself, which is what the API's CORS + SameSite cookie rules expect. Chrome's fetch already behaves so.
const pageFetch: typeof fetch = (input, init) => {
  const contentFetch = (globalThis as { content?: { fetch?: typeof fetch } }).content?.fetch;
  return contentFetch ? contentFetch(input, init) : fetch(input, init);
};

const toFailure = (error: unknown): JobFailure => {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return { kind: 'unauthorized', message: error.message };
    if (error.kind === 'forbidden') return { kind: 'forbidden', message: error.message };
    if (error.kind === 'network') return { kind: 'network', message: error.message };
    return { kind: 'other', message: error.message };
  }
  return { kind: 'other', message: error instanceof Error ? error.message : String(error) };
};

export default defineContentScript({
  matches: ['https://app.droplet.io/*'],
  main(ctx) {
    const env = getDropletEnv(window.location.href);
    if (!env) return;

    const api = createApiClient({ apiOrigin: env.apiOrigin, fetch: pageFetch, getOrganizationId });
    const running = new Map<string, AbortController>();

    const emit = (event: JobEvent) => {
      browser.runtime.sendMessage(event).catch(() => {
        // The background may be restarting; the panel re-syncs from stored state.
      });
    };

    const runJob = async (jobId: string, request: JobRequest) => {
      const controller = new AbortController();
      running.set(jobId, controller);
      const { signal } = controller;
      try {
        if (request.kind === 'findById') {
          emit({ type: 'job:lookup', jobId, lookup: await findObjById(api, request.id, signal) });
        } else {
          await runSearch({
            api,
            signal,
            query: request.query,
            options: request.options,
            target: SEARCH_TARGETS[request.target],
            callbacks: {
              onHit: hit => {
                emit({ type: 'job:hit', jobId, hit });
              },
              onItemError: error => {
                emit({ type: 'job:itemError', jobId, error });
              },
              onProgress: progress => {
                emit({ type: 'job:progress', jobId, progress });
              },
              onSkip: item => {
                emit({ type: 'job:skipped', jobId, item });
              },
            },
          });
        }
        emit({ type: 'job:finished', jobId, status: 'done' });
      } catch (error) {
        if (signal.aborted && !(error instanceof ApiError && error.kind === 'unauthorized')) {
          emit({ type: 'job:finished', jobId, status: 'cancelled' });
        } else {
          emit({ type: 'job:failed', jobId, error: toFailure(error) });
        }
      } finally {
        running.delete(jobId);
      }
    };

    const handle = (message: ContentMessage) => {
      switch (message.type) {
        case 'job:start':
          void runJob(message.jobId, message.request);
          return { accepted: true };
        case 'job:cancel':
          running.get(message.jobId)?.abort();
          return { accepted: true };
        case 'job:ping':
          return { running: running.has(message.jobId) };
        case 'page:reveal':
          return { found: revealOnPage(message.objectType, message.id) };
      }
    };

    // Every reply is synchronous, so answer via sendResponse (portable across Chrome and Firefox).
    const onMessage = (message: ContentMessage, _sender: unknown, sendResponse: (response: unknown) => void) => {
      sendResponse(handle(message));
    };

    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(onMessage);
      for (const controller of running.values()) controller.abort();
    });
  },
});
