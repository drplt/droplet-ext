import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { JobState, PanelCommand, PanelUpdate } from '@/lib/messages';

import { App } from './App';

const TAB = { id: 7, url: 'https://app.droplet.io/forms', windowId: 1, active: true };

const textJob = (status: JobState['status']): JobState => ({
  jobId: 'j1',
  request: { kind: 'findText', target: 'forms', query: 'guardian', options: { includeDrafts: false } },
  status,
  startedAt: 1,
  finishedAt: status === 'running' ? null : 2,
  progress: { done: status === 'running' ? 1 : 3, total: 3 },
  hits: [],
  itemErrors: [],
  skipped: [],
  lookup: null,
  comparison: null,
  error: null,
});

/** Connects the panel to a fake background; `emit` pushes updates to it. */
const renderApp = async (initial: PanelUpdate) => {
  const listeners: ((update: PanelUpdate) => void)[] = [];
  const emit = (update: PanelUpdate) => {
    act(() => {
      listeners.forEach(listener => {
        listener(update);
      });
    });
  };
  vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([TAB] as never);
  const sent: PanelCommand[] = [];
  vi.spyOn(fakeBrowser.runtime, 'connect').mockImplementation((() => ({
    onMessage: { addListener: (listener: (update: PanelUpdate) => void) => listeners.push(listener) },
    onDisconnect: { addListener: () => undefined },
    postMessage: (command: PanelCommand) => sent.push(command),
    disconnect: () => undefined,
  })) as never);
  render(<App />);
  await screen.findByRole('tablist');
  emit(initial);
  return { emit, sent };
};

const state = (job: JobState | null): PanelUpdate => ({ type: 'state', tabId: TAB.id, job });

/** The Droplet tab finishes a full page load, a little later than now (so `loadedAt` moves on). */
const completeLoad = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 2));
    await fakeBrowser.tabs.onUpdated.trigger(TAB.id, { status: 'complete' }, TAB as never);
  });

describe('App', () => {
  it('moves between tools with the arrow keys, keeping one tab stop', async () => {
    await renderApp(state(null));
    const findText = screen.getByRole('tab', { name: 'Find text' });
    expect(findText).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Find by ID' })).toHaveAttribute('tabindex', '-1');

    findText.focus();
    await userEvent.keyboard('{ArrowRight}');
    const findById = screen.getByRole('tab', { name: 'Find by ID' });
    expect(findById).toHaveFocus();
    expect(findById).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-findById');

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Find text' })).toHaveFocus();
  });

  it('explains why a tool is blocked by another tool’s running job, and links back to it', async () => {
    await renderApp(state(textJob('running')));
    expect(screen.getByRole('tab', { name: 'Find text (running)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Find by ID' }));
    expect(screen.getByText(/A text search is running in this tab/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Go to Find text' }));
    expect(screen.getByRole('tab', { name: 'Find text (running)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('warns that starting another tool replaces finished results', async () => {
    await renderApp(state(textJob('done')));
    await userEvent.click(screen.getByRole('tab', { name: 'Find by ID' }));
    // Only once there's something to start, and under the submit row.
    expect(screen.queryByText('Starting here replaces your Find text results.')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('ID'), 'Yrobox');
    expect(screen.getByText('Starting here replaces your Find text results.')).toBeInTheDocument();
  });

  it('offers to reload the tab when the extension can’t reach it, only when asked', async () => {
    const reload = vi.spyOn(fakeBrowser.tabs, 'reload').mockResolvedValue(undefined);
    await renderApp({
      type: 'error',
      tabId: TAB.id,
      message: 'The extension can’t reach this tab yet. Save any open work, then reload the tab.',
    });
    expect(reload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload tab' }));
    expect(reload).toHaveBeenCalledWith(TAB.id);
  });

  it('after Reload tab, clears the can’t-reach-this-tab job, then says what to do', async () => {
    vi.spyOn(fakeBrowser.tabs, 'reload').mockResolvedValue(undefined);
    const failed: JobState = {
      ...textJob('error'),
      jobId: 'failed',
      progress: null,
      error: {
        kind: 'other',
        message: 'The extension can’t reach this tab yet. Save any open work, then reload the tab.',
      },
    };
    const { emit, sent } = await renderApp(state(failed));
    await userEvent.click(screen.getByRole('button', { name: 'Reload tab' }));
    expect(screen.getByRole('button', { name: 'Reloading…' })).toHaveAttribute('aria-disabled', 'true');
    expect(sent).not.toContainEqual({ type: 'clear', tabId: TAB.id });

    await completeLoad();
    await vi.waitFor(() => {
      expect(sent).toContainEqual({ type: 'clear', tabId: TAB.id });
    });
    emit(state(null));
    expect(screen.getByText('Tab reloaded. Search again.')).toBeInTheDocument();
    // The query stays, so searching again is one press.
    expect(screen.getByLabelText('Text to find')).toHaveValue('guardian');
  });

  it('keeps a failed search’s partial results when Reload tab is pressed from the panel error', async () => {
    vi.spyOn(fakeBrowser.tabs, 'reload').mockResolvedValue(undefined);
    const sessionEnded: JobState = {
      ...textJob('error'),
      jobId: 'partial',
      progress: { done: 2, total: 3 },
      error: { kind: 'unauthorized', message: '' },
      hits: [{ id: 'f1', name: 'Bus Rider Form', objectType: 'form', matchCount: 1, matches: [] }],
    };
    const { emit, sent } = await renderApp(state(sessionEnded));
    emit({ type: 'error', tabId: TAB.id, message: 'Something went wrong.' });
    await userEvent.click(screen.getByRole('button', { name: 'Reload tab' }));
    await completeLoad();
    await vi.waitFor(() => {
      expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
    });
    expect(sent).not.toContainEqual({ type: 'clear', tabId: TAB.id });
    expect(screen.getByRole('heading', { level: 3, name: 'Bus Rider Form' })).toBeInTheDocument();
  });

  it('goes back to Reload tab if the reload is rejected', async () => {
    vi.spyOn(fakeBrowser.tabs, 'reload').mockRejectedValue(new Error('No tab with id'));
    await renderApp({ type: 'error', tabId: TAB.id, message: 'Something went wrong.' });
    await userEvent.click(screen.getByRole('button', { name: 'Reload tab' }));
    expect(await screen.findByRole('button', { name: 'Reload tab' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('never clears a finished job when the tab reloads on its own', async () => {
    const { sent } = await renderApp(state(textJob('done')));
    await completeLoad();
    expect(sent).not.toContainEqual({ type: 'clear', tabId: TAB.id });
  });

  it('announces a job once when it starts and once when it ends, but not the state it opened on', async () => {
    const { emit } = await renderApp(state(textJob('done')));
    const live = screen.getByRole('status');
    expect(live).toBeEmptyDOMElement();

    emit(state({ ...textJob('running'), jobId: 'j2' }));
    expect(live).toHaveTextContent('Searching forms for “guardian”…');
    emit(state({ ...textJob('running'), jobId: 'j2', progress: { done: 2, total: 3 } }));
    expect(live).toHaveTextContent('Searching forms for “guardian”…');

    emit(state({ ...textJob('done'), jobId: 'j2' }));
    expect(live).toHaveTextContent('No forms contain “guardian”. Drafts weren’t searched.');
  });
});
