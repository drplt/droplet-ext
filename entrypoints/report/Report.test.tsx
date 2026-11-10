import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { VersionComparison } from '@/lib/compare/types';

import { createJob, jobStorageKey } from '@/lib/jobState';

import { comparisonCsv, csvFileName } from './csv';
import { Report } from './Report';

const comparison: VersionComparison = {
  form: { id: 'formA', name: '90-Day Evaluation' },
  from: { version: 'v-1', locked: true, modified: '2026-01-01T00:00:00Z', published: true },
  to: { version: 'v-2', locked: false, modified: '2026-02-01T00:00:00Z', published: false },
  fields: [
    {
      field: 'layout',
      mode: 'structure',
      changes: [
        { kind: 'changed', path: ['Form', 'Input #name', 'label'], before: '"Name"', after: '"Full, legal name"' },
        { kind: 'added', path: ['Form', 'Computed #total', 'formula'], after: '=SUM(a, b)' },
      ],
    },
    { field: 'workflow', mode: 'structure', changes: [] },
  ],
};

const storeJob = (tabId: number, result: null | VersionComparison) =>
  storage.setItem(jobStorageKey(tabId), {
    ...createJob('j1', { kind: 'compareVersions', formId: 'formA', from: 'v-1', to: 'v-2' }, 1),
    comparison: result,
  });

describe('comparisonCsv', () => {
  it('writes one quoted row per change and neutralizes cells a spreadsheet would run as formulas', () => {
    expect(comparisonCsv(comparison)).toBe(
      [
        `${String.fromCharCode(0xfeff)}"Section","Change","Where","Before","After"`,
        '"Layout","Changed","Form › Input #name › label","""Name""","""Full, legal name"""',
        '"Layout","Added","Form › Computed #total › formula","","\'=SUM(a, b)"',
        '',
      ].join('\r\n'),
    );
  });

  it('names the file after the form and versions', () => {
    expect(csvFileName(comparison)).toBe('90-day-evaluation-v-1-to-v-2.csv');
  });
});

describe('Report', () => {
  it("shows the tab's comparison with a summary and a table per changed section", async () => {
    await storeJob(7, comparison);
    render(<Report tabId={7} />);

    expect(await screen.findByRole('heading', { name: 'Summary: 2 changes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Layout · 2 changes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Workflow/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /Changed Form › Input #name › label "Name" "Full, legal name"/ }),
    ).toBeVisible();
    expect(screen.getByRole('row', { name: /Old version v-1 Published/ })).toBeInTheDocument();
    expect(document.title).toBe('90-Day Evaluation v-1 → v-2');
  });

  it('saves as PDF through the print dialog, and downloads a CSV', async () => {
    await storeJob(7, comparison);
    render(<Report tabId={7} />);

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await userEvent.click(await screen.findByRole('button', { name: 'Save as PDF' }));
    expect(print).toHaveBeenCalledOnce();

    const createObjectURL = vi.fn((_blob: Blob) => 'blob:report');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('text/csv;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('says so when the comparison is gone', async () => {
    await storeJob(7, null);
    render(<Report tabId={7} />);
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument();
  });

  it('says so when opened without a tab', () => {
    render(<Report tabId={null} />);
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
  });
});
