import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { JobState } from '@/lib/messages';

import { FindById } from './FindById';

const tab = { id: 7, url: 'https://app.droplet.io/forms', windowId: 1, loadedAt: 0 };

const jobWith = (lookup: JobState['lookup']): JobState => ({
  jobId: 'j1',
  request: { kind: 'findById', id: '42' },
  status: 'done',
  startedAt: 1,
  finishedAt: 2,
  progress: null,
  hits: [],
  itemErrors: [],
  skipped: [],
  lookup,
  comparison: null,
  error: null,
});

describe('FindById', () => {
  it('starts a lookup with the trimmed id', async () => {
    const onStart = vi.fn();
    render(<FindById tab={tab} job={null} onStart={onStart} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('ID'), ' abc123 {enter}');
    expect(onStart).toHaveBeenCalledWith({ kind: 'findById', id: 'abc123' });
  });

  it('lists each match with its type, and says which types might also match', () => {
    render(
      <FindById
        tab={tab}
        job={jobWith({
          hits: [{ type: 'submission', id: '42', label: '42', formId: 'formA' }],
          forbidden: ['esignTemplate', 'esignSubmission'],
        })}
        onStart={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Submissions have no name, so the title is the number and the tag says what it is.
    expect(screen.getByRole('heading', { level: 3, name: '#42' })).toBeInTheDocument();
    expect(screen.getByText('Submission')).toHaveClass('tag');
    // On the Forms page a submission can't be shown in place; Open in new tab still works.
    expect(screen.getByRole('button', { name: 'Show: #42' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Open in new tab: #42' })).toHaveAttribute('aria-disabled', 'false');
    expect(
      screen.getByText(/Your role can’t look up eSign templates or eSign submissions, so this ID might also match/),
    ).toBeInTheDocument();
  });

  it('explains that several types can share one ID', () => {
    const hits = [
      { type: 'form' as const, id: 'Yrobox', label: 'Field Trip', formId: null },
      { type: 'dataset' as const, id: 'Yrobox', label: 'Bus Routes', formId: null },
    ];
    render(<FindById tab={tab} job={jobWith({ hits, forbidden: [] })} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Matches 2 things. IDs are only unique within a type.')).toBeInTheDocument();
    // The results say what was checked, so the input hint steps aside until the ID changes.
    expect(screen.queryByText(/^Works for/)).not.toBeInTheDocument();
  });

  it('says "not found" only for the types it could check', () => {
    render(<FindById tab={tab} job={jobWith({ hits: [], forbidden: [] })} onStart={vi.fn()} onCancel={vi.fn()} />);
    // "42" is numeric, so submission types were checked too.
    expect(
      screen.getByText(/^No form, dataset, submission, eSign template, eSign submission,? or packet template/),
    ).toBeInTheDocument();
  });

  it('never says "not found" when some types could not be checked', () => {
    render(
      <FindById
        tab={tab}
        job={jobWith({ hits: [], forbidden: ['packetTemplate'] })}
        onStart={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        'Nothing you can see has this ID. Your role can’t look up packet templates, so it could still be one of those.',
      ),
    ).toBeInTheDocument();
  });

  it('marks results as stale when the ID changes', async () => {
    render(<FindById tab={tab} job={jobWith({ hits: [], forbidden: [] })} onStart={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('ID'), '3');
    expect(screen.getByText(/Showing results for 42/)).toBeInTheDocument();
    expect(screen.getByText(/^Works for/)).toBeInTheDocument();
  });
});

describe('FindById show availability', () => {
  const lookupJob = jobWith({ hits: [{ type: 'dataset', id: 'ds1', label: 'Clinics', formId: null }], forbidden: [] });

  it('disables Show for a dataset while on the Forms page, with the reason as visible text', async () => {
    render(<FindById tab={tab} job={lookupJob} onStart={vi.fn()} onCancel={vi.fn()} />);
    const show = screen.getByRole('button', { name: 'Show: Clinics' });
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription('Switch to the Datasets page to show this here.');
    expect(screen.getByText('Switch to the Datasets page to show this here.')).toBeVisible();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in new tab: Clinics' })).toHaveAttribute('aria-disabled', 'false');

    const update = vi.spyOn(fakeBrowser.tabs, 'update');
    await userEvent.click(show);
    expect(update).not.toHaveBeenCalled();
  });

  it('enables Show for a dataset on the Datasets page', () => {
    render(
      <FindById
        tab={{ ...tab, url: 'https://app.droplet.io/datasets' }}
        job={lookupJob}
        onStart={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const show = screen.getByRole('button', { name: 'Show: Clinics' });
    expect(show).toHaveAttribute('aria-disabled', 'false');
    expect(show).not.toHaveAccessibleDescription();
  });
});
