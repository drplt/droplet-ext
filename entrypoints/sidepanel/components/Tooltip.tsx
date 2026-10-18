import type { ReactNode } from 'react';

import { useId } from 'react';

type Props = {
  children: (describedBy: string) => ReactNode;
  text: string;
};

/**
 * Hover/focus tooltip that also works on unavailable controls (native `title` doesn't reliably show on disabled
 * buttons). The child receives the id to pass as `aria-describedby`, so screen readers announce the same text.
 */
const Tooltip = ({ children, text }: Props) => {
  const id = useId();
  return (
    <span className="tooltip">
      {children(id)}
      <span id={id} role="tooltip" className="tooltip__bubble">
        {text}
      </span>
    </span>
  );
};

export { Tooltip };
