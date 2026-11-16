import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLUGIN_ROOT, restore } from "../src/hooks/session-start";

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-hook-"));
  const project = path.join(root, "project with spaces");
  mkdirSync(project);
  mkdirSync(path.join(project, ".git"));
  return { root, project };
}

function withState(project: string, mode = "active"): string {
  const state = path.join(project, ".cognition");
  mkdirSync(state);
  writeFileSync(
    path.join(state, "profile.md"),
    `# Learner Profile\nLearning mode: ${mode}\nOnboarding: complete\n` +
      "Checkpoint frequency: Light\nStrong concepts: HTTP request flow\n"
  );
  writeFileSync(path.join(state, "project-map.md"), "# Project Map\nCLI -> service -> SQLite\n");
  writeFileSync(
    path.join(state, "progress.md"),
    "# Learning Progress\n## Transactions\nDemonstrated understanding: two writes must succeed together.\n"
  );
  return state;
}

function payload(cwd: string, source = "startup"): Record<string, unknown> {
  return { hook_event_name: "SessionStart", source, cwd };
}

test("fresh project with no notes produces no output", () => {
  const { root, project } = tempProject();
  try {
    assert.equal(restore(payload(project)), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("active notes restore with instructions pointing at the Learn guide, not raw notes", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    for (const source of ["startup", "resume", "clear", "compact", "fork"]) {
      const output = restore(payload(project, source));
      assert.ok(output, `expected output for source=${source}`);
      const context = output!.hookSpecificOutput.additionalContext;
      assert.equal(output!.hookSpecificOutput.hookEventName, "SessionStart");
      assert.match(context, /Cognition's learning mode on/);
      assert.ok(context.includes(path.join(PLUGIN_ROOT, "skills", "learn", "SKILL.md")));
      assert.ok(context.includes(state));
      assert.ok(context.includes("search all of progress.md"));
      assert.ok(!context.includes("Checkpoint frequency: Light"));
      assert.ok(!context.includes("two writes must succeed together"));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restores from a nested working directory inside the project", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    const nested = path.join(project, "src", "services");
    mkdirSync(nested, { recursive: true });
    const output = restore(payload(nested));
    assert.ok(output!.hookSpecificOutput.additionalContext.includes(state));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a project without Git still restores from its own notes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-hook-"));
  try {
    const project = path.join(root, "fresh-no-git");
    mkdirSync(project);
    const state = withState(project);
    assert.ok(restore(payload(project))!.hookSpecificOutput.additionalContext.includes(state));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("without Git, a plain subfolder never inherits a shared parent's notes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cognition-hook-"));
  try {
    const parent = path.join(root, "documents");
    const project = path.join(parent, "throwaway", "plain-project");
    mkdirSync(project, { recursive: true });
    withState(parent);
    assert.equal(restore(payload(project)), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("paused learning mode is not reactivated by compaction", () => {
  const { root, project } = tempProject();
  try {
    withState(project, "paused");
    assert.equal(restore(payload(project, "compact")), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed payloads exit cleanly", () => {
  const { root, project } = tempProject();
  try {
    withState(project);
    assert.equal(restore(null), null);
    assert.equal(restore([]), null);
    assert.equal(restore(42), null);
    assert.equal(restore({ cwd: 4, hook_event_name: "SessionStart" }), null);
    assert.equal(restore({ hook_event_name: "SessionStart", cwd: "relative" }), null);
    assert.equal(restore({ hook_event_name: "Other", cwd: project }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlinked profile is not read", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    const outside = path.join(root, "outside.md");
    writeFileSync(outside, "Learning mode: active\nPRIVATE");
    rmSync(path.join(state, "profile.md"));
    symlinkSync(outside, path.join(state, "profile.md"));
    assert.equal(restore(payload(project)), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the hook never writes to the state directory", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    const before = readdirSync(state).sort();
    restore(payload(project, "compact"));
    const after = readdirSync(state).sort();
    assert.deepEqual(before, after);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("output size stays constant as notes grow, and a pending decision is flagged without its content", () => {
  const { root, project } = tempProject();
  try {
    const state = withState(project);
    writeFileSync(
      path.join(state, "progress.md"),
      "## Earlier learning\n" +
        "Older summary.\n".repeat(10000) +
        "## Pending decision\nAwaiting approval to implement SQLite.\n"
    );
    const context = restore(payload(project, "compact"))!.hookSpecificOutput.additionalContext;
    assert.ok(context.length < 10000);
    assert.ok(!context.includes("SQLite"));
    assert.ok(!context.includes("Earlier learning"));
    assert.ok(context.includes("awaiting implementation sign-off"));
    assert.ok(context.includes("is not the same thing as the learner approving"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
