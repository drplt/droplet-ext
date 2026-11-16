import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { JobState } from '@/lib/messages';

import { FindText } from './FindText';

const tabAt = (url: string) => ({ id: 7, url, windowId: 1, loadedAt: 0 });

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
  comparison: null,
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
    expect(screen.getByRole('heading', { level: 2, name: '“patient” in Forms' })).toBeInTheDocument();
    // 3 forms: 1 skipped (never published) and 1 unreadable, so the parts add up: 1 searched.
    expect(screen.getByText('Found in 1 of 1 form')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 never published' })).toHaveAttribute('href', '#find-text-skipped');
    expect(screen.getByRole('link', { name: '1 couldn’t be searched' })).toHaveAttribute('href', '#find-text-failed');
    expect(screen.getByText('Layout · Published · v2')).not.toHaveClass('tag');
    expect(screen.getByText('Draft · draft-9')).toHaveClass('tag--draft');
    expect(screen.getByText(/1 form has never been published, so it wasn’t searched/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Patient Intake' })).toBeInTheDocument();
    expect(screen.getByText('4 matches')).toBeInTheDocument();
    expect(screen.getByText('Patient', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('+ 2 more matches')).toBeInTheDocument();
    expect(screen.getByText('1 form couldn’t be searched')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
    // Per-item failures come from reading a version, which needs Build.
    expect(screen.getByText(/Ask an admin for Build access to forms/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Text to find/)).toHaveValue('patient');
  });

  it('keeps the couldn’t-be-searched disclosure in the tab order, and opens it from the summary link', async () => {
    renderFindText('https://app.droplet.io/forms', doneJob);
    const summary = screen.getByText('1 form couldn’t be searched').closest('summary')!;
    expect(summary.closest('details')).not.toHaveAttribute('tabindex');
    await userEvent.click(screen.getByRole('link', { name: '1 couldn’t be searched' }));
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(summary).toHaveFocus();
  });

  it('doesn’t suggest turning on drafts when drafts were already searched', () => {
    const job: JobState = { ...doneJob, request: { ...doneJob.request, options: { includeDrafts: true } } } as JobState;
    renderFindText('https://app.droplet.io/forms', job);
    expect(screen.getByRole('link', { name: '1 with nothing to search' })).toBeInTheDocument();
    expect(screen.getByText('1 form has no published version or draft, so it wasn’t searched.')).toBeInTheDocument();
    expect(screen.queryByText(/Turn on/)).not.toBeInTheDocument();
  });

  it('shows only the error when a run failed before searching anything', () => {
    const job: JobState = {
      ...doneJob,
      status: 'error',
      progress: null,
      hits: [],
      itemErrors: [],
      skipped: [],
      error: { kind: 'network', message: '' },
    };
    renderFindText('https://app.droplet.io/forms', job);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t reach Droplet.');
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear results' })).not.toBeInTheDocument();
  });

  it('marks results as stale once the search no longer matches them', async () => {
    renderFindText('https://app.droplet.io/forms', doneJob);
    expect(screen.queryByText(/Showing results for the previous search/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Text to find'), 's');
    expect(screen.getByText(/Showing results for the previous search/)).toBeInTheDocument();
  });

  it('says what was searched when nothing matches, including that drafts were left out', () => {
    renderFindText('https://app.droplet.io/forms', { ...doneJob, hits: [], itemErrors: [], skipped: [] });
    expect(screen.getByText('Searched 3 forms')).toBeInTheDocument();
    expect(screen.getByText('No forms contain “patient”. Drafts weren’t searched.')).toBeInTheDocument();
  });

  it('never names View or Build when datasets are forbidden', () => {
    const job: JobState = {
      ...doneJob,
      request: { kind: 'findText', target: 'datasets', query: 'lincoln', options: { includeDrafts: false } },
      status: 'error',
      progress: null,
      hits: [],
      itemErrors: [],
      skipped: [],
      error: { kind: 'forbidden', message: 'Access Denied' },
    };
    renderFindText('https://app.droplet.io/datasets', job);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ask an admin for access to datasets.');
    expect(alert).not.toHaveTextContent(/View|Build/);
  });

  it('opens a result in a new tab on the same Droplet environment', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    renderFindText('https://demo1.app.droplet.io/forms', doneJob);
    await userEvent.click(screen.getByRole('button', { name: 'Open in new tab: Patient Intake' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://demo1.app.droplet.io/forms/formA/edit', active: true }),
    );
  });

  it('shows progress and a Stop control while running, keeping results in arrival order', async () => {
    const second = { ...doneJob.hits[0]!, id: 'formZ', name: 'Allergy Plan' };
    const running: JobState = {
      ...doneJob,
      status: 'running',
      finishedAt: null,
      progress: { done: 1, total: 3 },
      hits: [...doneJob.hits, second],
    };
    const { onCancel } = renderFindText('https://app.droplet.io/forms', running);
    expect(screen.getByText('Searched 1 of 3 forms')).toBeInTheDocument();
    // Progress isn't a live region; the panel announces start and finish once instead.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/Show opens a new tab/)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
      'Patient Intake',
      'Allergy Plan',
    ]);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
