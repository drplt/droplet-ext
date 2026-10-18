# Droplet Admin Extension

Public Chrome + Firefox MV3 extension built with WXT + React + TypeScript. Read README.md for architecture.

- Node 22.22.3 via `nvm use`; pnpm. Run `pnpm check` before finishing any change (lint, format, typecheck, tests).
- Style matches drplt: `type` not `interface`, named `export { }` blocks at file end, Prettier 120 cols single quotes.
- Public extension: do not add permissions or host permissions without updating README → Permissions and
  `store/listing.md`. Internal hosts belong only in `lib/hosts.ts` `INTERNAL_APP_MATCHES`.
- Never read cookies/tokens; API calls go through `lib/api.ts` from the content script.
- No `innerHTML`/HTML strings. All user-facing text via `t()` with keys in `public/_locales/en/messages.json`.
- API shapes come from the drplt monorepo (`src/spec/*`, `src/models/*`); keep `lib/schemas.ts` minimal and loose.
