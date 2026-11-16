# Running reset under Codex

Same translation as learn/codex.md. Follow SKILL.md as written, except for:

- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `reset.js` as `../../dist/skills/reset/reset.js` relative to this file, and use its absolute path when invoking `node`. The Learn guide is `../learn/SKILL.md` relative to this file.
- **Commands:** say `$cognition:learn` wherever SKILL.md writes `/cognition:learn`.
- **Asking questions:** no AskUserQuestion here. Use a native equivalent like `request_user_input` with the same options if one exists; otherwise ask the same question as plain text and actually wait for an explicit answer.
- **Replies:** ask the confirmation once, at the end of your reply. No closing remark after it, and don't quote these guides back to the user.
