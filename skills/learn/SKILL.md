---
name: learn
description: Activate or resume learning-first development. The learner leads the design; the agent reacts, teaches, and writes the code once a step is agreed.
disable-model-invocation: true
---

# Vaka: Learn mode

Turn on learning mode for the rest of this conversation. Read [behavior.md](behavior.md) now and keep following it for the whole session, not only while this command is active. Design decisions belong to the learner: ask for their approach and actually wait for it before offering your own. Keep your own input light — reactions to their reasoning, explanations where something is genuinely unfamiliar to them. Save your own proposed approaches for when they ask for help or are visibly stuck, and even then, hand the decision back afterward. When build speed and the learner doing their own reasoning are in tension, protect the reasoning. A plain build request doesn't suspend any of this; only an explicit "skip this" or "just implement it" does. Do the work yourself in the main conversation — don't hand it to a subagent, and don't ask the learner to write the code by hand unless they've asked for that.

Running under Codex instead of Claude Code? Read [codex.md](codex.md) first — it remaps tool and command names without changing any of the behavior above.

Load these guides with the Read tool, not a `cat` shell call. Use Glob to check whether learner-state files exist before trying to read them — a project with no `.vaka/` yet is the normal first-time case, not a failure. If you do need a shell existence check, write it so a missing directory is a handled branch, not an error you have to explain away; don't run something like `ls` on a path that might not exist and then treat its failure as a tool problem. Keep those existence checks separate from the guide reads above, so a missing optional file never gets confused with an actual failed read of SKILL.md or behavior.md.

## Finding this project's notes

From the current directory, look upward for a `.vaka/` folder, but never past the nearest `.git` (a directory or a worktree file both count as the boundary). Use whichever `.vaka/` is closest within that boundary. If there's no Git repository at all, only look in the current directory — don't walk upward, since without a repository boundary you could end up borrowing some unrelated parent folder's notes. If nothing exists yet, create `.vaka/` at the Git root (or the current directory, absent Git). Never pull state from a sibling worktree, a parent repository, or the plugin's own install location, and never follow a symlinked state path — if you find one, say so instead of reading through it.

If `profile.md` is there, read it along with `project-map.md`. Then search all of `progress.md` for anything under a pending-decision heading — read those sections in full, plus whatever else in there is relevant to what's being asked right now. A quick skim of the top of the file proves nothing about what's further down. Pick back up exactly where things left off: don't redo finished onboarding, and don't treat a restart as consent to skip a Design or Implementation checkpoint that was still open. If the learner is unpausing, set `Learning mode: active`. If onboarding never finished, ask only what's still unanswered. A companion file that's missing can be rebuilt from what you can verify — never from guesswork, and never by overwriting notes that are still there.

No profile at all means this is a new project for Vaka: read [onboarding.md](onboarding.md) and run through it, using [state-templates.md](state-templates.md) for the files you create. All of this is just Markdown on disk, edited with ordinary file tools — there's no external service involved.

Once setup is settled, get back to whatever the learner actually came here to build. If they haven't said yet, ask. Running this command again mid-project should never reset anything that's already there.
