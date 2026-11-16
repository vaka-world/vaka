import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gitRoot, profileIsActive, stateDirectory } from "../src/lib/state";

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-state-"));
  const project = path.join(root, "project with spaces");
  mkdirSync(project);
  mkdirSync(path.join(project, ".git"));
  return { root, project };
}

function withState(project: string, mode = "active"): string {
  const state = path.join(project, ".cognition");
  mkdirSync(state);
  writeFileSync(path.join(state, "profile.md"), `Learning mode: ${mode}\n`);
  return state;
}

test("gitRoot finds the nearest .git boundary", () => {
  const { root, project } = tempProject();
  try {
    const nested = path.join(project, "src", "services");
    mkdirSync(nested, { recursive: true });
    assert.equal(gitRoot(nested), project);
    assert.equal(gitRoot(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stateDirectory finds notes at the project root from a nested directory", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    const nested = path.join(project, "src", "services");
    mkdirSync(nested, { recursive: true });
    assert.equal(stateDirectory(nested), state);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stateDirectory without Git only checks the exact cwd, never a parent", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-state-"));
  try {
    const parent = path.join(root, "documents");
    mkdirSync(parent);
    withState(parent);
    const plain = path.join(parent, "plain-project");
    mkdirSync(plain);
    assert.equal(stateDirectory(plain), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stateDirectory does not cross a nested repository or worktree boundary", () => {
  const { root, project } = tempProject();
  try {
    withState(project);
    for (const [name, isWorktreeFile] of [
      ["nested-repo", false],
      ["worktree", true],
    ] as const) {
      const child = path.join(project, name);
      mkdirSync(child);
      if (isWorktreeFile) {
        writeFileSync(path.join(child, ".git"), "gitdir: /another/repo/.git/worktrees/test");
      } else {
        mkdirSync(path.join(child, ".git"));
      }
      assert.equal(stateDirectory(child), null, `expected no notes under ${name}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stateDirectory stops at a symlinked state directory instead of falling back", () => {
  const { root, project } = tempProject();
  try {
    const outside = path.join(root, "outside");
    mkdirSync(outside);
    const real = withState(outside);
    symlinkSync(real, path.join(project, ".cognition"), "dir");
    assert.equal(stateDirectory(project), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stateDirectory rejects a non-directory .cognition path", () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, ".cognition"), "not a directory");
    assert.equal(stateDirectory(project), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profileIsActive requires real content and is case/whitespace tolerant for paused", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-profile-"));
  try {
    const active = path.join(root, "active.md");
    writeFileSync(active, "Learning mode: active\nOnboarding: complete\n");
    assert.equal(profileIsActive(active), true);

    const paused = path.join(root, "paused.md");
    writeFileSync(paused, "Older preference.\n".repeat(50) + "Learning mode:   PAUSED \n");
    assert.equal(profileIsActive(paused), false);

    const empty = path.join(root, "empty.md");
    writeFileSync(empty, "   \n\t\n");
    assert.equal(profileIsActive(empty), false);

    const legacy = path.join(root, "legacy.md");
    writeFileSync(legacy, "# Learner Profile\nExperience: Beginner\n");
    assert.equal(profileIsActive(legacy), true, "profiles without an explicit mode still restore");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profileIsActive rejects invalid UTF-8 and symlinked profiles", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-profile-"));
  try {
    const invalid = path.join(root, "invalid.md");
    writeFileSync(invalid, Buffer.from([0xff, 0xfe]));
    assert.equal(profileIsActive(invalid), false);

    const target = path.join(root, "target.md");
    writeFileSync(target, "Learning mode: active\nPRIVATE\n");
    const linked = path.join(root, "linked.md");
    symlinkSync(target, linked);
    assert.equal(profileIsActive(linked), false);

    assert.equal(profileIsActive(path.join(root, "missing.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
