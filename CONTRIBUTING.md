# Contributing

Start with the [README](README.md#getting-started) to install dependencies and run
the app, and read [Architecture](docs/architecture.md) for how the code is organized.
This guide covers day-to-day development: commands, testing, conventions,
configuration, and the Git and pull request workflow.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the app and the Worker together with hot reload. |
| `npm run build` | Lint, typecheck, then build the client and Worker into `dist/`. Stops at the first failure. |
| `npm run preview` | Serve the production build locally. Build first. |
| `npm run typecheck` | Typecheck the browser, Worker, and Node environments separately. |
| `npm run ts -- path/to/script.ts` | Run a Node TypeScript script through `tsx`, with `@shared/*` aliases resolved. |
| `npm run lint` | Run ESLint and Stylelint. |
| `npm run lint:js` | Run ESLint only. |
| `npm run lint:css` | Run Stylelint only. |
| `npm run lint:fix` | Apply available ESLint and Stylelint fixes, then report what remains. |
| `npm test` | Run the Vitest unit tests. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Build, serve a production preview, and run Playwright at desktop and phone sizes. |
| `npm run check:assets` | Check built client assets against Cloudflare's per-file size limit. |
| `npm run check:bundle` | Validate the built Worker with a Wrangler deployment dry run. |
| `npm run check` | Build, then run unit tests, asset checks, and the deployment dry run. |
| `npm run deploy` | Build and deploy to Cloudflare with your authenticated account. |

`npm run build` treats lint warnings as errors. `npm run check` reuses the build's
lint and typecheck rather than running them twice.

## Testing

Unit tests live under `tests/unit/`, in the folder that matches the code's runtime:

| Folder | Tests | TypeScript config |
| --- | --- | --- |
| `tests/unit/app` | Browser and React code in `src/` | `tsconfig.app.json` |
| `tests/unit/worker` | Worker code in `worker/` | `tsconfig.worker.json` |
| `tests/unit/shared` | Platform-independent code in `shared/` | `tsconfig.node.json` |
| `tests/unit/tooling` | Lint rules, scripts, and other build tooling | `tsconfig.node.json` |

Do not put Worker tests in the shared or tooling folders; they would be checked
against Node types. Pure Worker logic can run in Vitest's Node environment. Tests
that need real Cloudflare bindings require the Workers runtime integration.

Browser tests live in `tests/e2e/` and run against a production preview. Add a
Playwright test that reaches each new screen or state. Install Chromium once:

```sh
npx playwright install chromium
```

Run a single file while iterating:

```sh
npx vitest run tests/unit/worker/example.test.ts
npx playwright test tests/e2e/example.spec.ts --project=desktop
```

Test configuration worth knowing:

- Vitest restores mocks, stubbed globals, and environment variables between tests.
- Unit tests time out after five seconds; use fake timers for longer waits.
- `test.only` fails in CI.
- Playwright keeps screenshots and traces only for failed tests.

## Verification

- While iterating, run the smallest relevant command from [Commands](#commands).
- Before committing application, dependency, configuration, or test changes, run
  `npm run check`. Also run `npm run test:e2e` when screens, routing, or the Worker
  change.
- For documentation-only changes, check local links and compare documented commands
  and behavior with the source. Application checks are unnecessary unless executable
  files also change.
- Add or update tests when behavior changes.

## Code conventions

- Follow the repository ESLint, Stylelint, and EditorConfig configuration.
- Use PascalCase for React component filenames, and kebab-case for CSS files and
  game IDs.
- Use `import type` for type-only imports, and the `@/` and `@shared/` aliases when
  importing across folders.
- Respect the [runtime boundaries](docs/architecture.md#runtime-boundaries-and-shared-contracts);
  lint enforces which folders may import which.

### Copy

All visible and accessible text comes from `src/copy/en.ts`, using the copy keys
defined in the plan. Lint rejects literal JSX text and literal values in
accessibility labels, titles, alt text, and placeholders. Structural props such as
`className`, route paths, and `data-*` attributes may be literals. Review still
checks that dynamic text comes from the catalog.

### Browser storage

Direct `localStorage` access is allowed only in `src/lib/storage/`. Everything else
uses the helpers there, which own error handling.

### Inline styles

Inline `style` props are rejected on DOM elements and on components. Express styles
as CSS classes using tokens; when porting a mock, rebuild its inline styles in CSS.

The only exception is passing a value that exists only at runtime, such as a
measured progress fraction, as a CSS custom property. Disable the rule for that one
line and give the reason:

```tsx
// eslint-disable-next-line react/forbid-dom-props -- progress is measured at runtime; CSS owns its styling.
<div style={{ '--progress': progress } as CSSProperties} />
```

Separate lint guards still require an explicit object with literal `--name` keys and
dynamic values, and reject spreads and opaque style objects. Never disable those
guards or add a file-wide exception. Static values belong in CSS.

## Styling and design tokens

Design values live in `src/styles/tokens.css`: colors, type roles, weights, line
heights, tracking, the spacing scale, durations, and fixed component measurements.
Add a token there before using a new value. Component CSS refers to tokens only;
token definitions and calculations belong in the token file.

Stylelint enforces this for every file under `src/` as part of `npm run lint`.
Whole values must be built from `var()` references or structural keywords, so mixed
values like `padding: var(--space-1) 12px` and raw fallbacks like
`color: var(--text, red)` are rejected. Structural values such as zero, `auto`,
percentages, `fr`, angles, unitless scale factors, and viewport units remain
allowed where they describe geometry rather than design. When a shorthand cannot
be written with tokens, use longhands. [`stylelint.config.js`](stylelint.config.js)
defines the exact rules.

Interactive targets must meet the minimum size token. Native controls do so by
default; standalone links opt in with the `.control-link` class. Ordinary inline
text links keep their text layout.

## Node scripts

Run build-time scripts in `factory/`, `eval/`, and `scripts/` with
`npm run ts -- <path>`. `tsx` reads `tsconfig.node.json`, so `@shared/*` imports
resolve at runtime as well as during typechecking.

## Secrets and deployment

Never commit secrets.

| Where | What |
| --- | --- |
| `.dev.vars` | Local Worker secrets. Copy from `.dev.vars.example`. |
| `.env` | Local credentials for Node scripts. Copy from `.env.example`. |
| `wrangler secret put <NAME>` | Production Worker secrets. |

Both local files are ignored by Git. Never put secrets in `VITE_*` variables:
Vite exposes them to the browser.

`npm run deploy` builds, checks assets, and publishes through Wrangler with your
authenticated Cloudflare account. Coding agents must get confirmation before
deploying; see [agent safety](AGENTS.md#safety).

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs the build, unit tests, asset check,
and deployment dry run on every pull request and every push to `main`. Its
`release-ci` check is required by `main`'s branch protection. Browser tests run on
demand from the workflow's **Run workflow** button, and their failure reports are
kept for seven days. Newer pushes cancel outdated runs.

When new checks are added to `npm run check`, add them to the workflow too.

## Configuration reference

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies, the required Node version, scripts, and overrides. |
| `package-lock.json` | Exact dependency versions for `npm ci`. Commit it with dependency changes. |
| `.nvmrc` | Node version for `nvm use` and CI. |
| `index.html` | Browser entry point where React mounts. |
| `vite.config.ts` | React and Cloudflare plugins, import aliases, dev and preview ports, and files the dev server refuses to serve. |
| `wrangler.jsonc` | Worker entry point, compatibility date, bindings, and static asset routing. |
| `tsconfig.json` | Builds the three TypeScript environments with `tsc -b`. |
| `tsconfig.base.json` | Shared strict compiler options and import aliases. |
| `tsconfig.app.json` | Browser environment: `src/`, `shared/`, and app tests. |
| `tsconfig.worker.json` | Cloudflare environment: `worker/`, `shared/`, and Worker tests. |
| `tsconfig.node.json` | Node environment: config files, scripts, factory, eval, and Node tests. |
| `eslint.config.js` | Type-aware TypeScript, React, accessibility, copy, storage, and import-boundary rules. |
| `stylelint.config.js` | Design-token enforcement for CSS. |
| `vitest.config.ts` | Unit test discovery, isolation, and timeouts. |
| `playwright.config.ts` | Browser test viewports, preview server, and failure artifacts. |
| `.github/workflows/ci.yml` | Continuous integration. |
| `.editorconfig` | Indentation, encoding, and line endings. |
| `.gitignore` | Keeps the local plan, secrets, dependencies, and generated output out of Git. |
| `.env.example`, `.dev.vars.example` | Templates for local secrets. |
| `public/.assetsignore` | Files in `public/` that are never uploaded as assets. |
| `scripts/check-assets.mjs` | Cloudflare asset size check. |

Empty folders are kept with `.gitkeep` files. Delete a folder's marker once it holds
real files.

### Dependency overrides

Each entry in `overrides` in `package.json` works around an upstream issue. Record
the reason here, and remove the override once upstream no longer needs it.

- `eslint-plugin-react` → `eslint`: the plugin does not yet declare ESLint 10
  support. It loads through `@eslint/compat`, and the override keeps a single ESLint
  version installed.
- `miniflare` → `undici`: keeps Miniflare on a patched `undici` release until the
  Cloudflare tooling pins it.

## Git workflow

`main` is protected by GitHub branch rules. Changes reach it only through a pull
request from another branch, every commit must be signed, and the `release-ci`
check must pass before merging.

- Keep changes focused and reviewable.
- Do not commit directly to `main`. When starting new work:
  1. Run `git fetch --prune`.
  2. Delete local branches whose pull request has been merged. `git branch -vv`
     marks their remote as `gone`. Never delete a branch whose pull request is
     still open or was closed without merging.
  3. Create a new branch from the latest `origin/main`.
- Before merging, update the branch from the latest `origin/main`.
- Use signed [Conventional Commits](https://www.conventionalcommits.org/).
- Do not rewrite shared history.
- Do not commit generated output such as `dist/`, `.wrangler/`, `node_modules/`,
  coverage, or test results. Never commit the `plan/` folder.

## Pull requests

- Title the pull request as a Conventional Commit, for example
  `feat(worker): add judge route`.
- In the description, summarize the change and list the checks that ran, plus any
  that could not run and why.

## Documentation ownership

Each topic has one owning document. Update it in the same change as the behavior
it describes, and link to it from elsewhere instead of repeating it.

| Document | Owns |
| --- | --- |
| [README.md](README.md) | Project overview, current status, quick start, and links to the other documents. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commands, testing, conventions, configuration, secrets, deployment, CI, and the Git and pull request workflow. |
| [docs/architecture.md](docs/architecture.md) | Runtime boundaries, project layout, and how the parts fit together. |
| [AGENTS.md](AGENTS.md) | Instructions specific to coding agents: reading order, safety, and reporting. |
| Local `plan/word-games-build-plan.html` | Product rules, design, copy, build order, and the decision log. |

Executable configuration and source code are the final word on behavior; documents
describe it and link to it. Label planned work as planned.

[CLAUDE.md](CLAUDE.md) only imports `AGENTS.md`. Do not add rules to it.
