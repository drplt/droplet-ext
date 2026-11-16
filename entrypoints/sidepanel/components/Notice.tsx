import type { ReactNode } from 'react';

type Tone = 'error' | 'info' | 'warning';

type Props = {
  /** Text buttons under the message (`.button--text`). */
  actions?: ReactNode;
  children: ReactNode;
  /** Can take focus from a link that points at it (`#id`), without joining the tab order. */
  focusable?: boolean;
  id?: string;
  /** `alert` for failures the user didn't ask about; omit for notices that are part of a result. */
  role?: 'alert';
  tone: Tone;
};

const ICON_PATHS: Record<Tone, ReactNode> = {
  info: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4M8 4.75v.01" />
    </>
  ),
  warning: (
    <>
      <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.4 9.5a1 1 0 0 1-.87 1.5H2.6a1 1 0 0 1-.87-1.5Z" />
      <path d="M8 6.5v3M8 11.5v.01" />
    </>
  ),
  error: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75v4M8 11.25v.01" />
    </>
  ),
};

/** Small inline icon; decorative, since the text carries the meaning. */
const NoticeIcon = ({ tone }: { tone: Tone }) => (
  <svg
    className="notice__icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICON_PATHS[tone]}
  </svg>
);

/** Inline message with an icon. See the notice variants in style.css for which tone to use. */
const Notice = ({ actions, children, focusable, id, role, tone }: Props) => (
  <div id={id} className={`notice notice--${tone}`} role={role} tabIndex={focusable ? -1 : undefined}>
    <NoticeIcon tone={tone} />
    <div>{children}</div>
    {actions && <div className="notice__actions">{actions}</div>}
  </div>
);

export { Notice, NoticeIcon, type Tone as NoticeTone };
