<img src="assets/cognition-logo.jpeg" alt="Cognition — your mind is the architect" width="420" height="420">

# Cognition

**Your mind is the architect.** Reason through design, data flow, and failure modes before a single line of code is written.

A plugin for **Claude Code** and **Codex** that slows the agent down at the decisions that matter. It will not sketch a data model, pick a storage strategy, or scaffold an architecture until you've proposed one yourself. It pushes on weak spots, explains anything you don't recognize, and only starts writing code once you've said the design is ready. Afterward it tells you exactly what it built and why, so you can check its work against your own mental model — not just trust the diff.

Built for anyone who wants the thinking, not just the output: someone learning to program, a developer picking up an unfamiliar stack, or an experienced engineer who doesn't want "vibe coding" to quietly replace their own judgment.

## Table of Contents

- [Get started](#get-started)
  - [Claude Code](#claude-code)
  - [Codex](#codex)
- [Sharing it with other developers](#sharing-it-with-other-developers)
- [Install via npm, without the plugin system](#install-via-npm-without-the-plugin-system)
- [Commands](#commands)
  - [Setup and build](#setup-and-build)
  - [Session commands](#session-commands)
  - [Checkpoint responses](#checkpoint-responses)
  - [Spoken controls](#spoken-controls)
  - [The scripts underneath, if you need them directly](#the-scripts-underneath-if-you-need-them-directly)
- [How a session actually runs](#how-a-session-actually-runs)
- [Tuning it to you](#tuning-it-to-you)
- [Development](#development)
- [License](#license)

## Get started

Requires [Node.js](https://nodejs.org/) 22.6+ and a current [Claude Code](https://code.claude.com/docs/en/setup) or [Codex](https://developers.openai.com/codex) install. `dist/` — the compiled JavaScript the hook and reset command actually run — is checked into this repository, so a plain clone already works; you don't need to build anything just to use it.

You only need to run a build yourself if you're editing the TypeScript in `src/`:

```sh
npm install
npm run build
```

That compiles `src/` into `dist/`. If you change `src/`, rebuild and commit the updated `dist/` together with it — nothing re-runs that build for you on install.

### Claude Code

Point Claude Code at the plugin directory while you're working on it:

```sh
claude --plugin-dir /absolute/path/to/cognition
```

Or register it as a local marketplace source with `/plugin marketplace add`, then `/plugin install cognition@cognition`.

Restart Claude Code inside the project you want help with, then run:

```text
/cognition:learn
```

Onboarding asks one question at a time — arrow keys and Enter to answer, or pick **Use defaults** to skip straight to building. From there, describe what you want. A brand-new project and an unfamiliar existing codebase both work; for the latter, the agent reads the code first and sketches a short map of what it found before asking anything.

### Codex

Add this directory as a local plugin source and install it using Codex's own marketplace commands for a local path. Inside your project, run `$cognition:learn` to start. Run it again at the top of future sessions, or any time Codex seems to have forgotten it's in learning mode — it picks back up from your saved notes instead of re-running onboarding. `$cognition:reset` clears those notes and starts over. Claude Code and Codex read and write the same `.cognition/` folder, so switching tools mid-project doesn't lose anything.

Wherever this guide shows a `/` command, use `$` in Codex instead.

## Sharing it with other developers

Nothing above requires a public listing anywhere — a marketplace here is just a pointer to a Git location, and that location can be anything your teammates can reach.

**Same team, private repo:** push this repository to GitHub (or wherever your team hosts Git), keeping it private if you want. Anyone with access runs:

```sh
/plugin marketplace add your-org/cognition
/plugin install cognition@cognition
```

That's it — no publishing step, no review, no public listing. The same shape of command exists for Codex (`codex plugin marketplace add your-org/cognition`), though it's worth double-checking the exact flags against `codex plugin marketplace --help`, since that surface is newer and less consistently documented than Claude Code's.

**Anyone, publicly:** make the GitHub repo public. The commands above still work for strangers, as long as they know (or you tell them) `your-org/cognition`. This is exactly how the project Cognition replaces distributed itself — a public GitHub repo plus `/plugin marketplace add <owner>/<repo>`, nothing more.

**Listed in Claude Code's official directory**, so people find it without already knowing the repo name, is a separate, optional step: a submission and review process for the curated marketplace Anthropic runs. Not needed unless you specifically want strangers discovering it without a link.

Either way, since `dist/` is committed, installing is immediate — no one needs Node's TypeScript toolchain, only a `node` runtime to execute what's already compiled.

## Install via npm, without the plugin system

If you'd rather not register a plugin marketplace at all, `npx @craiggazimbi/cognition init` vendors the same skill guides straight into the current project — `.claude/skills/cognition-*/` for Claude Code, `.agents/skills/cognition-*/` for Codex and other AGENTS.md-reading tools — and merges a `SessionStart` hook into `.claude/settings.json` if it detects Claude Code (a `CLAUDE.md` or an existing `.claude/`). It's safe to run more than once: anything already there is left alone and reported as kept, not overwritten.

```sh
npx @craiggazimbi/cognition init
```

Because these commands aren't a plugin, invocations are named `/cognition-learn`, `/cognition-pause`, `/cognition-reset`, `/cognition-status` (Codex: `$cognition-learn`, etc.) instead of the `cognition:`-namespaced form the plugin install uses. Everything else — the Learn/Pause/Reset/Status behavior, the shared `.cognition/` notes folder — is identical; only how the files got there differs. The vendored skills call the CLI directly (`npx @craiggazimbi/cognition pause --cwd ...`) instead of a `${CLAUDE_PLUGIN_ROOT}`-relative path, since there's no plugin root to resolve.

Every run of the CLI also checks npm once a day (cached under `~/.cognition/update-check.json`, never blocking) and prints a small notice if a newer version is out.

## Commands

Everything you'd actually type or say, in one place.

### Setup and build

Run these from the plugin's own directory. They're for building and testing Cognition itself, not something you run from inside a project you're learning in.

| Command | What it's for |
| --- | --- |
| `npm install` | Installs the devDependencies (`typescript`, `tsx`, `@types/node`) needed to build and test. Nothing here ships at runtime. |
| `npm run build` | Compiles `src/` to `dist/`. This is the output `hooks/hooks.json` and the skills actually run with `node` — re-run it after any source change. |
| `npm test` | Runs the unit test suite (`tests/`) with Node's built-in test runner. |
| `npm run typecheck` | Type-checks `src/` with `tsc --noEmit`, without emitting `dist/`. |
| `npm run clean` | Deletes `dist/`, in case you want a clean rebuild. |

### Session commands

Typed into Claude Code (`/`) or Codex (`$`), inside the project you want help with — not in the plugin's own directory. These are the only four registered commands; everything else in this reference is a picker option or plain language the agent interprets.

| Command | What it's for |
| --- | --- |
| `/cognition:learn` | Starts learning mode on a brand-new project, or resumes it from `.cognition/` notes already there. Run it once per session at the start, and again any time the agent seems to have drifted out of learning mode (after a long `/compact`, for instance). |
| `/cognition:status` | A quick, read-only check: current learning mode, onboarding state, saved preferences, and whatever's recorded as a pending decision — without running Learn's full resume flow. Doesn't write anything. Good for "where did I leave off?" without re-triggering onboarding logic. |
| `/cognition:pause` | Pauses learning mode immediately — the deterministic version of saying "pause learning." No confirmation step, since it's fully undone by running `/cognition:learn` again. Touches only the `Learning mode:` line; everything else stays exactly as it was. |
| `/cognition:reset` | Shows you what's saved for this project, then — only after you explicitly confirm — backs up the current profile, progress, and project map, and restarts onboarding from nothing. Doesn't touch your actual code. |

Installed via `npx @craiggazimbi/cognition init` instead of the plugin system? These aren't a plugin there, so the names are hyphenated instead of namespaced: `/cognition-learn`, `/cognition-status`, `/cognition-pause`, `/cognition-reset` (Codex: `$cognition-learn`, etc.). Same behavior either way — see [Install via npm](#install-via-npm-without-the-plugin-system).

### Checkpoint responses

These aren't typed commands — they're the options the agent actually offers you at a checkpoint or during a reset. Picking one (via the native picker, or by saying it) is what moves things forward.

| Response | Appears at | What it does |
| --- | --- | --- |
| **Confirm and continue** | Design checkpoint | Locks in the proposed design and moves to the next open question. Still writes no code. |
| **Implement this step** | Implementation checkpoint | Authorizes the agent to write the code just described. Also counts as confirming the design, if you hadn't separately. |
| **Discuss** | Either checkpoint | Asks questions or raises an objection before you commit to anything — the agent waits for your reply instead of proceeding. |
| **Cancel** | `/cognition:reset` confirmation | Backs out. Nothing changes, not even the notes. |
| **Reset learning** | `/cognition:reset` confirmation | Confirms the reset: originals get backed up, then onboarding starts over. |

### Spoken controls

Plain language, said at any point in the conversation — no special syntax. These tune how learning mode behaves without turning it off.

| Say this | To get |
| --- | --- |
| "Use fewer checkpoints." / "Use more checkpoints." | Light, Normal, or Frequent checkpoint frequency. |
| "Use multiple-choice questions." | Multiple-choice instead of open-ended reasoning questions. |
| "Focus on backend architecture." (or any area) | Narrows what the agent brings checkpoints to. |
| "Just implement this one." | Skips the checkpoint for one specific, trivial change. |
| "I'm stuck" / "skip" | Trades a reasoning question for an explanation or options, for that one step. |
| "Pause learning." | Same effect as `/cognition:pause` — suspends the whole loop — but as plain language instead of a command. |

Resume a paused session the same way you started one: `/cognition:learn`.

### The scripts underneath, if you need them directly

The agent calls these for you — through the hook on session start, and through the corresponding skill — so you shouldn't normally need to run them by hand. Documented here for completeness, and for debugging the plugin itself.

| Script | Invoked by | What it takes |
| --- | --- | --- |
| `dist/hooks/session-start.js` | The `SessionStart` hook, automatically. | A JSON event on stdin; prints restoration instructions or nothing. |
| `dist/skills/status/status.js` | The `/cognition:status` skill. | `--cwd <absolute path>`. Read-only; prints the parsed profile fields and any pending decision as JSON. |
| `dist/skills/pause/pause.js` | The `/cognition:pause` skill. | `--cwd <absolute path>`. Rewrites `Learning mode:` to `paused` in `profile.md`. |
| `dist/skills/reset/reset.js` | The `/cognition:reset` skill. | `--cwd <absolute path>` for a read-only preview; add `--confirm <token>` (from that preview's output) to actually reset. |

On an npm install, the vendored skills call the CLI directly instead of these scripts: `npx @craiggazimbi/cognition status --cwd <path>`, `... pause --cwd <path>`, `... reset --cwd <path> [--confirm <token>]`, and `... hook session-start` (reads a `SessionStart` event from stdin, same as the hook above). Same `--cwd`/`--confirm` contract either way.

## How a session actually runs

Say you're building a task tracker where one task can block another — you can't start "Deploy" until "Write tests" is done.

**You:**

```text
Tasks can depend on other tasks. A task shouldn't be startable until everything it depends on is finished.
```

**Agent:**

```text
✦ Build checkpoint: Finished-but-reopened dependencies

Say "Deploy" depends on "Write tests," and "Write tests" is marked done.
Someone later reopens "Write tests" because they found a bug.

Should "Deploy" still be allowed to run, or does reopening a dependency
block anything that was waiting on it?
```

**You:**

```text
Reopening should re-block anything downstream. I don't want someone shipping on top of a dependency that's no longer actually finished.
```

**Agent:**

```text
That means a task's "can I start" status isn't fixed once dependencies are
met — it has to be re-derived whenever a dependency's status changes.

✦ Design checkpoint: Representing dependencies

Proposed: a dependencies table storing (task_id, depends_on_task_id) pairs,
with no status duplicated onto the dependent task. A task is startable only
if every row where it's the task_id points at a task marked done. Reopening
a task doesn't need to touch anything downstream — the startable check just
re-reads the live status each time it's asked.

This avoids a cached "ready" flag going stale. We still need to decide what
happens to a dependency pointing at a task that gets deleted.

❯ 1. Confirm and continue
     This approach makes sense to me; move to the next piece.
  2. Discuss
     Ask questions or clarify anything that doesn't make sense before deciding.
```

**You:**

```text
Confirm and continue.
```

*After working through task deletion the same way...*

**Agent:**

```text
✦ Implementation checkpoint: Dependency tracking and startability

I'll add the dependencies table, the startable check that re-derives status
from live dependency rows, and cascade the agreed delete behavior. Then I'll
test: a task blocked by an unfinished dependency, one unblocked after that
dependency completes, and one that re-blocks after its dependency reopens.

❯ 1. Implement this step
     This approach makes sense to me; write the code for this step.
  2. Discuss
     Ask questions or clarify anything that doesn't make sense before deciding.
```

**You:**

```text
Implement this step.
```

**Agent:**

```text
✦ Implementation report: Dependency tracking and startability

- Added the dependencies table and the query that derives startable status
  from current dependency state, instead of a stored flag.
- Wired task reopening to simply stop short-circuiting that query — no
  write-time cascade needed, since status is always re-derived on read.
- Added and ran three tests: blocked-by-open-dependency, unblocked-on-
  completion, re-blocked-on-reopen. All three passed.
```

You never had to already know the answer. When a concept is new, the agent explains it and hands you back a smaller, concrete question instead of the whole design. You're still the one steering — answer in plain language, and say "skip" or ask for options whenever you actually want them.

What you describe sets the requirements, not the design. A Build checkpoint is where you work out the mechanism; stating a feature isn't the same as choosing how it's built.

| Checkpoint | What happens |
| --- | --- |
| **Build** | You work out the mechanism with the agent's feedback — no code, no architecture yet. |
| **Design** | The agent lays out the proposed structure and tradeoffs. **Confirm and continue** locks it in and moves to the next open question; still no code. |
| **Implementation** | The agent names the exact change it's about to make. **Implement this step** is what actually authorizes it to write code. |

These don't have to happen as three separate stops — several Build checkpoints can collapse into one Design confirmation, and confirming readiness to implement also counts as confirming the design if you haven't separately. Either confirmation offers **Discuss** first, for questions or pushback before you commit.

Once code is written, you get a short report: what changed, how the new code actually works, why it matches what you decided, what got tested (and what didn't), and the real result of running it — not just a claim that it works.

## Tuning it to you

More experience changes how much is explained, not who's allowed to decide:

| Level | What you get |
| --- | --- |
| Beginner | Concepts explained before they're used, small diagrams, narrower reasoning questions. |
| Intermediate | Less setup, more focus on how pieces interact and trade off against each other. |
| Advanced | Pressure-testing of constraints, edge cases, and assumptions you haven't stated. |

Everyone still reasons first — experience only changes the scaffolding around that, not whether it happens. Separately, you can turn checkpoints up or down:

- "Fewer checkpoints, please."
- "Multiple choice instead of open questions."
- "Just implement this one."
- "Pause learning," or just run `/cognition:pause`. Bring it back anytime with `/cognition:learn`, and check where things stand in between with `/cognition:status`.

All of this — preferences, what's been covered, a map of the project — lives in a `.cognition/` folder at your project root (or at the Git repository root if there is one; Cognition finds it from any subdirectory). It survives restarts, `/clear`, and compaction. Add `.cognition/` to `.gitignore` if you don't want it in version control — the plugin will suggest this during onboarding but won't touch `.gitignore` without telling you first and getting a yes.

Nothing here phones out: no account, no backend, no telemetry. Your saved notes become part of the agent's context the same way any other file you ask it to read would, so whatever data settings you already have for Claude Code or Codex apply unchanged.

`/cognition:reset` starts a project over. It shows you exactly what it's about to touch, asks **Cancel** or **Reset learning**, and on confirmation moves your current profile, progress, and project map into a `backups/` folder before generating fresh ones. Nothing outside `.cognition/` is touched. You don't need a reset just to change your experience level or preferences — tell the agent directly.

## Development

See [docs/development.md](docs/development.md) for the test suite, local checks, and the reasoning behind a few implementation choices.

## License

[MIT](LICENSE) — use, modify, and share it, including commercially, as long as the license notice stays with any copies. No warranty.
