import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { JobState } from '@/lib/messages';

import { FindText } from './FindText';

const tabAt = (url: string) => ({ id: 7, url, windowId: 1 });

const doneJob: JobState = {
  jobId: 'j1',
  request: { kind: 'findText', target: 'forms', query: 'patient', options: { includeDrafts: false } },
  status: 'done',
  startedAt: 1,
  finishedAt: 2,
  progress: { done: 3, total: 3 },
  hits: [
    {
      id: 'formA',
      name: 'Patient Intake',
      objectType: 'form',
      matchCount: 4,
      matches: [
        {
          location: 'Layout',
          version: { kind: 'published', version: 'v2' },
          snippet: { before: '<TextInput label="', match: 'Patient', after: ' name" />' },
        },
        {
          location: 'Workflow',
          version: { kind: 'draft', version: 'draft-9' },
          snippet: { before: '', match: 'patient', after: ' review' },
        },
      ],
    },
  ],
  itemErrors: [{ id: 'formC', name: 'Locked Down', kind: 'forbidden', message: 'Access Denied' }],
  skipped: [{ id: 'formB', name: 'Field Trip' }],
  lookup: null,
  error: null,
};

const renderFindText = (url: string, job: JobState | null = null) => {
  const props = { onStart: vi.fn(), onCancel: vi.fn(), onClear: vi.fn() };
  const view = render(<FindText tab={tabAt(url)} job={job} {...props} />);
  return { ...props, ...view };
};

describe('FindText', () => {
  it('defaults the object type from the current page', () => {
    renderFindText('https://app.droplet.io/datasets');
    expect(screen.getByLabelText(/Search in/)).toHaveValue('datasets');
    expect(screen.getByText(/from current page/)).toBeInTheDocument();
  });

  it('lets the user override the type until they move to a different kind of page', async () => {
    const { rerender, onStart, onCancel, onClear } = renderFindText('https://app.droplet.io/forms');
    await userEvent.selectOptions(screen.getByLabelText(/Search in/), 'datasets');
    expect(screen.getByLabelText(/Search in/)).toHaveValue('datasets');

    const props = { job: null, onStart, onCancel, onClear };
    rerender(<FindText tab={tabAt('https://app.droplet.io/forms/abc/edit')} {...props} />);
    expect(screen.getByLabelText(/Search in/)).toHaveValue('datasets');

    rerender(<FindText tab={tabAt('https://app.droplet.io/datasets')} {...props} />);
    rerender(<FindText tab={tabAt('https://app.droplet.io/forms')} {...props} />);
    expect(screen.getByLabelText(/Search in/)).toHaveValue('forms');
  });

  it('starts a search with the trimmed query and options', async () => {
    const { onStart } = renderFindText('https://app.droplet.io/forms');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Text to find'), '  patient  ');
    await userEvent.click(screen.getByLabelText(/Include unpublished drafts/));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onStart).toHaveBeenCalledWith({
      kind: 'findText',
      target: 'forms',
      query: 'patient',
      options: { includeDrafts: true },
    });
  });

  it('renders hits with highlighted snippets, counts and per-item errors', () => {
    renderFindText('https://app.droplet.io/forms', doneJob);
    // formB was skipped (never published), so only 2 of the 3 forms were actually searched.
    expect(screen.getByText('Found in 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Published')).toHaveAttribute('title', 'Version v2');
    expect(screen.getByText('Draft')).toHaveAttribute('title', 'Version draft-9');
    expect(screen.getByText(/1 never published, so not searched/)).toBeInTheDocument();
    expect(screen.getByText('Patient Intake')).toBeInTheDocument();
    expect(screen.getByText('Patient', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('+ 2 more')).toBeInTheDocument();
    expect(screen.getByText('1 could not be searched')).toBeInTheDocument();
    expect(screen.getByLabelText(/Text to find/)).toHaveValue('patient');
  });

  it('opens a result in a new tab on the same Droplet environment', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    renderFindText('https://demo1.app.droplet.io/forms', doneJob);
    await userEvent.click(screen.getByRole('button', { name: 'Open in new tab: Patient Intake' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://demo1.app.droplet.io/forms/formA/edit', active: true }),
    );
  });

  it('shows the cancel control while running', async () => {
    const running: JobState = { ...doneJob, status: 'running', finishedAt: null, progress: { done: 1, total: 3 } };
    const { onCancel } = renderFindText('https://app.droplet.io/forms', running);
    expect(screen.getByRole('status')).toHaveTextContent('Searched 1 of 3');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
