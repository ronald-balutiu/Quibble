# Repository Instructions

## Project Overview

Technically Correct is three word games whose answers are judged by AI. One repository holds a
React 19 + Vite app and a Cloudflare Worker, with code split by runtime:

- `src/`: the browser app.
- `worker/`: the Cloudflare Worker API.
- `factory/`, `eval/` and `scripts/`: Node build-time tools.
- `shared/`: platform-independent code used by all of them.

Each runtime has its own TypeScript config, and lint enforces the import boundaries between them.

## Start of Work

1. Run `git status`.
2. Read `README.md` for setup and verification, and the local plan at
   `plan/word-games-build-plan.html` for product rules, design and build order. The plan is
   gitignored; if it is missing, stop and ask the owner rather than working from memory.
3. Use the scripts in `package.json`; do not duplicate their steps manually.

## Key Commands

- `npm run dev`: run the app and Worker locally.
- `npm run check`: lint, typecheck, unit tests, build and deploy dry run.
- `npx vitest run tests/unit/worker/entry.test.ts`: run one unit test file.
- `npx playwright test tests/e2e/scaffold.spec.ts --project=desktop`: run one browser test at one
  size.

## Documentation

- The plan owns product rules, design, copy and decisions; its Appendix A decision log outranks
  everything else in it. Only the owner adds decisions; never edit an existing row.
- `README.md` owns setup, commands, configuration, layout and deployment. `AGENTS.md` owns
  repository conventions, agent workflow and verification expectations.
- Update the owning document in the same change as the behavior it describes. Link to executable
  configuration or another document instead of repeating its details.
- If the plan is wrong, missing something, or two sources conflict, stop and ask the owner. Do not
  guess or fill the gap yourself.

## Project Conventions

- Work phase by phase as the plan's section 4.1 describes; do not start a phase until the previous
  phase's checklist passes.
- Keep game rules and input limits in `shared/games/<game>.ts`. Keep reducers in `src/games/` pure:
  no React and no I/O.
- Validate every API body, puzzle file and model response with the shared Zod schemas.
- Read all visible and accessible text from `src/copy/en.ts`, using the keys from the plan's
  section 5.7.
- Put design values in `src/styles/tokens.css` before using them. Component styles use tokens only;
  no inline `style` values, except custom properties for runtime values (for example
  `style={{ '--progress': p }}`).
- Keep known answers in `worker/library/`, imported only by Worker code, never by the app or
  `public/`. A player's answer is data in the model's state, never part of its instructions.
- Never commit secrets. They belong in `wrangler secret`, `.dev.vars` and `.env`.
- Prefer existing patterns over new abstractions, and durable fixes over compatibility shims or
  temporary workarounds.
- Add or update tests when behavior changes. New logic gets unit tests in the `tests/unit/` folder
  matching its environment; a new screen or state gets a Playwright test that reaches it.

## Verification

- Use the smallest relevant command from [README Commands](README.md#commands) while iterating.
- Before committing application, dependency, configuration or test changes, run `npm run check`.
  Run `npm run test:e2e` as well when screens, routing or the Worker change.
- For documentation-only changes, verify local links and compare documented commands and behavior
  with the source. Application tests are unnecessary unless the change also affects executable
  files.
- A passing gate remains valid for the same file contents; do not rerun it solely to commit or push.
- Never claim a check passed unless it completed; report failures and checks that could not run.

## Formatting and Naming

- Follow the repository ESLint, Stylelint and EditorConfig configuration.
- Use PascalCase for React component filenames and kebab-case for CSS files and game IDs.
- Use `import type` for type-only imports and the `@/` and `@shared/` aliases across folders.

## Safety

- Do not invoke `rm` or `rmdir`; use `trash` for cleanup instead.
- If an npm package installation fails because of a network error, stop and report it rather than
  trying alternative installation approaches.
- Ask for explicit confirmation before schema or persistence changes, destructive refactors,
  irreversible data operations, and deploys. Also confirm before factory or eval runs, which spend
  the Workers AI daily allowance.

## Git and Change Hygiene

- Keep changes focused and reviewable.
- Do not commit directly to protected `main`. When starting new work:
  1. Run `git fetch --prune`.
  2. Delete local branches whose pull request has been merged; `git branch -vv` marks their remote
     as `gone`. Never delete a branch whose pull request is still open or unmerged.
  3. Branch from the latest `origin/main`.
- Before merging, update the branch from the latest `origin/main` again.
- Use signed Conventional Commits.
- Do not rewrite history.
- Do not commit generated output such as `dist/`, `.wrangler/`, `node_modules/`, coverage, test
  results, or Playwright artifacts. Never commit the `plan/` folder.

## Pull Requests

- Title the pull request as a Conventional Commit, e.g. `feat(worker): add judge route`.
- In the description, summarise the change and list the checks that ran, plus any that could not
  run and why.
