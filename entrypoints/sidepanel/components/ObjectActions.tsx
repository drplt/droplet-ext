import type { ObjectRef } from '@/lib/routes';

import { t } from '@/lib/i18n';
import { isOnObjectPage } from '@/lib/routes';

import type { ActiveTab } from '../hooks/useActiveTab';

import { openInNewTab, showObject, urlFor } from '../actions';
import { OBJECT_PAGE_LABELS } from '../labels';
import { Tooltip } from './Tooltip';

type Props = {
  jobRunning: boolean;
  label: string;
  objectRef: ObjectRef;
  tab: ActiveTab;
};

const ObjectActions = ({ jobRunning, label, objectRef, tab }: Props) => {
  const hasUrl = urlFor(tab, objectRef) !== null;
  const onRightPage = isOnObjectPage(objectRef.type, tab.url);
  const canShow = hasUrl && onRightPage;
  const showHint = !onRightPage
    ? t('actionShowUnavailable', [t(OBJECT_PAGE_LABELS[objectRef.type])])
    : jobRunning
      ? t('actionShowNewTabTitle')
      : t('actionShowTitle');

  return (
    <div className="actions">
      <Tooltip text={showHint}>
        {describedBy => (
          // aria-disabled (not `disabled`) keeps the button hoverable/focusable so the reason can be read.
          <button
            type="button"
            className="button button--small"
            aria-label={`${t('actionShow')}: ${label}`}
            aria-describedby={describedBy}
            aria-disabled={!canShow}
            onClick={() => {
              if (canShow) void showObject(tab, objectRef, { jobRunning });
            }}
          >
            {t('actionShow')}
          </button>
        )}
      </Tooltip>
      <button
        type="button"
        className="button button--small button--quiet"
        aria-label={`${t('actionOpen')}: ${label}`}
        disabled={!hasUrl}
        onClick={() => void openInNewTab(tab, objectRef)}
      >
        {t('actionOpen')} <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
};

export { ObjectActions };
