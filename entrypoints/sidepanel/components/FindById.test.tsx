import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { JobState } from '@/lib/messages';

import { FindById } from './FindById';

const tab = { id: 7, url: 'https://app.droplet.io/forms', windowId: 1 };

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
  error: null,
});

describe('FindById', () => {
  it('starts a lookup with the trimmed id', async () => {
    const onStart = vi.fn();
    render(<FindById tab={tab} job={null} onStart={onStart} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Object ID'), ' abc123 {enter}');
    expect(onStart).toHaveBeenCalledWith({ kind: 'findById', id: 'abc123' });
  });

  it('lists each matching type with its actions, plus types the user could not check', () => {
    render(
      <FindById
        tab={tab}
        job={jobWith({
          hits: [{ type: 'submission', id: '42', label: '42', formId: 'formA' }],
          forbidden: ['employee', 'client'],
        })}
        onStart={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Submission')).toBeInTheDocument();
    // On the Forms page a submission can't be shown in place; Open in new tab still works.
    expect(screen.getByRole('button', { name: 'Show: 42' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Open in new tab: 42' })).toBeEnabled();
    expect(screen.getByText("You don't have access to check: Employee, Client")).toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    render(<FindById tab={tab} job={jobWith({ hits: [], forbidden: [] })} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('No object with that ID was found.')).toBeInTheDocument();
  });
});

describe('FindById show availability', () => {
  const lookupJob = jobWith({ hits: [{ type: 'dataset', id: 'ds1', label: 'Clinics', formId: null }], forbidden: [] });

  it('disables Show for a dataset while on the Forms page, explaining why on hover', async () => {
    render(<FindById tab={tab} job={lookupJob} onStart={vi.fn()} onCancel={vi.fn()} />);
    const show = screen.getByRole('button', { name: 'Show: Clinics' });
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription(/switch to the Datasets page, or use “Open in new tab”/);
    expect(screen.getByRole('button', { name: 'Open in new tab: Clinics' })).toBeEnabled();

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
    expect(show).toHaveAccessibleDescription(/Highlight it on this page/);
  });
});
