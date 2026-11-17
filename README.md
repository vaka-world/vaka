<img src="https://cdn.jsdelivr.net/npm/@vaka.world/cli/assets/vaka.png" alt="Vaka: your mind is the architect" width="420" height="420">

# Vaka

![Node.js](https://img.shields.io/badge/node-%3E%3D22.6-2E478C?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/npm-%40vaka.world%2Fcli-2E478C?style=flat-square&logo=npm&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-2E478C?style=flat-square)

**Your mind is the architect.** Vaka is a plugin for **Claude Code** and **Codex** that enforces a reason-first workflow: the agent will not sketch a data model, choose a storage strategy, or scaffold an architecture until you have proposed one yourself.

It challenges weak spots, explains unfamiliar concepts, and waits for explicit confirmation before writing code. After implementing, it reports what it built and why, so you can verify the result against your own design rather than trusting the diff blindly.

Built for anyone who wants to stay in control of the thinking, not just the output: someone learning to program, a developer picking up an unfamiliar stack, or an experienced engineer who wants to keep "vibe coding" from replacing their own judgment.

## Table of Contents

- [Install](#install)
  - [Global install (recommended)](#global-install-recommended)
  - [Run directly with npx](#run-directly-with-npx)
  - [Native Claude Code / Codex plugin](#native-claude-code--codex-plugin)
- [Commands](#commands)
  - [Session commands](#session-commands)
  - [Checkpoint responses](#checkpoint-responses)
  - [Spoken controls](#spoken-controls)
- [How a session runs](#how-a-session-runs)
- [Tuning it to you](#tuning-it-to-you)
- [Development](#development)
- [License](#license)

## Install

**Prerequisites:** [Node.js](https://nodejs.org/) 22.6 or later, and an active installation of [Claude Code](https://code.claude.com/docs/en/setup) or [Codex](https://developers.openai.com/codex).

### Global install (recommended)

Install the CLI globally so the `vaka` command is available across all your repositories:

```sh
npm install -g @vaka.world/cli
```

Navigate to your project and initialise Vaka:

```sh
cd your-project
vaka init
```

### Run directly with npx

If you prefer not to install anything globally, run the initialiser directly inside your project:

```sh
npx @vaka.world/cli init
```

Both `vaka init` and `npx @vaka.world/cli init` write the skill guides straight into your project:

- `.claude/skills/vaka-*/` for Claude Code
- `.agents/skills/vaka-*/` for Codex and other `AGENTS.md`-reading tools
- A `SessionStart` hook merged into `.claude/settings.json`, if Claude Code is detected (a `CLAUDE.md` file or an existing `.claude/` directory)

It is safe to run more than once. Existing files are left untouched and reported as kept.

Once initialised, start a session inside Claude Code or Codex:

```text
/vaka-learn
```

(In Codex, run `$vaka-learn`.) Onboarding asks one question at a time: use the arrow keys and Enter to answer, or select **Use defaults** to skip straight to building. Both new projects and unfamiliar existing codebases are supported; for the latter, the agent reads the code first and summarises what it found before asking anything.

The CLI checks npm once a day for a newer version (cached locally, non-blocking) and prints a notice when an update is available.

### Native Claude Code / Codex plugin

If you prefer to install through the native plugin system rather than npm:

```sh
claude --plugin-dir /absolute/path/to/vaka
```

Commands are namespaced here instead of hyphenated (`/vaka:learn` in Claude Code, or `$vaka:learn` in Codex). Behaviour is otherwise identical to the npm installation, and both tools read and write the same `.vaka/` folder in the project, so switching between them preserves your state.

Wherever this guide shows a `/` command, use `$` in Codex.

## Commands

### Session commands

Run inside the project being worked on. Shown here in the npm-install form (see [Native Claude Code / Codex plugin](#native-claude-code--codex-plugin) for the namespaced form).

| Command | What it does |
| --- | --- |
| `/vaka-learn` | Starts learning mode on a new project, or resumes it from existing `.vaka/` notes. Run once per session at the start, and again if the agent drifts out of learning mode (for example, after a long `/compact`). |
| `/vaka-status` | A read-only check: displays current learning mode, onboarding state, saved preferences, and any pending decision without running Learn's full resume flow. Writes nothing. |
| `/vaka-pause` | Pauses learning mode immediately, equivalent to saying "pause learning". No confirmation step; fully reversed by running `/vaka-learn` again. Only the `Learning mode:` line changes. |
| `/vaka-reset` | Displays what is currently saved for the project, then (after explicit confirmation) backs up the current profile, progress, and project map, and restarts onboarding from scratch. Does not touch project code. |

### Checkpoint responses

Options presented by the agent at a checkpoint or reset. Selecting one, via the native picker or by name, advances the flow.

| Response | Appears at | Effect |
| --- | --- | --- |
| **Confirm and continue** | Design checkpoint | Locks in the proposed design and moves to the next open question. Still writes no code. |
| **Implement this step** | Implementation checkpoint | Authorises the agent to write the code just described. Also counts as confirming the design, if not already confirmed. |
| **Discuss** | Either checkpoint | Raises questions or objections before committing: the agent waits for a reply instead of proceeding. |
| **Cancel** | `/vaka-reset` confirmation | Aborts the reset. Nothing changes, including the notes. |
| **Reset learning** | `/vaka-reset` confirmation | Confirms the reset: originals are backed up, then onboarding restarts. |

### Spoken controls

Plain language, spoken at any point in the conversation without special syntax.

| Say this | To get |
| --- | --- |
| "Use fewer checkpoints." / "Use more checkpoints." | Light, Normal, or Frequent checkpoint frequency. |
| "Use multiple-choice questions." | Multiple-choice instead of open-ended reasoning questions. |
| "Focus on backend architecture." (or any area) | Narrows what the agent brings checkpoints to. |
| "Just implement this one." | Skips the checkpoint for one specific, trivial change. |
| "I'm stuck" / "skip" | Trades a reasoning question for an explanation or options, for that single step. |
| "Pause learning." | Same effect as `/vaka-pause` using plain language instead of a command. |

## How a session runs

Example: building a Stripe payment webhook that credits a user's wallet balance when an invoice is paid.

**You:**

```text
Add a webhook endpoint for payment_intent.succeeded so we credit the user's wallet when they pay.
```

**Agent:**

```text
✦ Build checkpoint: Duplicate deliveries and concurrent retries

Payment providers frequently deliver the same webhook twice, or retry while
your server is still processing the first request.

If two identical events arrive within 50 milliseconds of each other, what
stops your endpoint from crediting the user's wallet twice?
```

**You:**

```text
We should store the Stripe event ID in a database table with a unique constraint, and wrap the credit mutation and event insert in a single database transaction.
```

**Agent:**

```
That guarantees atomic idempotency: the second concurrent request hits the
unique constraint, rolls back cleanly, and still returns 200 OK so Stripe
stops retrying.

✦ Design checkpoint: Idempotent ledger mutation

Proposed: a `processed_events` table keyed by `event_id` (unique index),
written inside the same ACID transaction as the `wallet_ledger` credit
entry. If `event_id` already exists, the handler exits early and returns
HTTP 200 without modifying the balance.

One open edge case: if the user's wallet record does not exist yet on their
first payment, should the webhook create it lazily or fail loudly?

❯ 1. Confirm and continue
     This approach makes sense to me; move to the next piece.
  2. Discuss
     Ask questions or clarify anything that does not make sense before deciding.
```

**You:**

```text
Confirm and continue.
```

*After settling wallet initialisation the same way...*

**Agent:**

```text
✦ Implementation checkpoint: Idempotent webhook handler

I will add the `processed_events` schema and unique index, wrap the wallet
credit in a single transaction, and return 200 OK on duplicate event IDs.
Then I will run tests covering: a valid first payment, a sequential replay
of the same event ID, and two simultaneous requests racing on the same ID.

❯ 1. Implement this step
     This approach makes sense to me; write the code for this step.
  2. Discuss
     Ask questions or clarify anything that does not make sense before deciding.
```

**You:**

```text
Implement this step.
```

**Agent:**

```text
✦ Implementation report: Idempotent webhook handler

- Added `processed_events` table with a unique constraint on `event_id`.
- Wrapped the event insert and wallet credit inside one database transaction;
  duplicate key violations catch cleanly and return HTTP 200.
- Added and ran three tests: initial credit, sequential replay, and
  concurrent race condition. All three passed.
```

You do not need to know the answer going in. For an unfamiliar concept, the agent explains it and hands back a smaller, concrete question instead of the full design. You remain in control: answer in plain language, or say "skip" or ask for options whenever you want them.

| Checkpoint | What happens |
| --- | --- |
| **Build** | The mechanism gets worked out with the agent's feedback: no code, no architecture yet. |
| **Design** | The agent lays out the proposed structure and trade-offs. **Confirm and continue** locks it in and moves to the next open question; still no code. |
| **Implementation** | The agent names the exact change it is about to make. **Implement this step** authorises it to write code. |

Once code is written, a short report follows: what changed, how the new code works, why it matches what was decided, what was tested (and what was not), and the actual result of running it.

## Tuning it to you

Experience level changes how much is explained, not who decides:

| Level | What you get |
| --- | --- |
| Beginner | Concepts explained before they are used, small diagrams, narrower reasoning questions. |
| Intermediate | Less setup, more focus on how pieces interact and trade off against each other. |
| Advanced | Pressure-testing of constraints, edge cases, and unstated assumptions. |

Preferences, progress, and a project map all live in a `.vaka/` folder at the project root (or at the Git repository root if one exists). It survives restarts, `/clear`, and compaction. Add `.vaka/` to `.gitignore` to keep it out of version control; the plugin suggests this during onboarding but will not modify `.gitignore` without asking first.

Nothing here phones out: no account, no backend, no telemetry. Saved notes become part of the agent's context the same way any other file would, so your existing data settings for Claude Code or Codex apply unchanged.

## Development

See [docs/development.md](docs/development.md) for the test suite, local checks, and implementation details.

## License

[MIT](LICENSE): use, modify, and share, including commercially, as long as the license notice stays with any copies. No warranty.
