import { act, renderHook } from '@testing-library/react';

import { useAnnouncement } from './useAnnouncement';

describe('useAnnouncement', () => {
  it('changes the live text even when the same sentence is announced twice, so it is read again', () => {
    const { result } = renderHook(() => useAnnouncement(7, null, true));
    act(() => {
      result.current.announce('Version list updated.');
    });
    const first = result.current.message;
    act(() => {
      result.current.announce('Version list updated.');
    });
    expect(first).toBe('Version list updated.');
    expect(result.current.message).not.toBe(first);
    expect(result.current.message.trim()).toBe('Version list updated.');
  });
});
