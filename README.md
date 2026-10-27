# Droplet Admin Extension

A browser extension for **Chrome** and **Firefox** that adds a side panel to the [Droplet](https://droplet.io) web app with two tools:

- **Find text.** Search every form or dataset in your organization for a piece of text (`findStringInObj`).
  - The object type is picked from the page you're on (`/forms` → Forms, `/datasets` → Datasets), and you can change it with a dropdown.
  - Form search covers layout, workflow, visibility, attributes, datasets, notifications, integrations, translations and tags.
  - Dataset search covers every value, labelled by row and column.
- **Find by ID.** Paste any ID and see what it is (`findObjById`): a form, dataset, submission, eSign template or submission, packet, packet template, client, employee, role, tag or account.

Every result has two buttons:

- **Show** highlights the item if it's visible on the current page, and otherwise opens it in this tab.
- **Open in new tab ↗** opens it in a new tab.

The extension is public: anyone can install it, and it works with whatever access your Droplet role gives you.

## Getting started

Requirements: Node `24.22.1` (see `.nvmrc`) and pnpm 10.

Global npm packages are installed per Node version under nvm. So the first time you switch to this project's Node version, install pnpm for it:

```sh
nvm install         # reads .nvmrc
npm install -g pnpm@10.20.0
```

```sh
nvm use
pnpm install        # also runs `wxt prepare` and installs the git pre-commit hook
pnpm dev            # opens Chrome with the extension loaded and hot reloading
pnpm dev:firefox    # same, in Firefox
```

Dev mode also enables the internal environments: `demo1`, `dev1`, `dr1` and `stage` (all `.app.droplet.io`), plus `localhost:8000`. Production builds only include `https://app.droplet.io`. See [Environments](#environments).

### Loading a build manually

| Browser | Steps                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome  | `pnpm build`, then go to `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select `.output/chrome-mv3`.                           |
| Firefox | `pnpm build:firefox`, then go to `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…** and select `.output/firefox-mv3/manifest.json`. |

## Scripts

| Script                                                 | What it does                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:firefox`                        | Dev build with hot reload (includes internal hosts)                                                                  |
| `pnpm build` / `pnpm build:firefox` / `pnpm build:all` | Production builds → `.output/<browser>-mv3`                                                                          |
| `pnpm build:internal`                                  | Production-optimised build that includes internal hosts → `.output/<browser>-mv3-internal`                           |
| `pnpm zip:all`                                         | Store packages: Chrome zip, Firefox zip, and the AMO **sources** zip                                                 |
| `pnpm zip:internal`                                    | Zips of the internal build (works on demo1/dev1/stage/local) for sharing with testers; never upload these to a store |
| `pnpm check`                                           | lint + format check + typecheck + tests (what CI runs)                                                               |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest                                                                                                               |
| `pnpm lint` / `pnpm lint:fix`                          | ESLint (type-aware, React hooks, a11y, import sorting)                                                               |
| `pnpm lint:firefox`                                    | `web-ext lint` on the Firefox build                                                                                  |
| `pnpm format`                                          | Prettier                                                                                                             |

## How it works

```
 side panel (React)  ──port──▶  background  ──tabs.sendMessage──▶  content script on app.droplet.io
        ▲                         │  per-tab job state                      │  runs the job: fetch(api, credentials: 'include')
        └──────── state ──────────┘  in storage.session  ◀── job events ───┘
```

**API calls run in the content script.** That makes them ordinary first-party requests from the Droplet page:

- The browser attaches the user's existing session cookie.
- The API's CORS allow-list already accepts the app origin.
- The extension **never reads, stores or forwards a token**.

On Firefox the content script uses `content.fetch` so that requests go out as the page.

**Expired tokens.** Access tokens last about 5 minutes, and an org-wide search can take longer. When a request gets a 401, `lib/api.ts` renews access the same way the Droplet app does: `POST /v1/identity/access` with the organization already active in the tab, then it retries once. It never switches organizations.

**Job state lives in the background.** The background keeps each tab's job state in `storage.session`. Closing and reopening the panel picks the job back up, and you can keep browsing while a search runs.

- A full page reload stops the job and says so.
- In-app navigation does not stop the job.
- While a search is running, **Show** opens a new tab instead, so it doesn't interrupt the search.

**Search scope.** Text search lists every object in the org, then fetches each one's **published** version, four at a time, and matches case-insensitively. Objects that have never been published are skipped and reported as skipped. With **Include unpublished drafts** on, each object's newest draft is searched _as well_, when it's newer than the published version; never-published objects are then searched through their draft. Every match is labelled **Published** or **Draft**.

- A per-item permission error is listed rather than failing the whole run.
- A lost session, or no access to the list at all, stops the run with a clear message.

**Find by ID.** Droplet IDs are hashids salted per object type, so an ID alone doesn't say what it is. `lib/lookup/objById.ts` tries every `getById` route in parallel and reports each one that resolves. Submission routes are only tried for numeric IDs.

### Project layout

```
entrypoints/
  background.ts          relay + per-tab job state, toolbar → side panel
  droplet.content/       runs jobs in the Droplet tab; "show on page" highlight
  sidepanel/             React UI (App, components/, hooks/)
lib/
  api.ts                 fetch wrapper: envelope parsing, typed ApiError, 401 renew + retry
  env.ts, hosts.ts       app ↔ API origin mapping; host match patterns
  search/                findStringInObj: run.ts (runner), forms.ts, datasets.ts, match.ts
  lookup/objById.ts      findObjById
  targets.ts             registry of searchable types (add new ones here)
  routes.ts              object type → Droplet app URL
  schemas.ts             zod schemas for the API responses we read
  messages.ts, jobState.ts  typed messaging protocol and pure job-state reducer
public/_locales/en/      all user-facing strings (i18n)
test/                    fake Droplet API + fixtures + setup
```

### Adding a searchable type

1. Implement a `SearchTarget` (see `lib/search/types.ts`) in `lib/search/<type>.ts`. It needs two functions: `listItems` and `searchItem`.
2. Register it in `lib/targets.ts`.
3. Add its label to `TARGET_LABELS` (`entrypoints/sidepanel/labels.ts`) and to `messages.json`.
4. If its pages have a recognizable path, map it in `lib/pageContext.ts`.
5. Add fixture tests next to it.

## Environments

| Build                             | Hosts in manifest                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm build` / `zip` (store)      | `https://app.droplet.io/*`                                                         |
| `pnpm dev`, `pnpm build:internal` | adds `demo1`, `dev1`, `dr1`, `stage` `.app.droplet.io` and `http://localhost:8000` |

The host lists live in `lib/hosts.ts`. CI fails if a production manifest mentions an internal host.

## Permissions

These justifications can be reused in store submissions.

| Permission                                   | Why                                                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host_permissions: https://app.droplet.io/*` | Runs the content script that performs searches in the user's own Droplet session, and lets the side panel read the active tab's URL to choose the default object type. |
| `storage`                                    | Remembers the last selected object type (`storage.local`) and keeps the current tab's results while the browser is open (`storage.session`).                           |
| `sidePanel` (Chrome only)                    | Shows the tools in Chrome's side panel. Firefox uses `sidebar_action`, which needs no permission.                                                                      |

There is no `cookies` permission, no `tabs` permission, no remote code and no analytics.

## Code standards

- **TypeScript** in strict mode with `noUncheckedIndexedAccess`.
- **Style:** prefer `type` over `interface`; use named `export { … }` blocks. Both follow the drplt monorepo.
- **Lint and format:** ESLint `strictTypeChecked`, `jsx-a11y`, `react-hooks`, and `perfectionist` import sorting. Prettier settings match drplt.
- **No HTML from strings.** Results contain customer data. Lint bans `innerHTML` and `insertAdjacentHTML`, and snippets are rendered as text nodes.
- **Translated strings.** Every user-facing string goes through `t()` (`lib/i18n.ts`). Keys are type-checked against `messages.json`.
- **Pre-commit hook.** `simple-git-hooks` + `lint-staged` run ESLint and Prettier on staged files.

## Releasing

1. Bump `version` in `package.json` and add a section to `CHANGELOG.md`.
2. Commit, tag `vX.Y.Z` and push the tag. The **Release** workflow checks that the tag matches `package.json`, runs the full check, builds the store zips and drafts a GitHub Release.
3. Upload the packages to the stores:
   - **Chrome Web Store:** upload `droplet-ext-X.Y.Z-chrome.zip`.
   - **Firefox Add-ons (AMO):** upload `droplet-ext-X.Y.Z-firefox.zip` **and** `droplet-ext-X.Y.Z-sources.zip`. AMO requires the sources for bundled code.
     - Build instructions for reviewers: `nvm use && pnpm install --frozen-lockfile && pnpm zip:firefox`.
     - Reviewer note: `web-ext lint` reports `DANGEROUS_EVAL` and `UNSAFE_VAR_ASSIGNMENT` warnings. These come from bundled third-party code: zod's `new Function` capability probe, which this extension turns off with `z.config({ jitless: true })`, and React DOM's internal `innerHTML` use.

Store listing copy is in `store/listing.md`. Never commit signing keys (`*.pem`) or store API credentials. `.gitignore` blocks the common file types.
