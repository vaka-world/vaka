import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pause } from "../src/skills/pause/pause";

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-pause-"));
  const project = path.join(root, "project with spaces");
  mkdirSync(project);
  mkdirSync(path.join(project, ".git"));
  return { root, project };
}

test("a project with no notes reports no_notes and creates nothing", () => {
  const { root, project } = tempProject();
  try {
    assert.deepEqual(pause(project), { status: "no_notes", cwd: project });
    assert.deepEqual(readdirSync(project), [".git"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a .cognition/ directory with no profile.md yet reports no_notes", () => {
  const { root, project } = tempProject();
  try {
    mkdirSync(path.join(project, ".cognition"));
    assert.deepEqual(pause(project), { status: "no_notes", cwd: project });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pausing sets Learning mode: paused and preserves everything else", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(
      path.join(state, "profile.md"),
      "# Learner Profile\n\nLearning mode: active\nOnboarding: complete\n" +
        "## Strong Concepts\nHTTP request flow\n"
    );
    const result = pause(project);
    assert.deepEqual(result, { status: "paused", state });

    const updated = readFileSync(path.join(state, "profile.md"), "utf-8");
    assert.match(updated, /^Learning mode: paused$/m);
    assert.ok(updated.includes("Onboarding: complete"));
    assert.ok(updated.includes("HTTP request flow"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pausing twice is idempotent", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(path.join(state, "profile.md"), "Learning mode: active\nOnboarding: complete\n");
    pause(project);
    const first = readFileSync(path.join(state, "profile.md"), "utf-8");
    pause(project);
    const second = readFileSync(path.join(state, "profile.md"), "utf-8");
    assert.equal(first, second);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a profile with no explicit mode line gets one inserted", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    writeFileSync(path.join(state, "profile.md"), "# Learner Profile\nExperience: Beginner\n");
    pause(project);
    const updated = readFileSync(path.join(state, "profile.md"), "utf-8");
    assert.match(updated, /^Learning mode: paused$/m);
    assert.ok(updated.includes("Experience: Beginner"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlinked profile is never written through", () => {
  const { root, project } = tempProject();
  try {
    const state = path.join(project, ".cognition");
    mkdirSync(state);
    const outside = path.join(root, "outside.md");
    writeFileSync(outside, "Learning mode: active\nPRIVATE\n");
    symlinkSync(outside, path.join(state, "profile.md"));

    assert.throws(() => pause(project), /non-regular/);
    assert.equal(readFileSync(outside, "utf-8"), "Learning mode: active\nPRIVATE\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a relative or nonexistent cwd", () => {
  assert.throws(() => pause("relative/path"), /absolute/);
  const root = mkdtempSync(path.join(tmpdir(), "cognition-pause-"));
  try {
    assert.throws(() => pause(path.join(root, "does-not-exist")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
