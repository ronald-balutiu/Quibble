# Quibble

Three word games with open-ended answers. Two AI judges decide each answer.

The project brings together Oddly Specific, Category Escape, and Double Agent,
with a cloud judge and an optional on-device judge.

Live at [quibble.ronaldbalutiu.com](https://quibble.ronaldbalutiu.com).

- **Oddly Specific:** name one thing that fits three conditions.
- **Category Escape:** stay in a category as each level adds a rule.
- **Double Agent:** find one word with two meanings.

Every answer is judged condition by condition. The cloud judge is Clef-flash, or
Gemma 4 if the player chooses it, on Cloudflare Workers AI. The optional on-device
judge is Qwen3.5-0.8B running in the browser on WebGPU. Players can overrule a
rejection, and "How the judges compare" sets the judges' agreement on the player's
own games beside their accuracy on an answer-key test.

**Status:** complete. 256 puzzles (100 Oddly Specific, 100 Category Escape and 56
Double Agent), generated offline within the Workers AI free tier. On the held-out
answer-key test, run once, Gemma 4 judged 93% of whole guesses right and Clef-flash
81%; see the [about page](https://quibble.ronaldbalutiu.com/about) for the full
results and their limits.

## Stack

React 19, TypeScript, Vite, React Router, plain CSS, and Cloudflare Workers with
Workers AI. The on-device judge runs on ONNX Runtime Web (WebGPU) in a Web Worker.
Node scripts generate the puzzles and evaluate the judges at build time.

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

## Build and verify

```sh
npm run build    # Lint, typecheck, and build
npm run preview  # Serve the production build
npm run check    # Build, unit tests, asset limits, and deployment dry run
```

For browser tests, the full command list, configuration, and deployment, see the
[contributor guide](CONTRIBUTING.md).

## Documentation

- [Contributor guide](CONTRIBUTING.md): commands, testing, conventions,
  configuration, deployment, and the Git and pull request workflow.
- [Architecture](docs/architecture.md): runtime boundaries, project layout, and how
  the parts fit together.
- [Agent instructions](AGENTS.md): reading order, safety, and reporting rules for
  coding agents.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Ronald Balutiu.
