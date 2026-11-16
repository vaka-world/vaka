---
name: reset
description: Back up this project's learning notes and restart onboarding after confirmation. Does not touch application code.
disable-model-invocation: true
---

# Resetting Vaka's learning notes

Only run this when explicitly invoked, in the main conversation. It replaces the profile, the progress log, any pending checkpoint, and the saved project map with fresh ones. It does not touch source code, dependencies, Git history, any other project, or the plugin install itself.

Running under Codex instead of Claude Code? Read [codex.md](codex.md) first.

1. Run a read-only preview against the user's current project directory. Substitute the real absolute path for `<absolute project directory>` (properly quoted) — don't pass that placeholder text literally.

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<absolute project directory>"
   ```

   This reuses the same project-boundary and state-lookup logic as Learn. If it reports there's nothing to reset, say so and point at `/vaka:learn` instead. If it errors, stop and explain the error — don't start improvising your own deletion commands.

2. Tell the user the project and state paths it found, which files would be reset, and that the originals get saved under that state directory's `backups/` folder before anything changes. Ask with AskUserQuestion: header `Reset`, `multiSelect: false`, options **Cancel** (notes stay as they are) and **Reset learning** (back up, then restart onboarding). If the picker isn't available, ask the same thing as plain text, and wait for an actual answer — invoking this command, staying silent, an ambiguous reply, or being granted permission to run a tool are all not a confirmation. Cancel changes nothing at all, including the notes themselves.

3. Only once **Reset learning** has actually been chosen, run the helper again with the original working directory and the exact `confirmation` value the preview returned, quoted:

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<original cwd>" --confirm "<confirmation>"
   ```

   If the target or the notes changed in between, the confirmation will be rejected — preview again and get a fresh one. If the reset itself fails, report the failure and whatever backup path it mentions; don't claim it worked, and don't start onboarding. Never write over an existing backup, and never fall back to resetting some other state directory instead.

4. On success, show the backup path, then read `${CLAUDE_PLUGIN_ROOT}/skills/learn/SKILL.md` and pick Learn back up against the new, incomplete profile. Everything from before the reset — preferences, mastered concepts, anything pending, prior onboarding answers — is gone on purpose; don't try to reconstruct it from the conversation or from the backup. Re-inspect the actual code to rebuild the project map, and run onboarding fresh, one question at a time. The backup is there for the user to look at later, not something to treat as current context.
