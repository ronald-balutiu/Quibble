# Quibble

Three word games with open-ended answers. Two AI judges decide each answer.

The project brings together Oddly Specific, Category Escape, and Double Agent,
with a cloud judge and an optional on-device judge.

**Status:** the development foundation is ready. The planned URLs show placeholders;
gameplay, judging, storage, and puzzle generation are still to be implemented.

## Stack

React 19, TypeScript, Vite, React Router, plain CSS, and Cloudflare Workers.

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
