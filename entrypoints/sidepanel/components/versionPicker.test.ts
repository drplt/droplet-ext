import type { FormVersions } from '@/lib/compare/types';
import type { FormVersionsReply } from '@/lib/messages';

import type { PickerEvent, PickerState } from './versionPicker';

import { AUTO_REFRESH_MS, initialPickerState, pickerReducer, resolveSelection } from './versionPicker';

const version = (name: string, published = false) => ({ version: name, locked: false, modified: null, published });
const form = (...versions: ReturnType<typeof version>[]): FormVersions => ({
  id: 'formA',
  name: 'Evaluation',
  versions,
});
const ok = (versions: FormVersions): FormVersionsReply => ({ ok: true, form: versions });
const failed: FormVersionsReply = { ok: false, error: { kind: 'network', message: 'offline' } };

const run = (state: PickerState, ...events: PickerEvent[]) => events.reduce(pickerReducer, state);
/** Answers whatever request is in flight. */
const answer = (state: PickerState, reply: FormVersionsReply, at = 10_000): PickerState =>
  pickerReducer(state, { type: 'received', seq: state.fetch?.seq ?? -1, reply, at });

const v3 = form(version('v3'), version('v2', true), version('v1'));
const loaded = answer(initialPickerState('formA'), ok(v3));

describe('version picker', () => {
  it('loads the form, then defaults to published → newest', () => {
    expect(initialPickerState('formA')).toMatchObject({ fetch: { formId: 'formA' }, versions: { status: 'loading' } });
    expect(loaded.versions).toMatchObject({ status: 'loaded', refresh: { status: 'idle' } });
    expect(loaded.fetch).toBeNull();
    expect(resolveSelection(v3.versions, loaded.choice)).toEqual({ from: 'v2', to: 'v3' });
  });

  it('keeps the chosen pair through a refresh when both versions still exist', () => {
    const chosen = run(loaded, { type: 'choose', choice: { from: 'v1', to: 'v2' } });
    const refreshing = run(chosen, { type: 'refresh', manual: true, at: 10_001 });
    expect(refreshing.versions).toMatchObject({ status: 'loaded', refresh: { status: 'running', manual: true } });

    const v4 = form(version('v4'), version('v3', true), version('v2'), version('v1'));
    const after = answer(refreshing, ok(v4));
    expect(after.choice).toEqual({ from: 'v1', to: 'v2' });
    expect(after.reset).toBe(false);
    expect(after.versions).toMatchObject({ form: v4, refresh: { status: 'updated' } });
    expect(run(after, { type: 'settled' }).versions).toMatchObject({ refresh: { status: 'idle' } });
  });

  it('falls back to the defaults, and says so, when a refresh moves them', () => {
    const v4 = form(version('v4'), version('v3', true), version('v2'), version('v1'));
    const after = answer(run(loaded, { type: 'refresh', manual: false, at: 99_999 }), ok(v4));
    expect(after.reset).toBe(true);
    expect(resolveSelection(v4.versions, after.choice)).toEqual({ from: 'v3', to: 'v4' });
    // A quiet refresh doesn't announce itself.
    expect(after.versions).toMatchObject({ refresh: { status: 'idle' } });
    expect(run(after, { type: 'choose', choice: { from: 'v1', to: 'v4' } }).reset).toBe(false);
  });

  it('drops a chosen version that no longer exists', () => {
    const chosen = run(loaded, { type: 'choose', choice: { from: 'v1', to: 'v3' } });
    const after = answer(run(chosen, { type: 'refresh', manual: true, at: 1 }), ok(form(version('v3'), version('v2'))));
    expect(after.choice).toEqual({});
    expect(after.reset).toBe(true);
  });

  it('keeps the list when a refresh fails', () => {
    const after = answer(run(loaded, { type: 'refresh', manual: true, at: 1 }), failed);
    expect(after.versions).toMatchObject({ status: 'loaded', form: v3, refresh: { status: 'failed' } });
  });

  it('spaces out refreshes the user did not ask for', () => {
    expect(run(loaded, { type: 'refresh', manual: false, at: 10_000 + AUTO_REFRESH_MS - 1 }).fetch).toBeNull();
    expect(run(loaded, { type: 'refresh', manual: false, at: 10_000 + AUTO_REFRESH_MS }).fetch).not.toBeNull();
    expect(run(loaded, { type: 'refresh', manual: true, at: 10_000 }).fetch).not.toBeNull();
  });

  it('retries a failed load, and refreshes a loaded list, when the tab finishes loading', () => {
    const broken = answer(initialPickerState('formA'), failed);
    expect(broken.versions.status).toBe('failed');
    expect(run(broken, { type: 'tabLoaded' })).toMatchObject({ versions: { status: 'loading', formId: 'formA' } });
    expect(run(loaded, { type: 'tabLoaded' }).versions).toMatchObject({
      refresh: { status: 'running', manual: false },
    });
  });

  it('numbers every request, so refreshes never reuse an earlier number', () => {
    const once = answer(run(loaded, { type: 'refresh', manual: true, at: 1 }), ok(v3));
    const twice = run(once, { type: 'refresh', manual: true, at: 2 });
    expect(twice.fetch!.seq).toBeGreaterThan(once.news!.id);
  });

  it('ignores a reply to a request that has been replaced', () => {
    const first = initialPickerState('formA');
    const second = run(first, { type: 'load', formId: 'formB' });
    const late = pickerReducer(second, { type: 'received', seq: first.fetch!.seq, reply: ok(v3), at: 1 });
    expect(late).toBe(second);
  });
  it('says what a refresh changed, once per refresh', () => {
    const v4 = form(version('v4'), version('v3', true), version('v2'), version('v1'));
    const updated = answer(run(loaded, { type: 'refresh', manual: true, at: 1 }), ok(v3));
    expect(updated.news?.kind).toBe('updated');

    const reset = answer(run(loaded, { type: 'refresh', manual: false, at: 99_999 }), ok(v4));
    expect(reset.news?.kind).toBe('reset');

    // A quiet refresh that changes nothing says nothing.
    expect(answer(run(loaded, { type: 'refresh', manual: false, at: 99_999 }), ok(v3)).news).toBeNull();
  });

  it('announces a failing quiet refresh once, but every failed manual one', () => {
    const quiet = (state: PickerState, at: number) =>
      answer(run(state, { type: 'refresh', manual: false, at }), failed);
    const first = quiet(loaded, 20_000);
    expect(first.news?.kind).toBe('failed');
    expect(quiet(first, 30_000).news).toBe(first.news);

    const manual = answer(run(first, { type: 'refresh', manual: true, at: 30_000 }), failed);
    expect(manual.news).toMatchObject({ kind: 'failed' });
    expect(manual.news).not.toBe(first.news);
  });
});
