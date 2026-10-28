# Technically Correct

Three word games with open-ended answers. Two AI judges decide each answer.

This repository contains the development foundation: React 19, Vite, strict
TypeScript, plain CSS, and a Cloudflare Worker with static assets. The app is a
placeholder and the Worker exposes only `GET /api/health`. React Router matches
the planned URLs to placeholders. Static game settings are shared; reducers,
judges, storage, puzzles, and product screens are not implemented yet.

## Getting started

Use Node.js 24 or newer and npm. With nvm:

```sh
nvm use
npm ci
npm run dev
```

Development uses `http://127.0.0.1:5173`; production preview uses
`http://127.0.0.1:4173`. Both fail clearly if their port is already occupied.
`/api/health` on the same origin returns
`{"status":"ok"}` from the local Workers runtime. No Cloudflare login, secrets,
model downloads, or live AI calls are needed for local development.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run React and the Worker together with hot reload. |
| `npm run build` | Lint, typecheck, then build the client and Worker into `dist/`. Stops if either check fails. |
| `npm run preview` | Serve the production build locally after building. |
| `npm run typecheck` | Check browser, Worker, and Node tool code separately. |
| `npm run ts -- path/to/script.ts` | Run a Node TypeScript script through `tsx`, including `@shared/*` alias resolution. |
| `npm run lint` | Run JavaScript/TypeScript/React checks and CSS token checks. |
| `npm run lint:js` | Run ESLint only. |
| `npm run lint:css` | Run Stylelint only. |
| `npm run lint:fix` | Apply available ESLint/Stylelint fixes, then report remaining issues. |
| `npm test` | Run Vitest unit tests and tooling regression checks. |
| `npm run test:watch` | Watch unit tests during development. |
| `npm run test:e2e` | Build and run the browser/Worker smoke test at desktop and phone sizes. |
| `npm run check:assets` | Check built client assets against the 25 MiB per-file limit. |
| `npm run check:bundle` | Validate the built Worker with a Wrangler deployment dry run. |
| `npm run check` | Run all current non-browser checks and build validation. |
| `npm run deploy` | Build and deploy to Cloudflare using your authenticated account. |

Install Chromium once before running browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the build (including lint and typecheck), Vitest, asset
checks, and the Wrangler dry run on pull requests and pushes to `main`. Feature
branches are checked through their pull requests, avoiding duplicate push runs.
Browser tests can be
requested through the workflow's manual **Run workflow** option. Puzzle and
evaluation schema checks belong in CI when those files and validators exist.
CI cancels outdated runs, limits job duration, and retains browser failure
reports, screenshots, and traces for seven days.
The workflow's [`release-ci` job](.github/workflows/ci.yml) supplies the status
check required by the repository's `main` branch protection.

## Project layout

```text
src/
  app/                 App entry, React Router route tree, placeholder scenes
  scenes/
    home/              Home scene
    library/           Library scene
    game/              Shared game scene and states
  games/
    oddly-specific/    Future pure reducer and screen
    category-escape/   Future pure reducer and screen
    double-agent/      Future pure reducer and screen
  judges/
    device/            Future judge coordination and browser inference worker
  components/          Shared UI components
  copy/en.ts           Centralized visible copy
  lib/                 Future API and sharing helpers; storage/ owns raw localStorage access
  styles/              Plan tokens, bundled fonts, base styles
shared/
  games/               One rules/input configuration per game, shared across runtimes
  schemas/             Future shared Zod contracts, types, normalization
worker/
  index.ts             Health route; future session, judge, and reveal routes
  library/             Public source data used only by the Worker; excluded from static assets
public/
  puzzles/             Future generated player-facing puzzle files only
  eval/                Future generated public evaluation results
factory/
  generators/          Future build-time puzzle scripts
  reports/             Future yield and spot-check reports
eval/
  verdict/             Reserved Python reference location (reference.py), documented here
tests/
  unit/
    app/               Browser/React units, checked with browser types
    worker/            Worker units, checked with Cloudflare types
    shared/            Tests for shared/ source code, checked with Node types
    tooling/           Lint, CSS-token and script-runner regressions, checked with Node types
  e2e/                 Playwright smoke test
  fixtures/
    clef/              Future recorded cloud responses
    verdict/           Future model reference/parity data
    node/              Runtime import fixture for the TypeScript script runner
scripts/               Build verification utilities
plan/                  Local implementation plan and reference mocks, excluded from Git
```

Empty directories are tracked with `.gitkeep` files. `@/` resolves to `src/`;
`@shared/` resolves to `shared/` in TypeScript, Vite, and Vitest. Browser, Worker,
and Node code use separate TypeScript environments. Keep game reducers pure and
shared code independent of React and platform-specific APIs.

## Plan and design references

The local source of truth is `plan/word-games-build-plan.html`. Follow its phase
order and decision log when implementation starts. This scaffold is only the
setup portion of Phase 0; live model checks, parity experiments, domain setup,
and deployment are still outstanding.

The reference mocks live only in `plan/word-games-mocks/`, alongside the plan.
They stay local, are ignored by Git, and are excluded from the application build
(decision D-36). Preview mocks use external fonts; the app bundles Geist and
Geist Mono through Fontsource. `src/styles/tokens.css` reproduces §5.2 of the plan.
Add the remaining §5.7 copy keys as their screens are implemented.

## Documentation maintenance

Keep documentation changes in the same change as the code they describe:

- This README owns setup, commands, configuration, project layout, and deployment.
- The local plan owns product rules, design, copy, build order, and the decision log.
- [`AGENTS.md`](AGENTS.md) owns repository conventions, agent workflow, and verification
  expectations. [`CLAUDE.md`](CLAUDE.md) only imports it, so every coding agent reads the same rules.

The executable configuration in `package.json`, CI workflow files, and source code remains the
source of truth. Keep details in their owning document and link to them elsewhere.

## What the setup files do

| File | What it does and why it is here |
| --- | --- |
| `package.json` | Declares dependencies, the required Node version, and commands such as `dev`, `build`, and `test`. |
| `package-lock.json` | Records the exact dependency tree so `npm ci` installs the same versions on another machine or in CI. Commit it. |
| `index.html` | The browser's HTML entry point. Provides the root element where React mounts. |
| `vite.config.ts` | Connects React and the local Cloudflare runtime, configures import aliases, and blocks serving local plan/secret files. |
| `wrangler.jsonc` | Cloudflare's Worker entry point, compatibility date, static asset handling, and logging settings. |
| `tsconfig.json` | Coordinates the three TypeScript environments when running `tsc -b`. |
| `tsconfig.base.json` | Shared strict compiler rules and import aliases. |
| `tsconfig.app.json` | Browser and React types for `src/`, shared code, and app unit tests. |
| `tsconfig.node.json` | Node types for build configuration, shared/tooling tests, E2E orchestration, and future factory/evaluation scripts. |
| `tsconfig.worker.json` | Cloudflare types for backend, shared code, and Worker unit tests. |
| `eslint.config.js` | Checks JavaScript, type-aware TypeScript, React hooks, exhaustive switches, and platform import boundaries. |
| `stylelint.config.js` | Requires tokens for CSS color, type, spacing and fixed measurements; allows definitions in tokens.css. |
| `vitest.config.ts` | Finds app/Worker/shared/tooling unit tests, isolates mocks, and limits test duration. |
| `playwright.config.ts` | Starts a production preview and runs browser tests at the plan's desktop and phone sizes. |
| `.github/workflows/ci.yml` | Runs checks automatically on GitHub; browser tests are available on demand. |
| `.gitignore` | Keeps local plans, secrets, dependencies, builds, caches, and test output out of Git. |
| `.nvmrc` | Selects Node 24 when using `nvm use`. |
| `.editorconfig` | Keeps indentation, encoding, and line endings consistent across editors. |
| `.env.example` | Empty template for future local factory/evaluation credentials. |
| `.dev.vars.example` | Empty template for future local Worker secrets. |
| `public/.assetsignore` | Prevents directory marker files from being uploaded as public Cloudflare assets. |
| `scripts/check-assets.mjs` | Checks built assets against Cloudflare's 25 MiB per-file limit. |
| `tests/e2e/scaffold.spec.ts` | Confirms that React mounts, the Worker health endpoint responds, and unimplemented API paths return JSON errors. |
| `.gitkeep` files | Empty markers that let Git preserve folders until real files are added. Remove each marker when its folder has content. |
| `README.md` / `LICENSE` | Setup documentation and the project's Apache 2.0 license. |
| `AGENTS.md` / `CLAUDE.md` | Repository conventions and workflow for coding agents; `CLAUDE.md` imports `AGENTS.md`. |

`src/main.tsx` mounts React inside `BrowserRouter`; `src/app/App.tsx` defines the
route tree and `src/app/Scaffold.tsx` supplies the placeholder for each route;
`src/copy/en.ts` holds its text. `src/styles/` holds the exact plan tokens,
self-hosted font imports, and base CSS. `worker/index.ts` currently handles only
health checks and a JSON 404 response.

The separate TypeScript configs keep browser, Node, and Cloudflare APIs from
being mixed accidentally. Linting, testing, and CI files provide the checks
specified by the plan; they do not add features to the app.

`node_modules/` contains installed dependencies, `dist/` contains generated
production output, and `.wrangler/` contains local Cloudflare state. They are
generated and ignored by Git. Test reports and caches are ignored too.

## Configuration

`npm run build` runs lint first, then TypeScript, then Vite. Lint errors or
warnings stop the build. `npm run check` adds unit tests, asset-size validation,
and the Wrangler dry run without repeating lint or typecheck.

TypeScript checks optional fields precisely, rejects missing return paths and
implicit overrides, and checks compatibility with Vite's per-file compilation.
ESLint uses the same TypeScript projects as the editor to catch unhandled
promises, unsafe use of unvalidated values, and missing union cases in switches.
Use `import type` for type-only imports. Browser/shared modules cannot directly
import server-only Worker data, factory/evaluation tools, or the plan. Worker
and shared modules cannot import the React app; reducers cannot import React
or Node APIs.

Accessibility lint uses `eslint-plugin-jsx-a11y-x`, the ESLint 10-compatible
community fork of JSX a11y. `react/jsx-no-literals` rejects literal JSX children,
including string expressions. Literal text in accessibility labels, titles,
alt text, and placeholders is rejected too; read it from `src/copy/en.ts`.
Structural props such as `className`, route paths, and `data-*` may be strings.
Inline `style` props are banned on DOM elements (`react/forbid-dom-props`) and
wrapper components (`react/forbid-component-props`). Rebuild mock styles in CSS
using tokens rather than copying their inline style objects.

No application style exceptions are currently enabled. A real runtime value,
such as S4's measured progress, may use a single-site disable of the applicable
`react/forbid-*-props` rule with a reason. Independent syntax guards still require
an explicit object of literal `--custom-property` keys, prohibit spreads/opaque
style objects, and reject direct static values. A TypeScript `as CSSProperties`
or `satisfies` wrapper is allowed around that object. Review still confirms that
referenced variables are truly runtime data; static design values belong in CSS.
For example, when S4 is implemented:

```tsx
// eslint-disable-next-line react/forbid-dom-props -- S4 progress is measured at runtime; CSS owns its visual treatment.
<div style={{ '--download-progress': progress } as CSSProperties} />
```

Do not disable the independent custom-property syntax guards or add a file-wide
inline-style exception. Import `CSSProperties` as a type where this pattern is used.

Raw `localStorage`, `window.localStorage`, and `globalThis.localStorage` access
is restricted to `src/lib/storage/`, where guarded helpers will be implemented.
These checks catch direct syntax; code review still verifies that dynamic copy
comes from the catalog and that storage helpers handle errors.

The dev-only React plugin currently declares support through ESLint 9. We use
ESLint's `@eslint/compat` adapter and a scoped peer override for its copy rule
under ESLint 10. Regression tests exercise both valid copy and rejected literals;
the accessibility plugin declares native ESLint 10 support. The additional dev
tools enforce the plan's accessibility/copy rules without changing app behavior.

Vitest restores mocks and stubbed globals/environment variables between tests.
Unit tests have a five-second timeout; use fake timers for the judges' longer
timeouts. Focused tests (`test.only`) are rejected in CI. Playwright uses isolated
browser contexts, bounded actions/navigation, and saves screenshots and traces
when tests fail. Browser inference workers will be built as ES modules.

Unit tests live in `tests/unit/app`, `tests/unit/worker`, `tests/unit/shared`, or
`tests/unit/tooling`. App and Worker tests use their matching TypeScript configs;
shared and tooling tests use the Node config. The shared folder tests `shared/`
source; lint configuration and script-runner tests belong in tooling. Pure Worker
handlers/parsers can run in Vitest's Node environment; tests using actual
Cloudflare bindings will need the Workers runtime integration. Do not put Worker
tests in the shared/Node test folder.

Use `npm run ts -- factory/some-script.ts` or `npm run ts -- eval/some-script.ts`
when those scripts exist. `tsx` reads `tsconfig.node.json` so `@shared/*` works at
runtime as well as during typecheck. A runnable check is:

```sh
npm run ts -- tests/fixtures/node/imports.ts
```

`shared/games/<game>.ts` owns input limits and rules for browser, Worker, and Node
tools. UI reducers and screens import these settings; do not create a duplicate
`src/games/<game>/config.ts`.

All colors, typography, spacing, and fixed component measurements use tokens
from `src/styles/tokens.css`. It includes responsive `--type-*` roles, font
weights/line heights/tracking, a `--space-*` scale, and layout tokens such as
`--panel-pad`, `--header-height`, and `--target-min`. Add new approved values there
before using them in components. Structural layout keywords, zero resets, fluid
sizing and the media-query breakpoint are exceptions. Fontsource bundles real Geist 300,
400, 500, 700 and Geist Mono 400, 700; use `--weight-bold` for bold numbers.

Stylelint enforces this in every `src/**/*.css` file during `npm run lint` and
therefore during `npm run build`. The rules require complete values built from
`var()` references, so mixed values such as `padding: var(--space-1) 12px` and
raw fallbacks such as `color: var(--text, red)` are rejected too. Literal token
definitions belong only in `src/styles/tokens.css`. The configuration uses
Stylelint's built-in allowed-value and allowed-unit rules; no custom lint plugin
is needed. Position offsets (`top/right/bottom/left`) require tokens or structural
values. Grid templates allow structural counts, `%` and `fr`, but fixed track
lengths (including in `repeat()`/`minmax()`) require tokens. Transition/animation
durations and delays use `--t-*` tokens, including in shorthands and fallbacks.
Transform/translate lengths require tokens, while relative percentages, angles
and unitless scale factors remain geometry. Matrix translations have implicit
pixel units, so complete matrices must live in tokens rather than component CSS.
Prefer longhands when a complex shorthand cannot be expressed with the allowed
tokens/structural keywords. Token calculations belong in the token file.

The 44px minimum target applies to native controls and explicit `.control-link`
action links. Ordinary text links retain their inline layout; standalone link
components must opt into `.control-link` or provide the same minimum target.

Routing uses [React Router's declarative mode](https://reactrouter.com/start/modes).
`/`, `/play`, `/play/:game/:n`, `/about`, and the catch-all are registered in
`src/app/App.tsx`. They display placeholders until their product scenes are built.
Puzzle/game parameter validation and scene transitions belong to those later
phases. Cloudflare's SPA fallback serves direct URL loads and refreshes.

`wrangler.jsonc` configures SPA asset handling and sends only `/api/*` to the
Worker. The AI/rate-limit bindings and custom domain are deferred to the Phase 0
account checks. The current scaffold runs without them. After building, Wrangler
uses the generated deployment configuration under `dist/`.

When needed, copy `.dev.vars.example` to `.dev.vars` for local Worker secrets,
and `.env.example` to `.env` for future factory/evaluation credentials. Both
local files are ignored. Never put secrets in `VITE_*` variables, which are
exposed to the browser. Production secrets belong in `wrangler secret`.

Model runtimes and the tokenizer will be added when the on-device spike begins;
the baseline does not download or initialize models. Keep runtime dependencies
within the plan's stack and stay on the Workers Free plan.

The development dependency override keeps Miniflare's `undici` on the patched
7.30.1-or-newer release in the same major version until Cloudflare's plugin
updates its pinned tooling.

## Answer visibility

This is a public source repository. Generated known answers and model questions
will be committed under `worker/library/`, where anyone can inspect them on
GitHub. The owner has explicitly accepted public solution data for this casual,
open-source portfolio game. These files are not secrets or an anti-cheat measure.

"Server-only" describes deployment: the React app must not import the complete
answer library and `public/` must not contain it. It is bundled into the Worker,
and the judge/reveal endpoints return their intended responses. Keeping data out
of static assets does not make it confidential in a public Git repository.

## Python reference

The canonical Verdict reference will live at `eval/verdict/reference.py`.
[Its scope and fixture locations](eval/verdict/README.md) are documented now;
the Python inference adapter and pinned requirements will be implemented in the
Phase 0 model spike. It is build-time tooling and never runs in the browser or
Worker. Model weights, Python caches and virtual environments are Git-ignored.

Tooling references: [Vite](https://vite.dev/guide/) and
[Cloudflare's React SPA setup](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).
