import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../sidepanel/style.css';
import { Report } from './Report';
import './style.css';

// The side panel opens this page as report.html?tab=<id>; the comparison itself is read from that tab's job.
const tabParam = new URLSearchParams(window.location.search).get('tab');
const tabId = tabParam !== null && /^\d+$/.test(tabParam) ? Number(tabParam) : null;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Report tabId={tabId} />
    </StrictMode>,
  );
}
