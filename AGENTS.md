<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Multi-Agent Workflow

Work is done by one **Coordinator** and several **Coder** agents running in parallel. The Coordinator plans, architects, and reviews; Coders implement.

## Roles

### Coordinator (planner, architect, reviewer)

The Coordinator never implements feature code itself. It:

1. **Plans** — reads the request and the relevant code, then breaks the work into tasks.
2. **Architects** — decides file layout, component/module boundaries, shared types, and interfaces *before* any Coder starts, so Coders don't have to guess or collide.
3. **Dispatches** — launches Coders in parallel (one message, multiple Agent calls) with a self-contained brief each.
4. **Reviews** — reads every Coder's diff, checks it against the plan and the conventions below, runs verification, and sends fixes back (via SendMessage to the same Coder) until it passes.
5. **Integrates** — resolves cross-task issues, runs the final typecheck/lint/build, and reports to the user.

### Coder

Each Coder owns one task and implements exactly that. It:

- Edits **only** the files listed in its brief (its "ownership set").
- Follows the interfaces and types the Coordinator specified; does not redesign them.
- Runs `npm run typecheck` and `npm run lint` on its work before reporting.
- Reports back: files changed, anything deviating from the brief, open questions. It does not commit.

If a Coder needs a change outside its ownership set, it stops and reports it rather than making the edit.

## Parallel execution rules

- **Decompose by file ownership.** Two Coders must never edit the same file. If tasks overlap, the Coordinator merges them or sequences them.
- **Contracts first.** Shared types, props, route shapes, and exported function signatures are defined by the Coordinator up front (in the briefs, or in a small stub file it writes itself) so parallel Coders build against the same contract.
- **Parallel by default, sequential only on real dependencies.** Independent tasks launch together in a single message. A task that needs another's output waits for it.
- **Use worktree isolation** (`isolation: "worktree"`) when tasks touch adjacent files or run builds that could interfere with one another.
- **Keep it proportionate.** Trivial or single-file changes: the Coordinator does them directly, no Coders. Typically 2–5 Coders; more only when tasks are truly independent.

## Task brief template

Every Coder brief must be self-contained (the Coder has no other context):

```
Goal:        one sentence on what and why
Files owned: exact paths to create/edit (and nothing else)
Contract:    types / props / signatures to implement or consume
Context:     files to read first, conventions that apply
Constraints: what NOT to do (e.g. don't touch X, don't add deps)
Done when:   concrete acceptance criteria + commands to run
Report:      files changed, deviations, open questions
```

## Review checklist (Coordinator)

- Matches the plan and the contract; nothing outside the ownership set changed.
- Follows existing code style and the project conventions (Next.js 16 docs, shadcn/Base UI components in `components/`, Tailwind 4, `cn` helper in `lib/`).
- No new dependencies, dead code, or leftover debug output unless the plan called for them.
- `npm run typecheck`, `npm run lint`, and (for integration) `npm run build` pass.
- Edge cases and error/empty/loading states handled where the task touches UI or data.
- Diffs from different Coders fit together — imports resolve, shared contracts are honored.

## Rules for all agents

- Read `node_modules/next/dist/docs/` before writing Next.js code (see above); do not rely on memory of older Next.js versions.
- Design references live in `handoff/`; consult them for UI work.
- Never commit, push, or modify git state unless the user asks; only the Coordinator may do so, and only on request.
- Prefer editing existing files over creating new ones; match surrounding style.
