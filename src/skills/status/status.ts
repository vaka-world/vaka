/**
 * Reports a project's current learning-mode status without running Learn's
 * full resume flow: the saved mode, onboarding state, preferences, and
 * whatever's recorded as a pending decision. Read-only — writes nothing.
 */

import { lstatSync } from "node:fs";
import path from "node:path";
import { extractPendingDecision, parseProfileFields, readNoteFile } from "../../lib/profile";
import { stateDirectory } from "../../lib/state";

export type StatusResult =
  | { status: "no_notes"; cwd: string }
  | {
      status: "found";
      state: string;
      learningMode: string | null;
      onboarding: string | null;
      preferences: {
        checkpointFrequency: string | null;
        questionStyle: string | null;
        implementationStyle: string | null;
      };
      pendingDecision: string | null;
    };

export function status(cwdInput: string): StatusResult {
  if (!path.isAbsolute(cwdInput)) {
    throw new Error("Use an existing absolute project working directory.");
  }
  let dirStat;
  try {
    dirStat = lstatSync(cwdInput);
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

  const profileText = readNoteFile(path.join(state, "profile.md"));
  const fields =
    profileText === null
      ? {
          learningMode: null,
          onboarding: null,
          checkpointFrequency: null,
          questionStyle: null,
          implementationStyle: null,
        }
      : parseProfileFields(profileText);

  const progressText = readNoteFile(path.join(state, "progress.md"));
  const pendingDecision = progressText === null ? null : extractPendingDecision(progressText);

  return {
    status: "found",
    state,
    learningMode: fields.learningMode,
    onboarding: fields.onboarding,
    preferences: {
      checkpointFrequency: fields.checkpointFrequency,
      questionStyle: fields.questionStyle,
      implementationStyle: fields.implementationStyle,
    },
    pendingDecision,
  };
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
    console.log(JSON.stringify(status(cwdArg)));
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
