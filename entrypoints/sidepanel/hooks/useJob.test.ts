import { act, renderHook } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { PanelCommand } from '@/lib/messages';

import { useJob } from './useJob';

type Listener<T> = (value: T) => void;

/** Minimal runtime.Port double whose disconnect can be simulated from the "background" side. */
const createPort = () => {
  const messageListeners: Listener<unknown>[] = [];
  const disconnectListeners: Listener<unknown>[] = [];
  const port = {
    name: 'panel',
    connected: true,
    sent: [] as PanelCommand[],
    postMessage: vi.fn((message: PanelCommand) => {
      if (!port.connected) throw new Error('Attempting to use a disconnected port object');
      port.sent.push(message);
    }),
    disconnect: vi.fn(() => {
      port.connected = false;
    }),
    onMessage: { addListener: (listener: Listener<unknown>) => messageListeners.push(listener) },
    onDisconnect: { addListener: (listener: Listener<unknown>) => disconnectListeners.push(listener) },
    emit: (message: unknown) => {
      messageListeners.forEach(listener => {
        listener(message);
      });
    },
    /** Simulates the background service worker being stopped. */
    drop: () => {
      port.connected = false;
      disconnectListeners.forEach(listener => {
        listener(port);
      });
    },
  };
  return port;
};

describe('useJob', () => {
  let ports: ReturnType<typeof createPort>[];

  beforeEach(() => {
    ports = [];
    vi.spyOn(fakeBrowser.runtime, 'connect').mockImplementation((() => {
      const port = createPort();
      ports.push(port);
      return port;
    }) as never);
  });

  it('subscribes to the tab and reflects state updates', () => {
    const { result } = renderHook(() => useJob(7));
    expect(ports[0]?.sent).toEqual([{ type: 'subscribe', tabId: 7 }]);
    act(() => {
      ports[0]?.emit({ type: 'state', tabId: 7, job: null });
      ports[0]?.emit({ type: 'error', tabId: 7, message: 'boom' });
    });
    expect(result.current.error).toBe('boom');
  });

  it('reconnects and resubscribes when the background stops, so commands keep working', () => {
    const { result } = renderHook(() => useJob(7));
    act(() => {
      ports[0]?.drop();
    });
    expect(ports).toHaveLength(2);
    expect(ports[1]?.sent).toEqual([{ type: 'subscribe', tabId: 7 }]);

    act(() => {
      result.current.cancel();
    });
    expect(ports[1]?.sent).toContainEqual({ type: 'cancel', tabId: 7 });
  });

  it('retries on a fresh port if the current one died without notice', () => {
    const { result } = renderHook(() => useJob(7));
    ports[0]!.connected = false;
    act(() => {
      result.current.clear();
    });
    expect(ports[1]?.sent).toEqual([
      { type: 'subscribe', tabId: 7 },
      { type: 'clear', tabId: 7 },
    ]);
  });

  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => useJob(7));
    unmount();
    ports[0]?.drop();
    expect(ports).toHaveLength(1);
  });
});
