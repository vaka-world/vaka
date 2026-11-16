/**
 * Explicitly pauses learning mode for a project: sets `Learning mode: paused`
 * in its profile.md and touches nothing else. This is the deterministic form
 * of saying "pause learning" in conversation — no reasoning, no onboarding
 * state, no pending decision is read or changed.
 */

// A literal `require` binding (see reset.ts) so tests can monkey-patch the
// shared `fs` module object and have this module observe the patch.
import fs = require("node:fs");
import path from "node:path";
import { setLearningMode } from "../../lib/profile";
import { stateDirectory } from "../../lib/state";

export type PauseResult = { status: "no_notes"; cwd: string } | { status: "paused"; state: string };

export function pause(cwdInput: string): PauseResult {
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

  const state = stateDirectory(cwd);
  if (state === null) {
    return { status: "no_notes", cwd };
  }

  const profilePath = path.join(state, "profile.md");
  let profileStat;
  try {
    profileStat = fs.lstatSync(profilePath);
  } catch {
    return { status: "no_notes", cwd };
  }
  // Never write through a symlink, and never treat a directory or anything
  // else at this path as a profile to rewrite.
  if (profileStat.isSymbolicLink() || !profileStat.isFile()) {
    throw new Error("Refusing to modify non-regular profile: " + profilePath);
  }

  const text = fs.readFileSync(profilePath, "utf-8");
  fs.writeFileSync(profilePath, setLearningMode(text, "paused"), "utf-8");
  return { status: "paused", state };
}

function main(): void {
  const args = process.argv.slice(2);
  let cwdArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd") cwdArg = args[++i];
  }
  if (!cwdArg) {
    console.log(JSON.stringify({ status: "error", message: "--cwd is required" }));
    process.exitCode = 1;
    return;
  }
  try {
    console.log(JSON.stringify(pause(cwdArg)));
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
