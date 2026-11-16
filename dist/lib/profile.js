"use strict";
/**
 * Small, dependency-free helpers for reading and editing the handful of
 * status lines and sections in a learner's profile.md / progress.md that
 * other tools (status, pause, the SessionStart hook) need to reason about,
 * without parsing the whole file as a learning narrative.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readNoteFile = readNoteFile;
exports.parseProfileFields = parseProfileFields;
exports.extractPendingDecision = extractPendingDecision;
exports.setLearningMode = setLearningMode;
const node_fs_1 = require("node:fs");
function firstMatch(text, label) {
    const match = new RegExp(`^${label}:\\s*(.*)$`, "im").exec(text);
    return match ? match[1].trim() : null;
}
/** Read a note file's text, or null if it's missing, a symlink, or not a regular file. */
function readNoteFile(notePath) {
    let st;
    try {
        st = (0, node_fs_1.lstatSync)(notePath);
    }
    catch {
        return null;
    }
    if (st.isSymbolicLink() || !st.isFile())
        return null;
    try {
        return (0, node_fs_1.readFileSync)(notePath, "utf-8");
    }
    catch {
        return null;
    }
}
/** Pull the handful of status/preference lines out of a profile's text. */
function parseProfileFields(text) {
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
function extractPendingDecision(progressText) {
    const lines = progressText.split("\n");
    const startIndex = lines.findIndex((line) => line.trim() === "## Pending decision");
    if (startIndex === -1)
        return null;
    const rest = lines.slice(startIndex + 1);
    const endOffset = rest.findIndex((line) => /^##\s/.test(line));
    const body = (endOffset === -1 ? rest : rest.slice(0, endOffset)).join("\n").trim();
    return body.length > 0 ? body : null;
}
/**
 * Replace the `Learning mode:` line in a profile's text with the given mode,
 * or insert one at the top if the profile doesn't have one yet.
 */
function setLearningMode(text, mode) {
    const marker = /^Learning mode:.*$/im;
    return marker.test(text) ? text.replace(marker, `Learning mode: ${mode}`) : `Learning mode: ${mode}\n${text}`;
}
