# Running this under Codex

This is a translation layer, not a behavior change: everything in SKILL.md and its referenced guides still applies exactly as written. Only the tool and command names differ here.

- **Commands:** `/vaka:learn` and `/vaka:reset` become `$vaka:learn` and `$vaka:reset`.
- **Paths:** Codex doesn't expand `${CLAUDE_PLUGIN_ROOT}`. From this file, the plugin root is two directories up; the other guides (behavior.md, onboarding.md, state-templates.md) sit right next to this one.
- **Reading files:** anywhere a guide says Read or Glob, use whatever file-reading and search tools you actually have. Reading a guide via a shell command is fine too. For the optional learner-state files, write the check so a missing file is a normal branch, not an error.
- **Asking questions:** there's no AskUserQuestion here. If something like `request_user_input` exists, use it with the same question and options; otherwise just ask as plain text with the options spelled out, then stop and actually wait for the reply.
- **Restoring context:** there's no session-start hook on this side. Learning mode comes back only when `$vaka:learn` is invoked again. If context got compacted and you're not sure whether something's still pending, check `progress.md` before doing anything else.
- **How replies look:** put the checkpoint or question once, at the very end of your reply, options listed right under it. Don't repeat it in a follow-up message, don't tack on a closing line after it, and don't quote these guides back to the learner.
