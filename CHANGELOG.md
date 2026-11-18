# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The AMO sources zip no longer includes the `coverage/` report left behind by `pnpm test:coverage`.

## [0.2.0] - 2026-11-16

### Changed

- Redesigned the side panel and the comparison report: a type scale, one filled button per view with quieter text
  buttons, info, warning and error notices, one tag style, stronger field borders, and fixed dark-mode tints. The tool
  switcher is a neutral segmented control with arrow-key navigation and a dot on the tool that's running.
- **Find text** names the search in its results header, and its counts add up ("Found in 3 of 209 forms · 3 never
  published · 2 couldn't be searched"). Results keep their order while a search runs, Published labels are quiet so
  Draft stands out, and results from an earlier search are marked as out of date.
- **Find by ID** can no longer say "not found" next to "you can't check", and explains why **Show** is unavailable
  in visible text instead of a hover tooltip.
- **Compare** labels Before and After in words, not just colour, refreshes the version list after you publish (with
  a Refresh button), marks out-of-date results, and offers Swap when the old version is newer.
- **Report window** leads with the form name and when it was compared, uses ruled tables that print in greyscale, and
  has a designed "no longer available" page.

### Fixed

- Permission errors name the right permission: View to list a form's versions, Build to read them.
- A job running in one tool no longer silently disables the other two; the panel says what's running and offers to
  stop it.
- "1 matches" now reads "1 match"; the running and finished totals no longer disagree.
- The "can't reach this tab" error has a **Reload tab** button. It only clears that failed job, never a finished
  search or comparison.
- Accessibility: tool tabs support arrow keys, job start and finish are announced once, contrast passes in light and
  dark, tooltips can be dismissed with Escape, and the panel works at 200% zoom.

## [0.1.1] - 2026-11-13

### Fixed

- **Find by ID** now finds submissions, eSign templates and eSign submissions. It checks only forms, datasets,
  submissions, eSign templates, eSign submissions and packet templates.

## [0.1.0] - 2026-10-17

### Added

- Side panel for Chrome (`side_panel`) and Firefox (`sidebar_action`), opened from the toolbar button.
- **Find text** (`findStringInObj`): search every form or dataset in the organization. The type defaults from the
  current page and can be changed from a dropdown. Searches published versions; "Include unpublished drafts" also
  searches each item's newest draft, with every match labelled Published or Draft. Never-published items that were
  skipped are reported. Progress, cancel, per-item error reporting, and highlighted snippets.
- **Find by ID** (`findObjById`): identifies forms, datasets, submissions, eSign templates and submissions, packets,
  packet templates, clients, employees, roles, tags and accounts by ID.
- Result actions: show on the current page (scroll + highlight) or navigate there, or open in a new tab.
- Automatic same-organization access renewal for long searches.
- Droplet logo as the extension icon, and side panel styling that matches the Droplet app's palette.
- **Compare**: see what changed between two versions of a form. JSON documents are compared by structure and the
  layout component by component, so reformatting is ignored and a field dragged to another section is reported as
  moved, and workflow canvas positions are left out. The form defaults from the current page and the versions default to published → newest.
- **Open report** shows a comparison in its own window, where it can be saved as a PDF or downloaded as a CSV.
- Tooling: WXT, TypeScript, React, zod, ESLint, Prettier, Vitest, GitHub Actions CI and release workflows.
