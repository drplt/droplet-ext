# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
