import type { MockInstance } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { FormVersionsReply, JobState } from '@/lib/messages';

import { CompareVersions } from './CompareVersions';

const tabAt = (url: string) => ({ id: 7, url, windowId: 1 });

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

describe('CompareVersions', () => {
  it('loads the versions of the form on the current page and defaults to published → newest', async () => {
    const sendMessage = replyWith(versionsReply);
    const { onStart } = renderCompare('https://app.droplet.io/forms/formA/edit');

    expect(await screen.findByText('Evaluation')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'form:versions', formId: 'formA' });
    expect(screen.getByLabelText(/Form ID/)).toHaveValue('formA');
    expect(screen.getByLabelText('Old version')).toHaveValue('v-2');
    expect(screen.getByLabelText('New version')).toHaveValue('v-3');

    await userEvent.selectOptions(screen.getByLabelText('Old version'), 'v-1');
    await userEvent.click(screen.getByRole('button', { name: 'Compare versions' }));
    expect(onStart).toHaveBeenCalledWith({ kind: 'compareVersions', formId: 'formA', from: 'v-1', to: 'v-3' });
  });

  it('will not compare a version with itself', async () => {
    replyWith(versionsReply);
    renderCompare('https://app.droplet.io/forms/formA/edit');
    await userEvent.selectOptions(await screen.findByLabelText('Old version'), 'v-3');
    expect(screen.getByRole('button', { name: 'Compare versions' })).toBeDisabled();
    expect(screen.getByText('Choose two different versions.')).toBeInTheDocument();
  });

  it('takes a pasted form ID when not on a form page, and shows why loading failed', async () => {
    const sendMessage = replyWith({ ok: false, error: { kind: 'forbidden', message: 'Access Denied' } });
    renderCompare('https://app.droplet.io/datasets');
    expect(sendMessage).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Form ID/), ' formB {enter}');
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'form:versions', formId: 'formB' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/role doesn't allow this/);
  });

  it('asks for a reload when the tab has no content script', async () => {
    sendMessageSpy().mockRejectedValue(new Error('no receiver'));
    renderCompare('https://app.droplet.io/forms/formA/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Reload this Droplet tab, then try again.');
  });

  it('lists the changes by section and opens the report window', async () => {
    replyWith(versionsReply);
    renderCompare('https://app.droplet.io/forms/formA/edit', doneJob);

    expect(screen.getByText(/v-1 → v-3 · 2 changes/)).toBeInTheDocument();
    expect(screen.getByText('Form › Input #name › label')).toBeInTheDocument();
    expect(screen.getByText('"Full name"')).toBeInTheDocument();
    expect(screen.getByText('No changes in: Workflow')).toBeInTheDocument();
    // The selection is restored from the job rather than reset to the defaults.
    expect(await screen.findByLabelText('Old version')).toHaveValue('v-1');

    const create = vi.spyOn(fakeBrowser.windows, 'create');
    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'popup', url: expect.stringMatching(/report\.html\?tab=7$/) }),
    );
  });

  it('clears the comparison, keeping the chosen form and versions', async () => {
    replyWith(versionsReply);
    const { onClear, rerender, onStart, onCancel } = renderCompare('https://app.droplet.io/forms/formA/edit', doneJob);
    await userEvent.click(screen.getByRole('button', { name: 'Clear results' }));
    expect(onClear).toHaveBeenCalledOnce();

    // The background drops the job, and the panel re-renders without it.
    const tab = tabAt('https://app.droplet.io/forms/formA/edit');
    rerender(<CompareVersions tab={tab} job={null} onStart={onStart} onCancel={onCancel} onClear={onClear} />);
    expect(screen.queryByText('Form › Input #name › label')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open report' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Old version')).toHaveValue('v-1');
  });
});
