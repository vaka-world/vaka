/**
 * Shows what resetting would do by default; only actually replaces a note
 * once the caller echoes back the exact snapshot fingerprint from that preview.
 */

import { createHash } from "node:crypto";
// A literal `require` binding (rather than an ES namespace import) so tests
// can monkey-patch the single shared `fs` module object and have this module
// observe the patch, instead of each holding its own copied namespace.
import fs = require("node:fs");
import path from "node:path";
import { stateDirectory } from "../../lib/state";

export const FRESH: Record<string, string> = {
  "profile.md":
    "# Learner Profile\n\nLearning mode: active\nOnboarding: incomplete\n" +
    "Onboarding reset: pending\n\n" +
    "Still to cover: project situation, experience level, stack familiarity, " +
    "goals, and preferences.\n",
  "progress.md": "# Learning Progress\n\nNothing recorded yet.\n",
  "project-map.md": "# Project Map\n\nNot mapped yet — inspect the project before filling this in.\n",
};

const NOTE_NAMES = Object.keys(FRESH);

export interface Snapshot {
  state: string | null;
  notes: Record<string, Buffer>;
  fingerprint: string | null;
}

function fingerprintOf(state: string, notes: Record<string, Buffer>): string {
  // Include identity, missing files, and content so confirmation cannot drift
  // to another project or silently discard notes updated by another session.
  const digest = createHash("sha256");
  digest.update(state);
  for (const name of NOTE_NAMES) {
    const data = notes[name];
    digest.update(JSON.stringify([name, data ? data.toString("hex") : null]));
  }
  return digest.digest("hex");
}

export function snapshot(cwd: string): Snapshot {
  const state = stateDirectory(cwd);
  if (state === null) return { state: null, notes: {}, fingerprint: null };

  const notes: Record<string, Buffer> = {};
  for (const name of NOTE_NAMES) {
    const notePath = path.join(state, name);
    let st;
    try {
      st = fs.lstatSync(notePath);
    } catch {
      continue;
    }
    if (!st.isFile()) {
      throw new Error("Refusing to reset non-regular note: " + notePath);
    }
    notes[name] = fs.readFileSync(notePath);
  }
  return { state, notes, fingerprint: fingerprintOf(state, notes) };
}

export type ResetResult =
  | { status: "no_notes"; cwd: string }
  | {
      status: "preview";
      project: string;
      state: string;
      files: string[];
      backup_parent: string;
      confirmation: string;
    }
  | { status: "reset"; project: string; state: string; backup: string };

function timestampPrefix(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `reset-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z-`
  );
}

export function reset(cwdInput: string, confirmation?: string): ResetResult {
  if (!path.isAbsolute(cwdInput)) {
    throw new Error("Use an existing absolute project working directory.");
  }
  let dirStat;
  try {
    dirStat = fs.lstatSync(cwdInput);
  } catch {
    throw new Error("Use an existing absolute project working directory.");
  }
  if (!dirStat.isDirectory()) {
    throw new Error("Use an existing absolute project working directory.");
  }
  const cwd = path.resolve(cwdInput);

  const { state, notes, fingerprint } = snapshot(cwd);
  const notesExist = Object.keys(notes).length > 0;
  if (confirmation !== undefined && (!notesExist || confirmation !== fingerprint)) {
    throw new Error("Target or notes changed. Preview and confirm again; nothing reset.");
  }
  if (!notesExist || state === null) {
    return { status: "no_notes", cwd };
  }

  if (confirmation === undefined) {
    return {
      status: "preview",
      project: path.dirname(state),
      state,
      files: Object.keys(notes),
      backup_parent: path.join(state, "backups"),
      confirmation: fingerprint as string,
    };
  }

  const backupParent = path.join(state, "backups");
  let backupParentStat;
  try {
    backupParentStat = fs.lstatSync(backupParent);
  } catch {
    backupParentStat = null;
  }
  if (backupParentStat && (backupParentStat.isSymbolicLink() || !backupParentStat.isDirectory())) {
    throw new Error("Backup path must be a real directory; nothing reset.");
  }
  if (!backupParentStat) {
    fs.mkdirSync(backupParent, { mode: 0o700 });
  }

  const backup = fs.mkdtempSync(path.join(backupParent, timestampPrefix(new Date())));
  try {
    // Finish all backups and prepare replacements before touching active notes.
    for (const [name, data] of Object.entries(notes)) {
      fs.writeFileSync(path.join(backup, name), data);
    }
    for (const [name, text] of Object.entries(FRESH)) {
      fs.writeFileSync(path.join(backup, ".new-" + name), text, "utf-8");
    }
    if (snapshot(cwd).fingerprint !== fingerprint) {
      throw new Error("Notes changed during backup; active notes were not reset.");
    }
    for (const name of NOTE_NAMES) {
      fs.renameSync(path.join(backup, ".new-" + name), path.join(state, name));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Reset did not complete. Backup location: ${backup}. ` +
        `Check active notes before continuing. ${message}`
    );
  }
  return { status: "reset", project: path.dirname(state), state, backup };
}

function main(): void {
  const args = process.argv.slice(2);
  let cwdArg: string | undefined;
  let confirmArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd") cwdArg = args[++i];
    else if (args[i] === "--confirm") confirmArg = args[++i];
  }
  if (!cwdArg) {
    console.log(JSON.stringify({ status: "error", message: "--cwd is required" }));
    process.exitCode = 1;
    return;
  }
  try {
    const result = reset(cwdArg, confirmArg);
    console.log(JSON.stringify(result));
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ status: "error", message }));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
