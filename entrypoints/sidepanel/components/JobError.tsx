import type { JobFailure } from '@/lib/messages';

import { t } from '@/lib/i18n';

import { needsReload } from '../actions';
import { useTabReload } from '../hooks/useTabReload';
import { Notice } from './Notice';

/**
 * Which permission a `forbidden` failure means, so the message names the right one. Only name a permission we've
 * verified: listing form versions needs View, reading their contents needs Build. Dataset permissions aren't verified.
 */
type ForbiddenContext = 'datasets' | 'formList' | 'formRead' | 'other';

const FORBIDDEN_KEYS = {
  datasets: 'errorForbiddenDatasets',
  formList: 'errorForbiddenFormList',
  formRead: 'errorForbiddenFormRead',
  other: 'errorForbidden',
} as const;

const MESSAGE_KEYS = {
  network: 'errorNetwork',
  unauthorized: 'errorUnauthorized',
} as const;

const failureMessage = (error: JobFailure, forbidden: ForbiddenContext) =>
  error.kind === 'other'
    ? error.message
    : error.kind === 'forbidden'
      ? t(FORBIDDEN_KEYS[forbidden])
      : t(MESSAGE_KEYS[error.kind]);

type ErrorNoticeProps = {
  message: string;
  /** Offered for panel-level errors with no specific fix: hides the notice. They also get Reload tab. */
  onDismiss?: () => void;
  tabId: number;
};

/**
 * An error notice. When reloading the Droplet tab is the fix (or might be), it offers Reload tab: only ever on a press,
 * since a reload can discard unsaved work. While the tab reloads the button says so; the panel takes it from there.
 */
const ErrorNotice = ({ message, onDismiss, tabId }: ErrorNoticeProps) => {
  const { reload, reloading } = useTabReload(tabId);
  const offerReload = needsReload(message) || onDismiss !== undefined;
  return (
    <Notice
      tone="error"
      role="alert"
      actions={
        offerReload && (
          <>
            <button
              type="button"
              className="button button--text"
              aria-disabled={reloading}
              onClick={() => {
                if (!reloading) reload();
              }}
            >
              {t(reloading ? 'reloadingTab' : 'reloadTabButton')}
            </button>
            {onDismiss && (
              <button type="button" className="button button--text" onClick={onDismiss}>
                {t('dismissButton')}
              </button>
            )}
          </>
        )
      }
    >
      {message}
    </Notice>
  );
};

type Props = {
  error: JobFailure;
  /** What the job was doing, so a `forbidden` failure names the permission that's missing. */
  forbidden: ForbiddenContext;
  tabId: number;
};

const JobError = ({ error, forbidden, tabId }: Props) => (
  <ErrorNotice message={failureMessage(error, forbidden)} tabId={tabId} />
);

export { ErrorNotice, type ForbiddenContext, JobError, needsReload };
