import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { status } from "../src/skills/status/status";

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-status-"));
  const project = path.join(root, "project with spaces");
  mkdirSync(project);
  mkdirSync(path.join(project, ".git"));
  return { root, project };
}

test("a project with no .cognition/ at all reports no_notes", () => {
  const { root, project } = tempProject();
  try {
    assert.deepEqual(status(project), { status: "no_notes", cwd: project });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a full profile and a pending decision are both reported", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(
      path.join(state, "profile.md"),
      "# Learner Profile\nLearning mode: active\nOnboarding: complete\n" +
        "Checkpoint frequency: Normal\nQuestion style: Open-ended\n" +
        "Implementation style: Agent writes code\n"
    );
    writeFileSync(
      path.join(state, "progress.md"),
      "# Learning Progress\n## Pending decision\nAwaiting implementation sign-off on SQLite.\n"
    );

    const result = status(project);
    assert.equal(result.status, "found");
    if (result.status !== "found") throw new Error("unreachable");
    assert.equal(result.state, state);
    assert.equal(result.learningMode, "active");
    assert.equal(result.onboarding, "complete");
    assert.deepEqual(result.preferences, {
      checkpointFrequency: "Normal",
      questionStyle: "Open-ended",
      implementationStyle: "Agent writes code",
    });
    assert.equal(result.pendingDecision, "Awaiting implementation sign-off on SQLite.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an empty .cognition/ directory still reports found, with everything null", () => {
  const { root, project } = tempProject();
  try {
    mkdirSync(path.join(project, ".cognition"));
    const result = status(project);
    assert.equal(result.status, "found");
    if (result.status !== "found") throw new Error("unreachable");
    assert.equal(result.learningMode, null);
    assert.equal(result.onboarding, null);
    assert.equal(result.pendingDecision, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a profile with no pending-decision section reports pendingDecision: null", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(path.join(state, "profile.md"), "Learning mode: active\n");
    writeFileSync(path.join(state, "progress.md"), "# Learning Progress\n## Transactions\nDone.\n");
    const result = status(project);
    if (result.status !== "found") throw new Error("unreachable");
    assert.equal(result.pendingDecision, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a paused profile is reported as paused, not silently treated as inactive", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(path.join(state, "profile.md"), "Learning mode: paused\nOnboarding: complete\n");
    const result = status(project);
    if (result.status !== "found") throw new Error("unreachable");
    assert.equal(result.learningMode, "paused");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a relative or nonexistent cwd", () => {
  assert.throws(() => status("relative/path"), /absolute/);
  const root = mkdtempSync(path.join(tmpdir(), "cognition-status-"));
  try {
    assert.throws(() => status(path.join(root, "does-not-exist")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
