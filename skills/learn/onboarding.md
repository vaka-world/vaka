# Running onboarding

Go through this one step at a time, and don't ask something that's already been answered — this is a conversation, not a form. If the profile has `Onboarding reset: pending` on it, only count answers given since that reset; keep that marker in place until onboarding is actually finished, then remove it. Never pull in preferences or understanding from earlier conversation turns or from a backup — a reset means starting from nothing. Every onboarding choice goes through AskUserQuestion: exactly one question, 2–4 short options with brief descriptions, a header under 12 characters, `multiSelect: false`. Use its actual picker UI, not a text imitation of one. If the picker genuinely isn't available, ask the same single question as plain text instead. Anything open-ended stays in the chat, not in a picker.

Before the first question, say briefly that this is learning-first: you'll ask for their approach, then react to it, explain whatever's unfamiliar, and follow up as needed — their reasoning shapes the design, and the agent writes the implementation once it's agreed. A suggestion from the agent is not automatically the next thing that happens. Mention that notes live in `.cognition/` and that it's worth Git-ignoring; don't actually touch `.gitignore` unless they ask, and say so before you do.

## Where this project stands

Unless it's already been answered, open with "What are we doing?" as a native picker: New project / Existing repo / Known project. Don't guess this from an empty folder — ask. Wait for each answer before moving to the next question.

- **New:** if what they're building isn't clear yet, ask. Label any architecture you sketch as proposed, not as something that already exists.
- **Existing:** read whatever project guidance, entry points, dependencies, storage, integrations, and deploy config you can find — skip secrets and generated output. Save a small map backed by what you actually found, and show a short flow with the gaps left as unknowns. Then ask, as two separate pickers, how familiar they are with the codebase (New / A little experience / Know it well) and how much of it they want to learn (Whole system / Parts we touch / A mix).
- **Known:** ask about architecture familiarity only if it isn't already on record. Inspect just enough to keep the map current — skip the introductory explanations they don't need.

## Who's building it

Ask only what you don't already know, one question at a time:

- Overall programming experience: Beginner / Intermediate / Advanced.
- Familiarity with the chosen stack: Beginner / Intermediate / Advanced — skip this if there's no stack decided yet, and take per-technology detail as free text instead. Existing labels still count: "New" reads as Beginner, "Some experience" or "Comfortable" read as Intermediate. Don't re-run this just to relabel something.
- What they're trying to get out of this: for a beginner on a brand-new project who hasn't already stated a goal, default to "I'll walk you through how this project works end to end as we build it" and record that as the default — don't make them articulate a learning goal from scratch. It's changeable later. For anyone else, only ask about their focus if it genuinely isn't clear yet.
- Preferences, as a picker:
  - Use defaults — reason through each meaningful decision, then let the agent write the code.
  - Customize — adjust checkpoint frequency, question style, or how much of the coding is theirs.

Defaults means Normal checkpoints and open-ended questions, and setup is done right there. Customize asks three more things, each its own picker: frequency (Light / Normal / Frequent), question style (Open-ended / Multiple choice / Mixed), and who codes (Agent writes / A mix / More hands-on). None of these change what the setup pickers themselves looked like. A longer-term goal beyond this project is optional — don't ask for it separately if their stated goal already covers it.

If they'd rather skip setup outright: use the defaults, mark whatever's still unknown as "Not specified," and move on. Save whatever is known using state-templates.md, with `Onboarding: incomplete` and a short "Remaining onboarding" list that persists between turns — mark it complete once it actually is. Experience level is self-reported, not demonstrated; don't treat it as proof of anything. Summarize the settled preferences in one line, then get into the actual build with the loop described in behavior.md.
