import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractPendingDecision, parseProfileFields, readNoteFile, setLearningMode } from "../src/lib/profile";

test("parseProfileFields reads each status/preference line independently", () => {
  const text =
    "# Learner Profile\n\nLearning mode: active\nOnboarding: complete\n\n" +
    "## Preferences\nCheckpoint frequency: Light\nQuestion style: Mixed\n" +
    "Implementation style: A mix\n";
  assert.deepEqual(parseProfileFields(text), {
    learningMode: "active",
    onboarding: "complete",
    checkpointFrequency: "Light",
    questionStyle: "Mixed",
    implementationStyle: "A mix",
  });
});

test("parseProfileFields leaves fields null when a line is absent", () => {
  const fields = parseProfileFields("# Learner Profile\nExperience: Beginner\n");
  assert.equal(fields.learningMode, null);
  assert.equal(fields.onboarding, null);
  assert.equal(fields.checkpointFrequency, null);
});

test("extractPendingDecision captures the section body up to the next heading", () => {
  const text =
    "# Learning Progress\n## Transactions\nDemonstrated understanding: ok.\n" +
    "## Pending decision\nUse SQLite. Awaiting implementation sign-off.\n" +
    "- Still deciding on the migration path.\n## Later topic\nUnrelated.\n";
  assert.equal(
    extractPendingDecision(text),
    "Use SQLite. Awaiting implementation sign-off.\n- Still deciding on the migration path."
  );
});

test("extractPendingDecision reads to end of file when it's the last section", () => {
  const text = "# Learning Progress\n## Pending decision\nWaiting on a reply.\n";
  assert.equal(extractPendingDecision(text), "Waiting on a reply.");
});

test("extractPendingDecision returns null when there's no such section, or it's empty", () => {
  assert.equal(extractPendingDecision("# Learning Progress\nNothing recorded yet.\n"), null);
  assert.equal(extractPendingDecision("## Pending decision\n\n## Next\nsomething\n"), null);
});

test("setLearningMode replaces an existing line and preserves everything else", () => {
  const text = "# Learner Profile\n\nLearning mode: active\nOnboarding: complete\n";
  assert.equal(
    setLearningMode(text, "paused"),
    "# Learner Profile\n\nLearning mode: paused\nOnboarding: complete\n"
  );
});

test("setLearningMode inserts a line when the profile has none yet", () => {
  assert.equal(
    setLearningMode("# Learner Profile\nExperience: Beginner\n", "paused"),
    "Learning mode: paused\n# Learner Profile\nExperience: Beginner\n"
  );
});

test("readNoteFile rejects symlinks, directories, and missing paths", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-notefile-"));
  try {
    const real = path.join(root, "real.md");
    writeFileSync(real, "Learning mode: active\n");
    assert.equal(readNoteFile(real), "Learning mode: active\n");

    const linked = path.join(root, "linked.md");
    symlinkSync(real, linked);
    assert.equal(readNoteFile(linked), null);

    assert.equal(readNoteFile(path.join(root, "missing.md")), null);
    assert.equal(readNoteFile(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
