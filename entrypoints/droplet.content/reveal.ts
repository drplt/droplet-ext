// "Show on page": find an object's card/row in the current Droplet list view, scroll to it and highlight it.
// Selectors follow the app's markup (same hooks drop-ext-1 used) and fail soft when the markup changes.

const HIGHLIGHT_CLASS = 'droplet-ext-highlight';
const HIGHLIGHT_MS = 3000;
const CARD_SELECTOR = '[data-testid="component-entity-card"]';

const LIST_PATH_SEGMENT: Record<string, string> = {
  dataset: 'datasets',
  form: 'forms',
};

const findElement = (objectType: string, id: string): Element | null => {
  const escaped = CSS.escape(id);
  if (objectType === 'submission') return document.querySelector(`#submission-row-${escaped}`);

  const segment = LIST_PATH_SEGMENT[objectType];
  if (!segment) return null;
  const link = document.querySelector(`a[href*="/${segment}/${escaped}/"], a[href$="/${segment}/${escaped}"]`);
  const labelled = document.querySelector(`[aria-label="${escaped}"]`);
  const anchor = link ?? labelled;
  return anchor?.closest(CARD_SELECTOR) ?? anchor;
};

const revealOnPage = (objectType: string, id: string): boolean => {
  const element = findElement(objectType, id);
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => {
    element.classList.remove(HIGHLIGHT_CLASS);
  }, HIGHLIGHT_MS);
  return true;
};

export { revealOnPage };
