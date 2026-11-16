---
name: pause
description: Explicitly pause learning mode for this project — the deterministic, immediate form of telling the agent "pause learning."
disable-model-invocation: true
---

# Vaka: Pause

Run this in the main conversation:

```sh
node "${CLAUDE_PLUGIN_ROOT}/dist/skills/pause/pause.js" --cwd "<absolute project directory>"
```

Replace `<absolute project directory>` with the real absolute path to the user's current project, safely quoted; don't pass the placeholder literally.

If you are running in Codex rather than Claude Code, first read [codex.md](codex.md).

## Reporting the result

On `no_notes`, say there's nothing to pause — Vaka hasn't been set up for this project yet — and don't create anything just to pause it.

On `paused`, say plainly that learning mode is paused for this project: ordinary build requests won't trigger checkpoints until `/vaka:learn` is run again. Unlike `/vaka:reset`, this doesn't need a confirmation question first — it's immediately and fully reversible by invoking Learn again, so act on it directly once asked.

This command only ever touches the `Learning mode:` line in `profile.md`. Onboarding progress, saved preferences, mastered concepts, and anything still recorded as a pending decision are all untouched, and pick up exactly where they left off the next time Learn runs.
