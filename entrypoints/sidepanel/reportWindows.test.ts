import type { MockInstance } from 'vitest';

import { fakeBrowser } from 'wxt/testing/fake-browser';

import { createReportWindows } from './reportWindows';

const tab = { id: 7, url: 'https://app.droplet.io/forms/formA/edit', windowId: 1, loadedAt: 1 };

const updateSpy = () =>
  vi.spyOn(fakeBrowser.windows, 'update') as unknown as MockInstance<(...args: unknown[]) => Promise<unknown>>;

describe('report windows', () => {
  it('brings the open report forward instead of opening another', async () => {
    const open = vi.fn().mockResolvedValue({ id: 42 });
    const update = updateSpy().mockResolvedValue({});
    const windows = createReportWindows(open);

    await windows.show(tab, 'j1');
    await windows.show(tab, 'j1');
    expect(open).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(42, { focused: true });
  });

  it('opens a fresh window for a newer comparison, or when the old one is gone', async () => {
    const open = vi
      .fn()
      .mockResolvedValueOnce({ id: 42 })
      .mockResolvedValueOnce({ id: 43 })
      .mockResolvedValue({ id: 44 });
    const update = updateSpy().mockRejectedValue(new Error('No window with id: 43.'));
    const windows = createReportWindows(open);

    await windows.show(tab, 'j1');
    await windows.show(tab, 'j2');
    expect(open).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();

    await windows.show(tab, 'j2');
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('forgets a window when it closes', async () => {
    const windows = createReportWindows(vi.fn().mockResolvedValue({ id: 42 }));
    await windows.show(tab, 'j1');
    expect(windows.has(tab.id)).toBe(true);

    await fakeBrowser.windows.onRemoved.trigger(42);
    expect(windows.has(tab.id)).toBe(false);
  });
});
