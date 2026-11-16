import { test } from "node:test";
import assert from "node:assert/strict";
// Same literal require binding as src/skills/reset/reset.ts, so patching a
// method here is patching the exact object that module calls through.
import fs = require("node:fs");
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reset } from "../src/skills/reset/reset";

function tempProject(): { root: string; project: string } {
  const root = mkdtempSync(path.join(tmpdir(), "vaka-reset-"));
  const project = path.join(root, "project with spaces");
  mkdirSync(project);
  mkdirSync(path.join(project, ".git"));
  return { root, project };
}

const ORIGINALS: Record<string, Buffer> = {
  "profile.md": Buffer.from("Learning mode: paused\nOnboarding: complete\nAdvanced\n"),
  "progress.md": Buffer.from("## Pending decision\nAwaiting implementation approval\n"),
  "project-map.md": Buffer.from("# Project Map\nCLI -> service -> SQLite\n"),
};

function withNotes(project: string): string {
  const state = path.join(project, ".vaka");
  mkdirSync(state);
  for (const [name, data] of Object.entries(ORIGINALS)) {
    writeFileSync(path.join(state, name), data);
  }
  return state;
}

function assertOriginals(state: string): void {
  for (const [name, data] of Object.entries(ORIGINALS)) {
    assert.deepEqual(readFileSync(path.join(state, name)), data);
  }
}

test("preview leaves notes untouched", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const preview = reset(project);
    assert.equal(preview.status, "preview");
    if (preview.status !== "preview") throw new Error("unreachable");
    assert.equal(preview.state, state);
    assert.equal(preview.project, project);
    assertOriginals(state);
    assert.deepEqual(readdirSync(state).sort(), Object.keys(ORIGINALS).sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("confirmed reset backs up only the three notes and restarts onboarding", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    writeFileSync(path.join(project, "app.ts"), "important source\n");
    writeFileSync(path.join(state, "custom.md"), "keep this\n");

    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");
    const result = reset(project, preview.confirmation);
    assert.equal(result.status, "reset");
    if (result.status !== "reset") throw new Error("unreachable");

    assert.equal(path.dirname(result.backup), path.join(state, "backups"));
    for (const name of Object.keys(ORIGINALS)) {
      assert.deepEqual(readFileSync(path.join(result.backup, name)), ORIGINALS[name]);
    }
    assert.deepEqual(readdirSync(result.backup).sort(), Object.keys(ORIGINALS).sort());

    const profile = readFileSync(path.join(state, "profile.md"), "utf-8");
    assert.match(profile, /Learning mode: active/);
    assert.match(profile, /Onboarding: incomplete/);
    assert.match(profile, /Onboarding reset: pending/);
    assert.ok(!profile.includes("Advanced"));
    assert.ok(!readFileSync(path.join(state, "progress.md"), "utf-8").includes("Pending decision"));
    assert.ok(!readFileSync(path.join(state, "project-map.md"), "utf-8").includes("SQLite"));

    assert.equal(readFileSync(path.join(project, "app.ts"), "utf-8"), "important source\n");
    assert.equal(readFileSync(path.join(state, "custom.md"), "utf-8"), "keep this\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a sibling project's notes are never touched", () => {
  const { root, project } = tempProject();
  try {
    withNotes(project);
    const sibling = path.join(root, "another-project");
    mkdirSync(sibling);
    mkdirSync(path.join(sibling, ".git"));
    const otherState = withNotes(sibling);

    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");
    reset(project, preview.confirmation);

    assertOriginals(otherState);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no notes and an empty state directory never create files", () => {
  const { root, project } = tempProject();
  try {
    assert.equal(reset(project).status, "no_notes");
    assert.deepEqual(readdirSync(project), [".git"]);
    const state = path.join(project, ".vaka");
    mkdirSync(state);
    assert.equal(reset(project).status, "no_notes");
    assert.deepEqual(readdirSync(state), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("partial state is backed up, and repeated resets keep each backup distinct", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    rmSync(path.join(state, "progress.md"));
    rmSync(path.join(state, "project-map.md"));

    const first = reset(project);
    if (first.status !== "preview") throw new Error("expected preview");
    const firstResult = reset(project, first.confirmation);
    if (firstResult.status !== "reset") throw new Error("expected reset");
    assert.deepEqual(readdirSync(firstResult.backup), ["profile.md"]);

    const second = reset(project);
    if (second.status !== "preview") throw new Error("expected preview");
    const secondResult = reset(project, second.confirmation);
    if (secondResult.status !== "reset") throw new Error("expected reset");
    assert.notEqual(firstResult.backup, secondResult.backup);
    assert.deepEqual(readFileSync(path.join(firstResult.backup, "profile.md")), ORIGINALS["profile.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a stale confirmation is rejected before anything is written", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");
    writeFileSync(path.join(state, "progress.md"), "new understanding\n");

    assert.throws(() => reset(project, preview.confirmation), /changed/);
    assert.equal(readFileSync(path.join(state, "progress.md"), "utf-8"), "new understanding\n");
    assert.ok(!fs.existsSync(path.join(state, "backups")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a confirmation token cannot be replayed against a different project", () => {
  const { root, project } = tempProject();
  try {
    withNotes(project);
    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");

    const other = path.join(root, "another-project");
    mkdirSync(other);
    mkdirSync(path.join(other, ".git"));
    const otherState = withNotes(other);

    assert.throws(() => reset(other, preview.confirmation), /changed/);
    assertOriginals(otherState);
    assert.ok(!fs.existsSync(path.join(otherState, "backups")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlinked state directory is never followed or reset", () => {
  const { root, project } = tempProject();
  try {
    const outside = path.join(root, "outside");
    mkdirSync(outside);
    const target = withNotes(outside);
    symlinkSync(target, path.join(project, ".vaka"), "dir");

    assert.equal(reset(project).status, "no_notes");
    assertOriginals(target);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a non-regular note (symlink or directory) is rejected", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const profilePath = path.join(state, "profile.md");

    rmSync(profilePath);
    symlinkSync(path.join(state, "progress.md"), profilePath);
    assert.throws(() => reset(project), /non-regular/);

    rmSync(profilePath);
    mkdirSync(profilePath);
    assert.throws(() => reset(project), /non-regular/);
    assert.ok(!fs.existsSync(path.join(state, "backups")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlinked backup directory is rejected before any note changes", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const outside = path.join(root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, path.join(state, "backups"), "dir");

    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");
    assert.throws(() => reset(project, preview.confirmation), /Backup path/);
    assertOriginals(state);
    assert.deepEqual(readdirSync(outside), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failure while writing a backup leaves active notes untouched", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");

    const original = fs.writeFileSync;
    (fs as unknown as { writeFileSync: typeof fs.writeFileSync }).writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      data: unknown,
      options?: unknown
    ) => {
      if (typeof file === "string" && file.endsWith("progress.md") && !file.includes("backups")) {
        // allow the first (non-backup) pass through untouched above this stub
      }
      if (typeof file === "string" && path.basename(file) === "progress.md" && file.includes("backups")) {
        throw new Error("simulated disk failure");
      }
      return (original as (...args: unknown[]) => unknown)(file, data, options);
    }) as typeof fs.writeFileSync;

    try {
      assert.throws(() => reset(project, preview.confirmation), /did not complete/);
    } finally {
      fs.writeFileSync = original;
    }
    assertOriginals(state);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failure while swapping in fresh notes keeps the completed backup and reports failure", () => {
  const { root, project } = tempProject();
  try {
    const state = withNotes(project);
    const preview = reset(project);
    if (preview.status !== "preview") throw new Error("expected preview");

    const original = fs.renameSync;
    (fs as unknown as { renameSync: typeof fs.renameSync }).renameSync = ((
      oldPath: fs.PathLike,
      newPath: fs.PathLike
    ) => {
      if (typeof newPath === "string" && path.basename(newPath) === "progress.md") {
        throw new Error("simulated write failure");
      }
      return (original as (...args: unknown[]) => unknown)(oldPath, newPath);
    }) as typeof fs.renameSync;

    try {
      assert.throws(() => reset(project, preview.confirmation), /Backup location/);
    } finally {
      fs.renameSync = original;
    }

    const backups = readdirSync(path.join(state, "backups"));
    assert.equal(backups.length, 1);
    for (const name of Object.keys(ORIGINALS)) {
      assert.deepEqual(
        readFileSync(path.join(state, "backups", backups[0], name)),
        ORIGINALS[name]
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
