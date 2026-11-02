# Architecture

This document explains how the repository is organized and which code may depend
on which. For setup and workflow, see the [README](../README.md) and the
[contributor guide](../CONTRIBUTING.md). For current progress, see the README's
status line.

## Overview

Quibble is a React single-page app served by a Cloudflare Worker. The
Worker serves the built app as static assets and handles everything under `/api/*`.
Build-time Node tools generate puzzles and evaluate the judges; their output is
committed and shipped with the app or the Worker.

Code is split by where it runs:

| Folder | Runtime | Purpose |
| --- | --- | --- |
| `src/` | Browser | The React app. |
| `worker/` | Cloudflare Workers | The API and server-only data. |
| `factory/`, `eval/`, `scripts/` | Node, at build time | Puzzle generation, judge evaluation, and build checks. |
| `shared/` | All of the above | Platform-independent rules, schemas, and types. |

Each runtime has its own TypeScript environment, so browser, Worker, and Node APIs
cannot be mixed by accident.

## Project layout

```text
src/
  app/                 App entry and route tree
  scenes/              Top-level screens: home, library, and the shared game scene
  games/rounds/        Shared round reducer, play, round-end and results screens
  games/category-escape/  Level reducer, play and run-over screens
  games/double-agent/  Clues, guess map and round-word list
  judges/              Judge coordination; device/ holds the on-device judge
  components/          Shared UI components
  copy/en.ts           All visible and accessible text
  lib/                 API and sharing helpers; storage/ owns browser storage
  styles/              Design tokens, fonts, and base styles
shared/
  games/<game>.ts      Each game's rules and input limits
  schemas/             Zod schemas, types, and normalization
worker/
  index.ts             Worker entry and route table
  session.ts, judge-route.ts, reveal.ts   API routes
  judge.ts             Cloud model calls; read-answers.ts reads their replies
  library/             Server-only source data, bundled into the Worker
public/
  puzzles/             Generated, player-facing puzzle files
  eval/                Generated, public evaluation results
factory/
  generators/          Puzzle generation scripts
  reports/             Generation yield and spot-check reports
eval/
  verdict/             Python reference for the on-device judge
scripts/               Build verification utilities
tests/
  unit/                Unit tests, one folder per runtime
  e2e/                 Playwright browser tests
  fixtures/            Recorded responses and reference data for tests
docs/                  Project documentation
plan/                  Local build plan and design mocks; ignored by Git
```

Oddly Specific and Double Agent use `games/rounds/`; their configurations select
the input rules and game-specific UI. Category Escape has its own reducer for
immediate level progression and strikes across a run. Both reducers use the same
run shape, preserving the saved-progress format.

`scenes/game/GameScene.tsx` owns route validation and puzzle loading, with a fresh
loading state for each route. Game screens use `scenes/game/use-game-session.ts`
for local answer checks, judge coordination, form state, focus and progress saving;
reducers own scoring and progression. `GameTip`, `ResultActions` and `use-reveal`
share the first-round tip, result navigation/copy feedback and retryable reveals.
`lib/use-puzzle-index.ts` owns the puzzle-index loading lifecycle across scenes.

`scenes/home/HomeScene.tsx` is the welcome page: a hero action, game examples,
scoring and an expandable judge comparison. Judge setup stays in the Library and
Settings. `/` always opens Home, including for players with saved progress.
Home and the Quibble brand link to `/`; the Library is reached through its link or
“Choose a puzzle.” The Library keeps its numbered
grid, starts unplayed tiles directly, and retains replay/reset controls for saved
puzzles. Its first-puzzle prompt changes after any game has a completed puzzle
(with a saved best score, including zero); unfinished games keep the resume prompt.
The selected sidebar row and its supporting text use that game’s accent. Cloud
and local setup share a card style in the Library; the cloud picker uses the same
saved choice as Settings. On mobile these cards precede the Game Selector and its
tap-to-play hint; desktop keeps them in the sidebar. `library/GameRules` places a
native rules disclosure above the filters. Its worked examples use
`components/GameExample/`, also used by Home. Only active puzzle tiles show a
progress bar, based on finished rounds or cleared levels in the current saved run;
completed tiles show a green check while retaining their best score/perfect mark.

`scenes/game/RunReview` gives all three results screens expandable round/level
details: conditions, actual guesses and their accepted/rejected/overruled status,
and example answers. Unreached Category Escape levels stay distinct from misses.
It uses the current run without changing persistence. Examples load through
`use-reveal` only when a detail is first opened, stay available when re-opened, and
support retry on failure. Category Escape also retains its full example path.

`components/JudgesCompare/` is shared by Home and the results screens. Its source
buttons separate published answer-key accuracy from agreement in saved games.
The answer-key view keeps whole-answer accuracy and sample counts visible above
an expandable table, with development history and test methods below. On Home,
the introduction stays visible while a native disclosure holds the results, closed
by default; results screens show the comparison directly. Its model
selector previews published results without changing the playing judge; until a
preview is selected, it follows the saved cloud choice. `ComparisonTable` shares
the named columns across both sources. All figures come from the existing
published evaluation and saved comparison helpers; the component runs no models.

## Runtime boundaries and shared contracts

ESLint enforces these import rules:

- Browser and shared code cannot import Worker-only data, build-time tools, or the
  plan.
- Worker and shared code cannot import the React app.
- Worker code cannot import build-time tools.
- Game reducers cannot import React or Node APIs.

Within those boundaries:

- `shared/games/<game>.ts` is the single source of each game's rules and input
  limits. Do not duplicate them in `src/games/`.
- Reducers in `src/games/` are pure: no React and no I/O.
- Shared code stays independent of React and of platform-specific APIs.
- Every API body, puzzle file, and model response is validated with the shared Zod
  schemas.
- A player's answer is passed to a model as data in its state, never as part of its
  instructions.

The TypeScript configuration is strict, including exact optional properties,
explicit overrides, and per-file compilation checks. ESLint uses the same projects
for type-aware rules such as unhandled promises, unsafe use of unvalidated values,
and exhaustive switches.

`@/` resolves to `src/` and `@shared/` to `shared/` in TypeScript, Vite, Vitest,
and `tsx`.

## Routing and the Worker

The app uses [React Router in declarative mode](https://reactrouter.com/start/modes),
with the route tree in `src/app/App.tsx` and `BrowserRouter` mounted in
`src/main.tsx`. `components/SiteHeader/` sits above the routes, outside each scene's
frame. Home, Library, About and Settings stay in the same order on every page,
including game results and loading/error states. The Library link preserves the
current game type; Home uses `/`. Active links mark the
current section. Navigation remounts the settings control to close any open drawer.
Game headers contain puzzle progress and strikes rather than site navigation.
`components/SiteFooter/` follows the routes and shares Home’s tagline/copyright
layout across every page, including game results and error/loading states. Its
layout and typography are self-contained so shared text utilities cannot override
centering when the viewport exceeds the content width. About’s
build information stays in its Credits section.
Navigation opens the top of a page or its linked section (such as Privacy).
Clearing progress from Settings during a game returns to that game's Library,
unmounting the active run so it cannot save deleted progress again. Cloud model
changes apply to the next guess; existing verdict axes retain their original model.
Settings keeps its close button above a scrolling body, with Privacy at the end of
that body. A padded section around the referee fieldset keeps its legend spaced
consistently from the preceding divider.

[`wrangler.jsonc`](../wrangler.jsonc) sends only `/api/*` to the Worker; all other
requests are served from static assets, with the single-page app fallback for direct
loads and refreshes. Unknown API paths return a JSON 404. After a build, Wrangler
uses the generated deployment configuration under `dist/`.

For search engines, `public/robots.txt` points to `/sitemap.xml`, which
`vite.config.ts` builds from the puzzle index (Home, the Library and every puzzle).
Each scene sets its title and canonical URL through `src/app/use-page-meta.ts`, and
the not-found scene asks not to be indexed, since the fallback serves it with a 200.

`public/_headers` sets the content security policy on every page and static asset,
including the on-device judge's worker script, which takes its policy from its own
response. Scripts are self-hosted apart from Turnstile (`challenges.cloudflare.com`)
and Cloudflare Web Analytics' beacon (`static.cloudflareinsights.com`, D-69);
`'wasm-unsafe-eval'` lets onnxruntime compile its WebAssembly; `connect-src` allows
the model download from `huggingface.co` and its CDN hosts under `hf.co` (D-57).

The Worker is served only at `quibble.ronaldbalutiu.com`, as a Workers custom
domain; `workers.dev` and preview URLs are turned off so the app has a single
public origin. The `JUDGE_LIMIT` rate-limiting binding is declared there for the
judge route.

The Worker's routes, with request and reply schemas in `shared/schemas/judge.ts`:

| Route | File | Purpose |
| --- | --- | --- |
| `GET /api/health` | `worker/index.ts` | Returns `{"status":"ok"}`; used by the browser tests. |
| `POST /api/session` | `worker/session.ts` | Verifies a Turnstile token and sets an HMAC-signed, HttpOnly session cookie. |
| `POST /api/judge` | `worker/judge-route.ts` | Checks the session and input, applies the per-session rate limit, then asks the player's cloud model (Clef-flash or Gemma 4, via `worker/judge.ts`). |
| `GET /api/reveal/:game/:n/:roundId` | `worker/reveal.ts` | The round's example and up to two more known answers. |

Model replies are read by `worker/read-answers.ts`, which rejects anything that
isn't the exact recorded shape. The bundled library, `worker/library/library.json`,
is validated by `worker/library.ts` on first use.

## Styling

`src/styles/tokens.css` holds every design value, `fonts.css` imports the
self-hosted fonts, and `base.css` sets global styles. See
[styling and design tokens](../CONTRIBUTING.md#styling-and-design-tokens) for the
rules.

## Answer visibility

This is a public repository. Known answers and model questions are committed under
`worker/library/`, where anyone can read them. The owner has accepted this for a
casual, open-source game: these files are not secrets or an anti-cheat measure.

"Server-only" describes deployment, not confidentiality. The React app must not
import the answer library and `public/` must not contain it. It is bundled into the
Worker, and the API returns only what each endpoint is meant to return.

## On-device judge

The optional on-device judge runs Qwen3.5-0.8B (q4) on WebGPU in a module Web
Worker, `src/judges/device/worker.ts`. The game talks to it only through
`src/judges/device/client.ts`, which starts the worker on first use, follows a load,
and gives each guess a 10-second limit. `protocol.ts` defines the messages between
them.

- The model files download from Hugging Face at a pinned revision (`verdict.ts`),
  each into one buffer of its exact size (`download.ts`).
- The model is kept in memory for the current visit only. Files are fetched with
  `no-store` and never written to the Cache API, so closing the tab removes them.
- onnxruntime-web's WebGPU runtime is larger than the 25 MiB static asset limit.
  `vite.config.ts` ships it gzipped as `/ort/runtime.wasm.gz`, and the worker unpacks
  it.
- The device gate, `gate.ts`, offers the judge only to desktop browsers with a WebGPU
  adapter.
- `src/components/DeviceSetup/` is the setup sheet: the offer (S3), then the
  download (S4), whose rings, percentage and readout follow the worker's byte count.
- `src/components/JudgeSetup/` provides the Library's cloud model picker and inline
  local setup. The cloud choice is shared with Settings. `background-download.ts`
  owns a download started from the Library for the current visit, so navigation
  does not cancel it. Progress, warming, cancellation and failures stay visible in the
  Library; the in-game modal retains its own cancellation on dismissal. Both use
  the same device client and avoid starting another load while it is loading.
- During a guess, `src/scenes/game/judge-guess.ts` starts the on-device run next to
  the cloud request. The cloud judge is the referee; the device's result is shown but
  never scores. The cloud's scores are drawn as they arrive, but the guess moves on
  only once both judges are back, and the screen stays locked until then.
  When the cloud is out of usage (busy or resting) and the on-device judge is on, the
  device decides that guess with its own threshold, and nothing is compared (S1).
  With it off, a resting cloud shows S2, which offers the setup sheet on a capable
  device. A guess
  both judges answered is saved by `src/lib/storage/comparisons.ts` for "Your games"
  (at most 2,000 records and 500 KB, each kept 90 days).
- The referee is a setting, saved by `src/lib/storage/settings.ts` and read at the
  start of each guess. With the on-device judge as referee, its verdict scores and the
  cloud's is shown; if the cloud fails, only its column says so.
- `src/components/SettingsDrawer/` is the settings drawer (L3), opened from the shared
  site header: the referee choice and the on-device judge's Turn on / Turn off.
- `src/scenes/game/use-device-column.ts` gives each game screen the judge's status,
  the latest run and the puzzle's "agreed n / m". "Device • off" opens the setup
  sheet on a capable device.

## Python reference

`eval/verdict/` holds the Python reference implementation of the on-device judge.
It is build-time tooling that never runs in the browser or Worker; see its
[README](../eval/verdict/README.md) for scope and fixture locations. Model weights,
Python caches, and virtual environments are ignored by Git.

## Plan and design references

The local `plan/word-games-build-plan.html` owns product rules, design, copy, and
build order. The design mocks in `plan/word-games-mocks/` are references only. They
stay local and are never part of the build. Mocks may load external fonts; the app
bundles its own.

## Further reading

- [Vite guide](https://vite.dev/guide/)
- [Cloudflare's React single-page app tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
