/**
 * Small, dependency-free helpers for reading and editing the handful of
 * status lines and sections in a learner's profile.md / progress.md that
 * other tools (status, pause, the SessionStart hook) need to reason about,
 * without parsing the whole file as a learning narrative.
 */

import { lstatSync, readFileSync } from "node:fs";

export interface ProfileFields {
  learningMode: string | null;
  onboarding: string | null;
  checkpointFrequency: string | null;
  questionStyle: string | null;
  implementationStyle: string | null;
}

function firstMatch(text: string, label: string): string | null {
  const match = new RegExp(`^${label}:\\s*(.*)$`, "im").exec(text);
  return match ? match[1].trim() : null;
}

/** Read a note file's text, or null if it's missing, a symlink, or not a regular file. */
export function readNoteFile(notePath: string): string | null {
  let st;
  try {
    st = lstatSync(notePath);
  } catch {
    return null;
  }
  if (st.isSymbolicLink() || !st.isFile()) return null;
  try {
    return readFileSync(notePath, "utf-8");
  } catch {
    return null;
  }
}

/** Pull the handful of status/preference lines out of a profile's text. */
export function parseProfileFields(text: string): ProfileFields {
  return {
    learningMode: firstMatch(text, "Learning mode"),
    onboarding: firstMatch(text, "Onboarding"),
    checkpointFrequency: firstMatch(text, "Checkpoint frequency"),
    questionStyle: firstMatch(text, "Question style"),
    implementationStyle: firstMatch(text, "Implementation style"),
  };
}

/**
 * Pull the body of a `## Pending decision` section out of progress.md text,
 * stopping at the next `##` heading, or null if there's no such section (or
 * it's present but empty).
 */
export function extractPendingDecision(progressText: string): string | null {
  const lines = progressText.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === "## Pending decision");
  if (startIndex === -1) return null;
  const rest = lines.slice(startIndex + 1);
  const endOffset = rest.findIndex((line) => /^##\s/.test(line));
  const body = (endOffset === -1 ? rest : rest.slice(0, endOffset)).join("\n").trim();
  return body.length > 0 ? body : null;
}

/**
 * Replace the `Learning mode:` line in a profile's text with the given mode,
 * or insert one at the top if the profile doesn't have one yet.
 */
export function setLearningMode(text: string, mode: "active" | "paused"): string {
  const marker = /^Learning mode:.*$/im;
  return marker.test(text) ? text.replace(marker, `Learning mode: ${mode}`) : `Learning mode: ${mode}\n${text}`;
}
