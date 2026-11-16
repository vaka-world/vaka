# The three note files, and what goes in them

Only ever create these three files, inside whichever `.vaka/` directory SKILL.md's lookup resolved to for this project. Swap every bracketed placeholder for something you actually verified, or write "Not specified" if you didn't. Keep the two bare status lines near the top of `profile.md` exactly as shown and unformatted — the restoration hook string-matches them. If a file already exists, never overwrite it with one of these blank templates; templates are only for notes that don't exist yet.

## profile.md

```markdown
# Learner Profile

Learning mode: active
Onboarding: complete

## Project
Situation: [New / Existing / Known]
Building: [project purpose]
Codebase familiarity: [answer]
Learning scope: [entire system / parts we touch / mixed]

## Experience
Overall programming: [Beginner / Intermediate / Advanced, or Not specified]
Stack familiarity: [per-technology levels if given; otherwise Not specified]

## Goals
Primary: [answer]
Capability goal: [optional answer]

## Preferences
Checkpoint frequency: Normal
Question style: Open-ended
Implementation style: Agent writes code

## Strong Concepts
No demonstrated understanding recorded yet.

## Developing Concepts
None recorded yet.

## Revisit
None recorded yet.
```

## progress.md

```markdown
# Learning Progress

No learning events recorded yet.
```

Each time real learning happens, add a `## Topic` heading with short bullets under Introduced, Demonstrated understanding, and Needs reinforcement. Capture the actual reasoning evidence, not a transcript of the exchange. A stated product preference establishes a requirement — it isn't proof of engineering understanding, so don't file it as one. Keep what the learner reasoned through clearly separate from what you explained to them. Merge duplicate entries as they pile up, and write each topic so it's useful read on its own, without needing the rest of the file for context.

While something is still awaiting a reply, keep exactly one section headed `## Pending decision` — not nested under a topic — naming the proposal on the table, which checkpoint it's at (reasoning / choice confirmation / implementation approval), and what reply you're waiting for. Once it resolves, remove that section: record the outcome in the project map as either chosen or actually implemented (and mark anything you added yourself as yours, not the learner's), and move any real reasoning evidence into its topic. Don't just relocate the pending text wholesale into a topic — update whatever entries the resolution actually supersedes. A confirmed choice goes in the map as confirmed, not as already built, and keep whatever coding scope was approved stated explicitly rather than implied. A confirmation only covers what was actually presented at the time — don't quietly grow the recorded design with fields, behaviors, alternatives, or reasons nobody raised. Anything still unresolved stays marked unknown, and anything you suggested stays marked as yours — never credit it to the learner.

## project-map.md

```markdown
# Project Map

## Purpose
[What this software does.]

## Requirements
[User needs and constraints. These do not automatically settle technical choices.]

## Components
[Components, responsibilities, and supporting file paths.]

## Main Flow
[Compact text diagram with labeled arrows. Mark unknowns and distinguish proposed,
chosen, and implemented components. Reflect the learner's model refined together,
or verified existing code; don't fill missing relationships with assumed designs.]

## Data and Trust Boundaries
[Storage, ownership, auth, external services; unknown when unverified.]

## Build and Deployment
[Commands and configuration paths verified in the repository.]

## Unknowns
[Unresolved technical choices and what needs inspection, including relevant stack,
storage location/model, data structures, interfaces, and deployment choices.]
```
