---
name: status
description: Show this project's current learning-mode status — mode, onboarding state, preferences, and any pending decision — without running Learn's full resume flow.
disable-model-invocation: true
---

# Cognition: Status

A quick, read-only check, not a resume. Unlike `/cognition:learn`, this does not read behavior.md, continue onboarding, or ask the learner anything — it only reports what's already saved.

Run this in the main conversation:

```sh
node "${CLAUDE_PLUGIN_ROOT}/dist/skills/status/status.js" --cwd "<absolute project directory>"
```

Replace `<absolute project directory>` with the real absolute path to the user's current project, safely quoted; don't pass the placeholder literally.

If you are running in Codex rather than Claude Code, first read [codex.md](codex.md).

## Reporting the result

On `no_notes`, say plainly that Cognition hasn't been set up for this project yet, and point at `/cognition:learn`. Don't guess at settings that were never saved.

On `found`, give a short plain-language summary — not a raw field dump:

- Whether learning is active or paused.
- Whether onboarding is complete, and if not, that something's still unanswered.
- The current checkpoint frequency, question style, and implementation preference, if saved.
- If `pendingDecision` isn't null, say clearly that something is still awaiting a reply, and summarize what it is from that field. Don't try to resolve it here — acting on it still goes through the ordinary conversation or a full `/cognition:learn`, not this command.

Any field that's `null` simply hasn't been recorded; say so rather than inventing a value. This command never writes anything, regardless of what it finds.
