/**
 * Shared helpers for locating and validating this project's learning-notes
 * directory. Used by both the SessionStart hook and the reset command so
 * they agree on exactly which directory a given working directory resolves to.
 */

import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";

export const STATE_DIR_NAME = ".cognition";

/** Find the nearest repository or worktree root (a `.git` directory or file). */
export function gitRoot(cwd: string): string | null {
  let dir = cwd;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Find the nearest `.cognition` notes directory without crossing a Git
 * project boundary. Without Git, only `cwd` itself is checked: searching
 * parents could otherwise adopt notes from an unrelated ancestor folder.
 *
 * Stops at the first directory where something exists at the candidate
 * path, even if it is unusable (a file or a symlink) — it never falls back
 * to a more distant ancestor in that case.
 */
export function stateDirectory(cwd: string): string | null {
  const root = gitRoot(cwd);
  const candidates: string[] = [];
  if (root === null) {
    candidates.push(cwd);
  } else {
    let dir = cwd;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      candidates.push(dir);
      if (dir === root) break;
      dir = path.dirname(dir);
    }
  }

  for (const dir of candidates) {
    const candidate = path.join(dir, STATE_DIR_NAME);
    let st;
    try {
      st = lstatSync(candidate);
    } catch {
      continue; // Doesn't exist at this level; check the next one up.
    }
    if (st.isSymbolicLink()) return null; // Never follow a linked state directory.
    return st.isDirectory() ? candidate : null;
  }
  return null;
}

/** Check activation without copying learner notes into hook output. */
export function profileIsActive(profilePath: string): boolean {
  let st;
  try {
    st = lstatSync(profilePath);
  } catch {
    return false;
  }
  // A linked profile could point outside the selected project's learning notes.
  if (st.isSymbolicLink() || !st.isFile()) return false;

  let text: string;
  try {
    const buffer = readFileSync(profilePath);
    // Strict decoding: invalid UTF-8 is treated like an unreadable profile,
    // not silently replaced with placeholder characters.
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return false;
  }

  let hasContent = false;
  // No leading \s* on purpose: a paused marker indented or preceded by other
  // text on the same line should not count, matching a line that is exactly
  // "Learning mode: paused" (trailing whitespace/newline tolerated).
  const pausedLine = /^learning mode:\s*paused\s*$/i;
  // Scan the whole file: a paused marker can appear after a long profile.
  for (const line of text.split("\n")) {
    if (line.trim() !== "") hasContent = true;
    if (pausedLine.test(line)) return false;
  }
  // Older profiles may lack an explicit mode. Preserve their restoration behavior.
  return hasContent;
}
