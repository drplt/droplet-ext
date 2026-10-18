import { useState } from 'react';

import { isDropletAppUrl } from '@/lib/env';
import { t } from '@/lib/i18n';

import { FindById } from './components/FindById';
import { FindText } from './components/FindText';
import { useActiveTab } from './hooks/useActiveTab';
import { useJob } from './hooks/useJob';

type Tool = 'findById' | 'findText';

const TOOLS: { key: Tool; label: () => string }[] = [
  { key: 'findText', label: () => t('tabFindText') },
  { key: 'findById', label: () => t('tabFindById') },
];

const DROPLET_HOME = 'https://app.droplet.io/';

const NotOnDroplet = () => (
  <div className="empty">
    <h2>{t('notOnDropletTitle')}</h2>
    <p>{t('notOnDropletBody')}</p>
    <button type="button" className="button" onClick={() => void browser.tabs.create({ url: DROPLET_HOME })}>
      {t('openDroplet')}
    </button>
  </div>
);

const App = () => {
  const tab = useActiveTab();
  const { cancel, clear, error, job, start } = useJob(tab?.id ?? null);
  const [selectedTool, setTool] = useState<null | Tool>(null);
  // Until the user picks a tool, show the one that produced this tab's job (e.g. after reopening the panel).
  const tool = selectedTool ?? job?.request.kind ?? 'findText';

  if (!tab) return null;
  if (!isDropletAppUrl(tab.url)) return <NotOnDroplet />;

  return (
    <main className="app">
      <div className="tabs" role="tablist" aria-label={t('extName')}>
        {TOOLS.map(({ key, label }) => (
          <button
            key={key}
            id={`tab-${key}`}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tool === key}
            aria-controls={`panel-${key}`}
            onClick={() => {
              setTool(key);
            }}
          >
            {label()}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div id={`panel-${tool}`} role="tabpanel" aria-labelledby={`tab-${tool}`} className="panel">
        {tool === 'findText' ? (
          <FindText key={tab.id} tab={tab} job={job} onStart={start} onCancel={cancel} onClear={clear} />
        ) : (
          <FindById key={tab.id} tab={tab} job={job} onStart={start} onCancel={cancel} />
        )}
      </div>
    </main>
  );
};

export { App };
