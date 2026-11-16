import type { KeyboardEvent } from 'react';

import { useRef, useState } from 'react';

import type { MessageKey } from '@/lib/i18n';
import type { JobState } from '@/lib/messages';

import { isDropletAppUrl } from '@/lib/env';
import { t } from '@/lib/i18n';

import { CompareVersions } from './components/CompareVersions';
import { DropletMark } from './components/DropletMark';
import { FindById } from './components/FindById';
import { FindText } from './components/FindText';
import { ErrorNotice } from './components/JobError';
import { Notice } from './components/Notice';
import { useActiveTab } from './hooks/useActiveTab';
import { AnnounceContext, useAnnouncement } from './hooks/useAnnouncement';
import { useJob } from './hooks/useJob';
import { TabReloadContext, useTabReloadFlow } from './hooks/useTabReload';

type Tool = JobState['request']['kind'];

const TOOLS: Tool[] = ['findText', 'findById', 'compareVersions'];
const DEFAULT_TOOL: Tool = 'findText';

const TOOL_COPY: Record<Tool, { label: MessageKey; reloaded: MessageKey; running: MessageKey }> = {
  findText: { label: 'tabFindText', running: 'otherJobRunningFindText', reloaded: 'reloadedFindText' },
  findById: { label: 'tabFindById', running: 'otherJobRunningFindById', reloaded: 'reloadedFindById' },
  compareVersions: { label: 'tabCompare', running: 'otherJobRunningCompare', reloaded: 'reloadedCompare' },
};

/**
 * A tab runs one job at a time, so another tool's running job blocks this one. (Another tool's finished results are
 * only replaced if the user starts here; each tool says so under its submit button, see ReplacesHint.)
 */
const blockingTool = (tool: Tool, job: JobState | null): null | Tool =>
  job?.status === 'running' && job.request.kind !== tool ? job.request.kind : null;

const DROPLET_HOME = 'https://app.droplet.io/';

const NotOnDroplet = () => (
  <main className="empty">
    <DropletMark />
    <h1>{t('notOnDropletTitle')}</h1>
    <p>{t('notOnDropletBody')}</p>
    <button type="button" className="button" onClick={() => void browser.tabs.create({ url: DROPLET_HOME })}>
      {t('openDroplet')}
    </button>
  </main>
);

const KEY_STEPS: Partial<Record<string, (index: number) => number>> = {
  ArrowLeft: index => (index - 1 + TOOLS.length) % TOOLS.length,
  ArrowRight: index => (index + 1) % TOOLS.length,
  End: () => TOOLS.length - 1,
  Home: () => 0,
};

type TabsProps = {
  onSelect: (tool: Tool) => void;
  runningTool: null | Tool;
  selected: Tool;
};

/** Tool switcher with the ARIA tabs keyboard model: one tab stop, arrows/Home/End move and select. */
const ToolTabs = ({ onSelect, runningTool, selected }: TabsProps) => {
  const refs = useRef<Partial<Record<Tool, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = TOOLS[step(TOOLS.indexOf(selected))];
    if (!next) return;
    onSelect(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={t('extName')}>
      {TOOLS.map(tool => {
        const isSelected = tool === selected;
        return (
          <button
            key={tool}
            ref={element => {
              refs.current[tool] = element;
            }}
            id={`tab-${tool}`}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={isSelected}
            aria-controls={isSelected ? `panel-${tool}` : undefined}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              onSelect(tool);
            }}
          >
            {t(TOOL_COPY[tool].label)}
            {runningTool === tool && (
              <>
                {' '}
                <span className="tabs__dot" aria-hidden="true" />
                <span className="visually-hidden">{t('tabRunning')}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};

const App = () => {
  const tab = useActiveTab();
  const tabId = tab?.id ?? null;
  const { cancel, clear, dismissError, error, job, start, synced } = useJob(tabId);
  const { announce, message: announcement } = useAnnouncement(tabId, job, synced);
  const reload = useTabReloadFlow({ clear, dismissError, job, tab });
  // A pick belongs to the tab it was made in. Otherwise show the tool that produced this tab's job.
  const [picked, setPicked] = useState<null | { tabId: number; tool: Tool }>(null);
  const tool = (picked?.tabId === tabId ? picked.tool : null) ?? job?.request.kind ?? DEFAULT_TOOL;
  const blocker = blockingTool(tool, job);

  const liveRegion = (
    <p className="visually-hidden" role="status">
      {announcement}
    </p>
  );

  if (!tab) return <main className="app" aria-busy="true" />;
  if (!isDropletAppUrl(tab.url)) return <NotOnDroplet />;

  const select = (next: Tool) => {
    setPicked({ tabId: tab.id, tool: next });
    reload.dismissReloaded();
  };

  return (
    <AnnounceContext value={announce}>
      <TabReloadContext value={reload.value}>
        <main className="app">
          <ToolTabs
            selected={tool}
            runningTool={job?.status === 'running' ? job.request.kind : null}
            onSelect={select}
          />
          {liveRegion}

          <div className="panel-notices">
            {error && <ErrorNotice message={error} tabId={tab.id} onDismiss={dismissError} />}
            {reload.showReloaded && (
              <Notice
                tone="info"
                actions={
                  <button type="button" className="button button--text" onClick={reload.dismissReloaded}>
                    {t('dismissButton')}
                  </button>
                }
              >
                {t(TOOL_COPY[tool].reloaded)}
              </Notice>
            )}
            {blocker && (
              <Notice
                tone="info"
                actions={
                  <>
                    <button
                      type="button"
                      className="button button--text"
                      onClick={() => {
                        select(blocker);
                      }}
                    >
                      {t('otherJobGoTo', [t(TOOL_COPY[blocker].label)])}
                    </button>
                    <button type="button" className="button button--text" onClick={cancel}>
                      {t('cancelButton')}
                    </button>
                  </>
                }
              >
                {t(TOOL_COPY[blocker].running)}
              </Notice>
            )}
          </div>

          <div id={`panel-${tool}`} role="tabpanel" aria-labelledby={`tab-${tool}`} className="panel">
            {tool === 'findText' ? (
              <FindText key={tab.id} tab={tab} job={job} onStart={start} onCancel={cancel} onClear={clear} />
            ) : tool === 'findById' ? (
              <FindById key={tab.id} tab={tab} job={job} onStart={start} onCancel={cancel} />
            ) : (
              <CompareVersions key={tab.id} tab={tab} job={job} onStart={start} onCancel={cancel} onClear={clear} />
            )}
          </div>
        </main>
      </TabReloadContext>
    </AnnounceContext>
  );
};

export { App };
