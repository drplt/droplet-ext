import { render, screen } from '@testing-library/react';

import { JobError } from './JobError';

const forbidden = { kind: 'forbidden', message: 'Access Denied' } as const;

describe('JobError', () => {
  it.each([
    ['formList', 'Your Droplet role can’t view forms. Ask an admin for View access to forms.'],
    ['formRead', 'Your Droplet role can’t open form versions. Ask an admin for Build access to forms.'],
    ['datasets', 'Your Droplet role can’t read datasets. Ask an admin for access to datasets.'],
  ] as const)('names the permission a %s failure needs', (context, text) => {
    render(<JobError error={forbidden} forbidden={context} tabId={7} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('offers Reload tab only when reloading is the fix', () => {
    const { rerender } = render(<JobError error={{ kind: 'network', message: '' }} forbidden="other" tabId={7} />);
    expect(screen.queryByRole('button', { name: 'Reload tab' })).not.toBeInTheDocument();

    rerender(
      <JobError
        error={{
          kind: 'other',
          message: 'The extension can’t reach this tab yet. Save any open work, then reload the tab.',
        }}
        forbidden="other"
        tabId={7}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reload tab' })).toBeInTheDocument();
  });
});
