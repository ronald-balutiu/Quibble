# Repository Instructions

These instructions are for coding agents working in this repository. `CLAUDE.md`
imports this file, so every agent follows the same rules.

## Start of work

1. Run `git status`.
2. Read [README.md](README.md) for orientation, [CONTRIBUTING.md](CONTRIBUTING.md)
   for commands, conventions, and workflow, and
   [docs/architecture.md](docs/architecture.md) for structure and runtime boundaries.
3. Read the local `plan/word-games-build-plan.html` for product rules, design, copy,
   and build order. It is ignored by Git. If it is missing, stop and ask the owner
   rather than working from memory. Start with its status note at the top of 4.1,
   which says what is in progress, on which branch and worktree, and what comes
   next. Update that note when you finish a step, so another agent can continue.
4. Use the scripts in `package.json` instead of running their steps by hand.

Work through the plan's phases in order. Do not start a phase until the previous
phase's checklist passes, unless a decision in the plan's decision log allows it.

## Documentation

- Follow [documentation ownership](CONTRIBUTING.md#documentation-ownership). Update
  the owning document in the same change as the behavior, and link to it rather
  than repeating it.
- The plan's decision log (Appendix A) outranks the rest of the plan. Only the owner
  adds decisions; never edit an existing one.
- If the plan is wrong or incomplete, or two sources conflict, stop and ask the
  owner. Do not guess or fill the gap yourself.

## Working conventions

- Follow the [code conventions](CONTRIBUTING.md#code-conventions),
  [styling rules](CONTRIBUTING.md#styling-and-design-tokens), and
  [runtime boundaries](docs/architecture.md#runtime-boundaries-and-shared-contracts).
- Prefer existing patterns over new abstractions, and durable fixes over
  compatibility shims or temporary workarounds.
- Add or update tests when behavior changes; see [testing](CONTRIBUTING.md#testing).

## Verification

- Follow [verification](CONTRIBUTING.md#verification) before committing.
- A passing check stays valid for the same file contents. Do not rerun it just to
  commit or push.
- Never claim a check passed unless it ran to completion. Report failures and any
  checks that could not run.

## Safety

- Do not use `rm` or `rmdir`; use `trash` instead.
- If installing an npm package fails with a network error, stop and report it.
  Do not try other ways to install it.
- Ask for explicit confirmation before:
  - schema or persistence changes, destructive refactors, or irreversible data
    operations;
  - deploying by hand with `npm run deploy`. Merging to `main` also deploys
    (Cloudflare Workers Builds), so merge only work that is ready to go live;
  - running factory or eval scripts, which spend the Workers AI daily allowance.

## Git and pull requests

Follow the [Git workflow](CONTRIBUTING.md#git-workflow) and
[pull request guidelines](CONTRIBUTING.md#pull-requests). In particular:

- Start new work from the latest `origin/main`, and delete only branches whose pull
  request has been merged.
- Never commit directly to `main`, and never rewrite shared history.
- Use signed Conventional Commits.
