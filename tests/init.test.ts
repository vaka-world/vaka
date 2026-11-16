import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initializeProject } from "../src/cli/commands/init";

const packageRoot = path.resolve(__dirname, "..");

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "vaka-init-"));
  const project = path.join(root, "project");
  mkdirSync(project);
  return { root, project };
}

function readVendored(project: string, tree: ".claude" | ".agents", skill: string, file: string): string {
  return readFileSync(path.join(project, tree, "skills", `vaka-${skill}`, file), "utf8");
}

test("a bare project with no markers vendors both skill trees but skips the hook", async () => {
  const { root, project } = tempProject();
  try {
    const result = await initializeProject(project, { packageRoot });
    assert.deepEqual(result.integrations, []);
    assert.equal(result.hook, "not-applicable");
    assert.ok(result.created.includes(path.join(".claude/skills/vaka-learn", "SKILL.md")));
    assert.ok(result.created.includes(path.join(".agents/skills/vaka-pause", "codex.md")));
    assert.equal(result.created.length, 22); // 4 skills x 2 trees; learn has 5 files, the others 2 each
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detects Claude Code from CLAUDE.md and merges a SessionStart hook", async () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, "CLAUDE.md"), "# Project\n");
    const result = await initializeProject(project, { packageRoot });
    assert.deepEqual(result.integrations, ["claude"]);
    assert.equal(result.hook, "added");

    const settings = JSON.parse(readFileSync(path.join(project, ".claude", "settings.json"), "utf8"));
    const command = settings.hooks.SessionStart[0].hooks[0].command;
    assert.match(command, /npx --yes .+ hook session-start/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detects Codex from AGENTS.md without touching the Claude hook", async () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, "AGENTS.md"), "# Agents\n");
    const result = await initializeProject(project, { packageRoot });
    assert.deepEqual(result.integrations, ["codex"]);
    assert.equal(result.hook, "not-applicable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("re-running init is idempotent: everything comes back skipped, hook already-present", async () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, "CLAUDE.md"), "# Project\n");
    const first = await initializeProject(project, { packageRoot });
    assert.ok(first.created.length > 0);

    const second = await initializeProject(project, { packageRoot });
    assert.equal(second.created.length, 0);
    assert.equal(second.skipped.length, first.created.length);
    assert.equal(second.hook, "already-present");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a pre-existing .claude/settings.json keeps its other fields", async () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, "CLAUDE.md"), "# Project\n");
    mkdirSync(path.join(project, ".claude"));
    writeFileSync(
      path.join(project, ".claude", "settings.json"),
      JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }, null, 2)
    );

    await initializeProject(project, { packageRoot });

    const settings = JSON.parse(readFileSync(path.join(project, ".claude", "settings.json"), "utf8"));
    assert.deepEqual(settings.permissions, { allow: ["Bash(ls:*)"] });
    assert.ok(Array.isArray(settings.hooks.SessionStart));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a malformed .claude/settings.json is never overwritten", async () => {
  const { root, project } = tempProject();
  try {
    writeFileSync(path.join(project, "CLAUDE.md"), "# Project\n");
    mkdirSync(path.join(project, ".claude"));
    writeFileSync(path.join(project, ".claude", "settings.json"), "{ not json");

    await assert.rejects(() => initializeProject(project, { packageRoot }), /malformed/);
    assert.equal(readFileSync(path.join(project, ".claude", "settings.json"), "utf8"), "{ not json");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("vendored skill guides carry no plugin-only references", async () => {
  const { root, project } = tempProject();
  try {
    await initializeProject(project, { packageRoot });

    for (const tree of [".claude", ".agents"] as const) {
      for (const skill of ["learn", "pause", "reset", "status"]) {
        const skillMd = readVendored(project, tree, skill, "SKILL.md");
        assert.doesNotMatch(skillMd, /CLAUDE_PLUGIN_ROOT/);
        assert.doesNotMatch(skillMd, /\/vaka:/);
        assert.match(skillMd, new RegExp(`name: vaka-${skill}`));
      }
      const pauseCodex = readVendored(project, tree, "pause", "codex.md");
      assert.doesNotMatch(pauseCodex, /CLAUDE_PLUGIN_ROOT/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reset's pointer back to the Learn guide is an absolute path in its own tree", async () => {
  const { root, project } = tempProject();
  try {
    await initializeProject(project, { packageRoot });

    const claudeReset = readVendored(project, ".claude", "reset", "SKILL.md");
    assert.ok(claudeReset.includes(path.join(project, ".claude/skills/vaka-learn/SKILL.md")));

    const agentsReset = readVendored(project, ".agents", "reset", "SKILL.md");
    assert.ok(agentsReset.includes(path.join(project, ".agents/skills/vaka-learn/SKILL.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a project path that isn't a directory", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "vaka-init-"));
  try {
    await assert.rejects(() => initializeProject(path.join(root, "nope"), { packageRoot }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
