import type { ReactNode } from 'react';

import { useEffect, useId, useState } from 'react';

type Props = {
  children: (describedBy: string) => ReactNode;
  text: string;
};

/**
 * Where the tooltip's trigger stands. The bubble shows while hovered or focused, and Escape hides it until both the
 * pointer and focus have left (WCAG 1.4.13: dismissible without moving either).
 */
type State = { dismissed: boolean; focused: boolean; hovered: boolean };

const IDLE: State = { dismissed: false, focused: false, hovered: false };

/**
 * Hover/focus tooltip for supplementary text on an enabled control. The child receives the id to pass as
 * `aria-describedby`, so screen readers announce the same text. The bubble can be hovered, and Escape dismisses it
 * even when it was opened by hover alone. Don't use it to explain why a control is unavailable; show that as visible
 * text instead (see ObjectActions).
 */
const Tooltip = ({ children, text }: Props) => {
  const id = useId();
  const [state, setState] = useState<State>(IDLE);
  const active = (state.hovered || state.focused) && !state.dismissed;

  // While the bubble is showing, Escape anywhere dismisses it: hover alone doesn't put focus inside the wrapper.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setState(previous => ({ ...previous, dismissed: true }));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  // Leaving with both pointer and focus resets the dismissal, so the next hover or focus shows it again.
  const leave = (change: Partial<State>) => {
    setState(previous => {
      const next = { ...previous, ...change };
      return next.hovered || next.focused ? next : IDLE;
    });
  };

  return (
    <span
      className="tooltip"
      data-dismissed={state.dismissed ? '' : undefined}
      onMouseEnter={() => {
        setState(previous => ({ ...previous, hovered: true }));
      }}
      onMouseLeave={() => {
        leave({ hovered: false });
      }}
      onFocus={() => {
        setState(previous => ({ ...previous, focused: true }));
      }}
      onBlur={() => {
        leave({ focused: false });
      }}
    >
      {children(id)}
      <span id={id} role="tooltip" className="tooltip__bubble">
        {text}
      </span>
    </span>
  );
};

export { Tooltip };
