import { useId } from 'react';

import type { ObjectRef } from '@/lib/routes';

import { t } from '@/lib/i18n';
import { isOnObjectPage } from '@/lib/routes';

import type { ActiveTab } from '../hooks/useActiveTab';

import { openInNewTab, showObject, urlFor } from '../actions';
import { OBJECT_PAGE_LABELS } from '../labels';

type Props = {
  jobRunning: boolean;
  label: string;
  objectRef: ObjectRef;
  tab: ActiveTab;
};

/** What the actions can do for this object from the current page. */
type Availability =
  | { kind: 'noLink' } // no app page to go to (e.g. a submission whose form isn't known)
  | { kind: 'ready' }
  | { kind: 'wrongPage' }; // Show only works in the part of the app where this kind of object lives

const availability = (tab: ActiveTab, objectRef: ObjectRef): Availability =>
  urlFor(tab, objectRef) === null
    ? { kind: 'noLink' }
    : isOnObjectPage(objectRef.type, tab.url)
      ? { kind: 'ready' }
      : { kind: 'wrongPage' };

const NewTabIcon = () => (
  <svg
    className="button__icon"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4.5 2.5h-2v7h7v-2M7 2.5h2.5V5M9.5 2.5 5.5 6.5" />
  </svg>
);

/**
 * Show and Open in new tab for one result. When an action can't work from here, the reason is visible text under the
 * row (not a tooltip), and the button stays focusable with `aria-disabled` and points at that text.
 */
const ObjectActions = ({ jobRunning, label, objectRef, tab }: Props) => {
  const reasonId = useId();
  const state = availability(tab, objectRef);
  const canShow = state.kind === 'ready';
  const canOpen = state.kind !== 'noLink';
  const reason =
    state.kind === 'wrongPage'
      ? t('actionShowUnavailable', [t(OBJECT_PAGE_LABELS[objectRef.type])])
      : state.kind === 'noLink'
        ? t('actionNoLink')
        : null;

  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="button button--text"
          aria-label={`${t('actionShow')}: ${label}`}
          aria-describedby={reason ? reasonId : undefined}
          aria-disabled={!canShow}
          onClick={() => {
            if (canShow) void showObject(tab, objectRef, { jobRunning });
          }}
        >
          {t('actionShow')}
        </button>
        <button
          type="button"
          className="button button--text"
          aria-label={`${t('actionOpen')}: ${label}`}
          aria-describedby={canOpen ? undefined : reasonId}
          aria-disabled={!canOpen}
          onClick={() => {
            if (canOpen) void openInNewTab(tab, objectRef);
          }}
        >
          {t('actionOpen')}
          <NewTabIcon />
        </button>
      </div>
      {reason && (
        <p id={reasonId} className="hint actions__reason">
          {reason}
        </p>
      )}
    </>
  );
};

export { ObjectActions };
