import type { MockInstance } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { FormVersionsReply, JobState } from '@/lib/messages';

import { AnnounceContext } from '../hooks/useAnnouncement';
import { CompareVersions } from './CompareVersions';

const tabAt = (url: string, loadedAt = 1) => ({ id: 7, url, windowId: 1, loadedAt });

const versionsReply: FormVersionsReply = {
  ok: true,
  form: {
    id: 'formA',
    name: 'Evaluation',
    versions: [
      { version: 'v-3', locked: false, modified: '2026-03-01T00:00:00Z', published: false },
      { version: 'v-2', locked: true, modified: '2026-02-01T00:00:00Z', published: true },
      { version: 'v-1', locked: true, modified: '2026-01-01T00:00:00Z', published: false },
    ],
  },
};

// fake-browser types sendMessage by its callback overload; the panel uses the promise form.
const sendMessageSpy = () =>
  vi.spyOn(fakeBrowser.tabs, 'sendMessage') as unknown as MockInstance<(...args: unknown[]) => Promise<unknown>>;

/** Spies on a fake-browser method by its promise form, which its types leave out. */
const promiseSpy = <T extends object>(target: T, method: keyof T & string) =>
  vi.spyOn(target as Record<string, () => unknown>, method) as unknown as MockInstance<
    (...args: unknown[]) => Promise<unknown>
  >;

const replyWith = (reply: unknown) => sendMessageSpy().mockResolvedValue(reply);

const doneJob: JobState = {
  jobId: 'j1',
  request: { kind: 'compareVersions', formId: 'formA', from: 'v-1', to: 'v-3' },
  status: 'done',
  startedAt: 1,
  finishedAt: 2,
  progress: null,
  hits: [],
  itemErrors: [],
  skipped: [],
  lookup: null,
  error: null,
  comparison: {
    form: { id: 'formA', name: 'Evaluation' },
    from: { version: 'v-1', locked: true, modified: null, published: false },
    to: { version: 'v-3', locked: false, modified: null, published: false },
    fields: [
      {
        field: 'layout',
        mode: 'structure',
        changes: [
          { kind: 'changed', path: ['Form', 'Input #name', 'label'], before: '"Name"', after: '"Full name"' },
          { kind: 'added', path: ['Form', 'Signature #sig'], after: '<Signature id="sig">' },
        ],
      },
      { field: 'workflow', mode: 'structure', changes: [] },
    ],
  },
};

const renderCompare = (url: string, job: JobState | null = null) => {
  const props = { onStart: vi.fn(), onCancel: vi.fn(), onClear: vi.fn() };
  return { ...props, ...render(<CompareVersions tab={tabAt(url)} job={job} {...props} />) };
};

const FORM_PAGE = 'https://app.droplet.io/forms/formA/edit';

describe('CompareVersions', () => {
  it('loads the versions of the form on the current page and defaults to published → newest', async () => {
    const sendMessage = replyWith(versionsReply);
    const { onStart } = renderCompare(FORM_PAGE);

    expect(await screen.findByRole('group', { name: /Evaluation/ })).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'form:versions', formId: 'formA' });
    expect(screen.getByLabelText(/Form ID/)).toHaveValue('formA');
    // Loading the form that's already loaded would do nothing, so the button steps aside.
    expect(screen.queryByRole('button', { name: 'Load versions' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Old version')).toHaveValue('v-2');
    expect(screen.getByLabelText('New version')).toHaveValue('v-3');

    await userEvent.selectOptions(screen.getByLabelText('Old version'), 'v-1');
    await userEvent.click(screen.getByRole('button', { name: 'Compare versions' }));
    expect(onStart).toHaveBeenCalledWith({ kind: 'compareVersions', formId: 'formA', from: 'v-1', to: 'v-3' });
  });

  it('will not compare a version with itself', async () => {
    replyWith(versionsReply);
    renderCompare(FORM_PAGE);
    await userEvent.selectOptions(await screen.findByLabelText('Old version'), 'v-3');
    expect(screen.getByRole('button', { name: 'Compare versions' })).toBeDisabled();
    expect(screen.getByLabelText('Old version')).toHaveAccessibleDescription('Choose two different versions.');
  });

  it('warns when the old version is newer, and swaps them', async () => {
    replyWith(versionsReply);
    renderCompare(FORM_PAGE);
    await userEvent.selectOptions(await screen.findByLabelText('New version'), 'v-1');
    expect(screen.getByLabelText('New version')).toHaveAccessibleDescription(
      'The old version is newer, so changes will show reversed.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Swap' }));
    expect(screen.getByLabelText('Old version')).toHaveValue('v-1');
    expect(screen.getByLabelText('New version')).toHaveValue('v-2');
    expect(screen.queryByRole('button', { name: 'Swap' })).not.toBeInTheDocument();
  });

  it('takes a pasted form ID when not on a form page, and shows why loading failed', async () => {
    const sendMessage = replyWith({ ok: false, error: { kind: 'forbidden', message: 'Access Denied' } });
    renderCompare('https://app.droplet.io/datasets');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Form ID/)).toHaveAccessibleDescription('Open a form in Droplet, or paste a form ID.');
    expect(screen.getByRole('button', { name: 'Load versions' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Form ID/), ' formB {enter}');
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'form:versions', formId: 'formB' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/role/);
    // A failed load can be retried.
    expect(screen.getByRole('button', { name: 'Load versions' })).toBeEnabled();
  });

  it('asks for a reload when the tab has no content script', async () => {
    sendMessageSpy().mockRejectedValue(new Error('no receiver'));
    renderCompare(FORM_PAGE);
    expect(await screen.findByRole('alert')).toHaveTextContent(/reload/i);
  });

  it('lists the changes by section, labelling before and after in words', async () => {
    replyWith(versionsReply);
    renderCompare(FORM_PAGE, doneJob);

    expect(screen.getByRole('heading', { name: 'v-1 → v-3 · 2 changes' })).toBeInTheDocument();
    const [labelChange] = screen.getAllByRole('listitem');
    expect(labelChange).toHaveTextContent('Changed Form › Input #name › label Before "Name" After "Full name"');
    expect(screen.getByText('"Full name"').tagName).toBe('INS');
    expect(screen.getByText('No changes in Workflow.')).toBeInTheDocument();
    // The selection is restored from the job rather than reset to the defaults.
    expect(await screen.findByLabelText('Old version')).toHaveValue('v-1');
    expect(screen.queryByText(/Showing the previous comparison/)).not.toBeInTheDocument();

    const create = vi.spyOn(fakeBrowser.windows, 'create');
    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'popup', url: expect.stringMatching(/report\.html\?tab=7$/) }),
    );
  });

  it('says when the results no longer match the chosen versions', async () => {
    replyWith(versionsReply);
    renderCompare(FORM_PAGE, doneJob);
    await userEvent.selectOptions(await screen.findByLabelText('Old version'), 'v-2');
    expect(screen.getByText('Showing the previous comparison. Compare again to see v-2 → v-3.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Old version'), 'v-1');
    expect(screen.queryByText(/Showing the previous comparison/)).not.toBeInTheDocument();
  });

  it('says plainly when nothing changed', () => {
    replyWith(versionsReply);
    const comparison = doneJob.comparison!;
    const fields = comparison.fields.map(field => ({ ...field, changes: [] }));
    renderCompare(FORM_PAGE, { ...doneJob, comparison: { ...comparison, fields } });
    expect(screen.getByRole('heading', { name: 'v-1 → v-3' })).toBeInTheDocument();
    expect(screen.getByText('No changes')).toBeInTheDocument();
    expect(screen.queryByText(/No changes in/)).not.toBeInTheDocument();
  });

  it('clears the comparison, keeping the chosen form and versions', async () => {
    replyWith(versionsReply);
    const { onClear, rerender, onStart, onCancel } = renderCompare(FORM_PAGE, doneJob);
    await userEvent.click(screen.getByRole('button', { name: 'Clear results' }));
    expect(onClear).toHaveBeenCalledOnce();

    // The background drops the job, and the panel re-renders without it.
    rerender(
      <CompareVersions tab={tabAt(FORM_PAGE)} job={null} onStart={onStart} onCancel={onCancel} onClear={onClear} />,
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open report' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Old version')).toHaveValue('v-1');
  });
  it('refreshes the version list on request, keeping the chosen versions', async () => {
    const sendMessage = replyWith(versionsReply);
    renderCompare(FORM_PAGE);
    await userEvent.selectOptions(await screen.findByLabelText('Old version'), 'v-1');
    const newer = {
      ...versionsReply.form,
      versions: [{ ...versionsReply.form.versions[0]!, version: 'v-4' }, ...versionsReply.form.versions],
    };
    sendMessage.mockResolvedValue({ ok: true, form: newer });

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Updated just now')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Old version')).toHaveValue('v-1');
    expect(screen.getAllByRole('option', { name: /^v-4/ })).toHaveLength(2);
  });

  it('retries a failed load once the tab has reloaded', async () => {
    const sendMessage = sendMessageSpy().mockRejectedValue(new Error('no receiver'));
    const { rerender, onStart, onCancel, onClear } = renderCompare(FORM_PAGE);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    sendMessage.mockResolvedValue(versionsReply);
    rerender(
      <CompareVersions tab={tabAt(FORM_PAGE, 2)} job={null} onStart={onStart} onCancel={onCancel} onClear={onClear} />,
    );
    expect(await screen.findByLabelText('Old version')).toHaveValue('v-2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('makes Compare versions the quieter action while the results are current', async () => {
    replyWith(versionsReply);
    renderCompare(FORM_PAGE, doneJob);
    await screen.findByLabelText('Old version');
    expect(screen.getByRole('button', { name: 'Compare versions' })).toHaveClass('button--secondary');
    await userEvent.selectOptions(screen.getByLabelText('Old version'), 'v-2');
    expect(screen.getByRole('button', { name: 'Compare versions' })).not.toHaveClass('button--secondary');
  });

  it('brings an open report window forward instead of opening another', async () => {
    replyWith(versionsReply);
    // Report windows are remembered per tab for the panel's lifetime, so use a job no other test opened.
    renderCompare(FORM_PAGE, { ...doneJob, jobId: 'report-window-job' });
    const create = promiseSpy(fakeBrowser.windows, 'create').mockResolvedValue({ id: 42 });
    const update = promiseSpy(fakeBrowser.windows, 'update').mockResolvedValue({});

    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));
    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(42, { focused: true });

    // Closed in the meantime: open a fresh one.
    update.mockRejectedValueOnce(new Error('No window with id: 42.'));
    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("says when comparing would replace another tool's results", async () => {
    replyWith(versionsReply);
    const textJob: JobState = {
      ...doneJob,
      comparison: null,
      request: { kind: 'findText', query: 'name', target: 'forms', options: { includeDrafts: false } },
    };
    renderCompare(FORM_PAGE, textJob);
    await screen.findByLabelText('Old version');
    expect(screen.getByText(/replaces your Find text results/)).toBeInTheDocument();
  });
  it('announces what a refresh did, and leaves the reset to the stale notice when results show', async () => {
    const sendMessage = replyWith(versionsReply);
    const onAnnounce = vi.fn();
    render(
      <AnnounceContext value={onAnnounce}>
        <CompareVersions tab={tabAt(FORM_PAGE)} job={doneJob} onStart={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} />
      </AnnounceContext>,
    );
    await screen.findByLabelText('Old version');

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => {
      expect(onAnnounce).toHaveBeenLastCalledWith('Version list updated.');
    });

    // v-1 (the compared old version) is gone, so the picks reset.
    const shorter = { ...versionsReply.form, versions: versionsReply.form.versions.slice(0, 2) };
    sendMessage.mockResolvedValue({ ok: true, form: shorter });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => {
      expect(onAnnounce).toHaveBeenLastCalledWith(
        'The version list changed, so your choices were reset to published → newest.',
      );
    });
    expect(screen.queryByText(/your choices were reset/)).not.toBeInTheDocument();
    expect(screen.getByText('Showing the previous comparison. Compare again to see v-2 → v-3.')).toBeInTheDocument();

    sendMessage.mockResolvedValue({ ok: false, error: { kind: 'network', message: 'offline' } });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => {
      expect(onAnnounce).toHaveBeenLastCalledWith('Couldn’t refresh the version list.');
    });
    expect(screen.getByText('Couldn’t refresh the version list, so it may be out of date.')).toBeInTheDocument();
  });
});
