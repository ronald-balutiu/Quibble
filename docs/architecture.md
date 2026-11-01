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
  games/<game>/        Each game's pure reducer and screen
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

The game folders are `oddly-specific`, `category-escape`, and `double-agent`.

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
`src/main.tsx`.

[`wrangler.jsonc`](../wrangler.jsonc) sends only `/api/*` to the Worker; all other
requests are served from static assets, with the single-page app fallback for direct
loads and refreshes. Unknown API paths return a JSON 404. After a build, Wrangler
uses the generated deployment configuration under `dist/`.

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
