# Development

Cognition uses Claude Code / Codex skills, Markdown instructions, one read-only
SessionStart hook, and three small commands — `status`, `pause`, and `reset` —
all written in TypeScript and compiled to plain Node.js. There are no runtime
npm dependencies; `typescript`, `@types/node`, and `tsx` are devDependencies
used only to build and test the plugin.

Four registered commands exist: `learn` (onboarding and resume, almost
entirely Markdown-driven — see `skills/learn/`), and `status`, `pause`, and
`reset` (each a thin Markdown skill wrapping one deterministic TypeScript
helper under `src/skills/<name>/`, so their core logic has unit tests
independent of how an agent phrases the result).

## Setup

```sh
npm install
npm run build      # compiles src/ to dist/, which hooks.json and the skills call
```

`dist/` is committed to this repository on purpose, not gitignored. Anyone
installing the plugin — via `--plugin-dir` or a marketplace — gets working
code immediately, without a Node/TypeScript toolchain. That means a source
change isn't done until you've rebuilt and committed `dist/` alongside it;
a PR that touches `src/` without a matching `dist/` update leaves the
installed plugin running stale code.

## Local checks

```sh
npm run typecheck   # tsc --noEmit over src/
npm test            # runs the unit test suite with Node's built-in test runner
npm run build       # compiles src/ to dist/
```

The test suite (`tests/`) exercises the hook's and the reset command's actual
logic against real temporary directories — no mocked filesystem layer, except
for two tests that simulate a disk write failure mid-backup by patching the
`node:fs` module's own `writeFileSync`/`renameSync`, which this project's
source files reference through a literal `require` binding (`import fs =
require("node:fs")`) specifically so such a patch is visible to the code under
test. They cover activation, restoration, partial onboarding, paused mode,
subdirectories, repository/worktree boundaries, missing/invalid files, symlinks,
constant-size restoration instructions as notes grow, and read-only behavior.
They do not prove that the agent follows the instructions or teaches well.
Reset tests cover read-only preview, confirmed backup/reset, stale confirmation,
partial notes, nested projects, repeated backups, rejected symlinks,
backup/write failures, and restoring incomplete onboarding after reset.

## Conversation smoke tests

Use an authenticated Claude Code session and temporary copies of projects.
Launch with `claude --plugin-dir /absolute/path/to/cognition` after running
`npm run build`.

1. **Fresh project:** Run `/cognition:learn`. Choose a new project, describe
   a small CLI, and accept preference defaults. Check that all three state files
   are created, the map separates proposed from implemented components, and no
   understanding is marked demonstrated without evidence. Choice questions must
   use native pickers with one question per screen; no questionnaire dump or
   failed shell check for a missing state directory.
2. **Existing unfamiliar repository:** Use a separate copy of a real repository.
   Choose the existing-repository flow. Confirm the agent reads actual entry
   points and configuration, gives an accurate short map before familiarity
   questions, asks whole-system versus focused scope, and doesn't invent a
   frontend/database.
3. **Checkpoint → implementation:** Ask for a meaningful feature, such as durable
   storage or retrying an external request. Confirm the agent asks one reasoning
   question under a title naming the decision, before suggesting its own solution
   or implementing the decision. Give a partial answer; check that
   it refines the answer, names the coding scope in an Implementation checkpoint,
   and offers Implement this step / Discuss. Select Discuss,
   ask for clarification or propose an alternative, and confirm it stays
   paused and updates the approach if needed. Select Implement this step;
   check it writes the code and records only evidenced learning. Restart while a
   confirmation is pending and confirm it preserves that pause.
4. **Skip and adaptation:** Say "I'm completely lost." Confirm the agent explains
   the relevant pieces and returns one manageable reasoning step, without dumping
   a complete plan or repeatedly demanding guesses. Ask for an explanation or say
   "skip"; it should explain and proceed to a Design checkpoint without demanding
   another attempt. "Just implement it" should proceed. Make a trivial edit and
   confirm no checkpoint. After demonstrating a concept, check that later
   questions address new decisions rather than repeat it.
5. **Lifecycle:** Restart, resume, `/clear`, and `/compact`. Confirm preferences,
   the map, and mastered concepts survive without repeated onboarding. Pause
   learning, restart, and confirm it stays paused; invoke Learn to resume.
6. **Reset:** In a temporary project with saved learning notes, invoke
   `/cognition:reset`. Confirm it shows the absolute project and state paths and
   asks Cancel / Reset learning. Cancel must leave all files unchanged. Invoke
   again and confirm: original notes must exist in the reported backup, the
   active profile must be incomplete, and onboarding must ask fresh questions
   rather than reuse old preferences. Repeat after restart. If notes change
   during confirmation, the agent must preview and confirm again.

Do not commit `.cognition/` or test transcripts. The plugin recommends an
ignore rule during onboarding, but changes `.gitignore` only after telling the
user and receiving their instruction to make the edit.

## Design notes

- [Plugin creation](https://code.claude.com/docs/en/plugins/create): standard
  component directories and `--plugin-dir` for local loading.
- [Skills](https://code.claude.com/docs/en/skills): the command is
  `/cognition:learn`. Explicit invocation starts onboarding; the hook restores
  behavior in later sessions only where a learner profile already exists.
- [Hooks](https://code.claude.com/docs/en/hooks): `SessionStart` sources include
  `startup`, `resume`, `clear`, `compact`, and `fork`. The hook emits a small
  `hookSpecificOutput.additionalContext` pointing to the Learn guide and selected
  state directory. It checks the profile for paused mode without a prefix cutoff,
  but injects no learner-note excerpts or partial progress index. The agent must
  read the profile/map, search all of progress for pending decisions, and read
  the complete pending sections plus relevant topics before continuing. Hook
  output does not grow with learning history; subsequent file reads still
  consume context.

No `PreCompact` hook is needed: it doesn't provide an opportunity to save
learning notes through `additionalContext`. Save notes at meaningful events and
restore them through `SessionStart` with source `compact`. Unsaved reasoning can
still be lost if a session ends before the agent writes it; the hook doesn't
infer progress from transcripts. State writes are performed by the agent using
normal permissions, so denied writes should be reported rather than called saved.

Kept local and terminal-native: no backend, analytics, accounts, separate LLM
calls, scoring engine, or custom UI. Saved context is processed by Claude Code
or Codex under the user's existing data settings.

### Why TypeScript instead of a scripting language

The hook and reset command only need to run once per session start and once per
reset invocation, so performance isn't the driver. TypeScript was chosen because
it ships with real static types for the JSON-shaped data these scripts move
around (hook payloads, snapshot/reset results), and because `node` is already on
the machine of anyone running Claude Code's or Codex's own tooling. Both scripts
are plain CommonJS once compiled; nothing in `dist/` depends on a bundler or a
particular Node flag at runtime.
