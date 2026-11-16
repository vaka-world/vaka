"use strict";
/**
 * Shared helpers for locating and validating this project's learning-notes
 * directory. Used by both the SessionStart hook and the reset command so
 * they agree on exactly which directory a given working directory resolves to.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_DIR_NAME = void 0;
exports.gitRoot = gitRoot;
exports.stateDirectory = stateDirectory;
exports.profileIsActive = profileIsActive;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
exports.STATE_DIR_NAME = ".vaka";
/** Find the nearest repository or worktree root (a `.git` directory or file). */
function gitRoot(cwd) {
    let dir = cwd;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        if ((0, node_fs_1.existsSync)(node_path_1.default.join(dir, ".git")))
            return dir;
        const parent = node_path_1.default.dirname(dir);
        if (parent === dir)
            return null;
        dir = parent;
    }
}
/**
 * Find the nearest `.vaka` notes directory without crossing a Git
 * project boundary. Without Git, only `cwd` itself is checked: searching
 * parents could otherwise adopt notes from an unrelated ancestor folder.
 *
 * Stops at the first directory where something exists at the candidate
 * path, even if it is unusable (a file or a symlink) — it never falls back
 * to a more distant ancestor in that case.
 */
function stateDirectory(cwd) {
    const root = gitRoot(cwd);
    const candidates = [];
    if (root === null) {
        candidates.push(cwd);
    }
    else {
        let dir = cwd;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            candidates.push(dir);
            if (dir === root)
                break;
            dir = node_path_1.default.dirname(dir);
        }
    }
    for (const dir of candidates) {
        const candidate = node_path_1.default.join(dir, exports.STATE_DIR_NAME);
        let st;
        try {
            st = (0, node_fs_1.lstatSync)(candidate);
        }
        catch {
            continue; // Doesn't exist at this level; check the next one up.
        }
        if (st.isSymbolicLink())
            return null; // Never follow a linked state directory.
        return st.isDirectory() ? candidate : null;
    }
    return null;
}
/** Check activation without copying learner notes into hook output. */
function profileIsActive(profilePath) {
    let st;
    try {
        st = (0, node_fs_1.lstatSync)(profilePath);
    }
    catch {
        return false;
    }
    // A linked profile could point outside the selected project's learning notes.
    if (st.isSymbolicLink() || !st.isFile())
        return false;
    let text;
    try {
        const buffer = (0, node_fs_1.readFileSync)(profilePath);
        // Strict decoding: invalid UTF-8 is treated like an unreadable profile,
        // not silently replaced with placeholder characters.
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    }
    catch {
        return false;
    }
    let hasContent = false;
    // No leading \s* on purpose: a paused marker indented or preceded by other
    // text on the same line should not count, matching a line that is exactly
    // "Learning mode: paused" (trailing whitespace/newline tolerated).
    const pausedLine = /^learning mode:\s*paused\s*$/i;
    // Scan the whole file: a paused marker can appear after a long profile.
    for (const line of text.split("\n")) {
        if (line.trim() !== "")
            hasContent = true;
        if (pausedLine.test(line))
            return false;
    }
    // Older profiles may lack an explicit mode. Preserve their restoration behavior.
    return hasContent;
}
