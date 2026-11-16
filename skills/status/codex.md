# Running status under Codex

- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `status.js` as `../../dist/skills/status/status.js` relative to this file, and use its absolute path.
- **Commands:** say `$cognition:status` wherever SKILL.md writes `/cognition:status`.
- Everything else in SKILL.md applies as written — this command only reads, so there's no onboarding, picker, or restoration behavior to adapt.
