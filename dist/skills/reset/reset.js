"use strict";
/**
 * Shows what resetting would do by default; only actually replaces a note
 * once the caller echoes back the exact snapshot fingerprint from that preview.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRESH = void 0;
exports.snapshot = snapshot;
exports.reset = reset;
const node_crypto_1 = require("node:crypto");
// A literal `require` binding (rather than an ES namespace import) so tests
// can monkey-patch the single shared `fs` module object and have this module
// observe the patch, instead of each holding its own copied namespace.
const fs = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const state_1 = require("../../lib/state");
exports.FRESH = {
    "profile.md": "# Learner Profile\n\nLearning mode: active\nOnboarding: incomplete\n" +
        "Onboarding reset: pending\n\n" +
        "Still to cover: project situation, experience level, stack familiarity, " +
        "goals, and preferences.\n",
    "progress.md": "# Learning Progress\n\nNothing recorded yet.\n",
    "project-map.md": "# Project Map\n\nNot mapped yet — inspect the project before filling this in.\n",
};
const NOTE_NAMES = Object.keys(exports.FRESH);
function fingerprintOf(state, notes) {
    // Include identity, missing files, and content so confirmation cannot drift
    // to another project or silently discard notes updated by another session.
    const digest = (0, node_crypto_1.createHash)("sha256");
    digest.update(state);
    for (const name of NOTE_NAMES) {
        const data = notes[name];
        digest.update(JSON.stringify([name, data ? data.toString("hex") : null]));
    }
    return digest.digest("hex");
}
function snapshot(cwd) {
    const state = (0, state_1.stateDirectory)(cwd);
    if (state === null)
        return { state: null, notes: {}, fingerprint: null };
    const notes = {};
    for (const name of NOTE_NAMES) {
        const notePath = node_path_1.default.join(state, name);
        let st;
        try {
            st = fs.lstatSync(notePath);
        }
        catch {
            continue;
        }
        if (!st.isFile()) {
            throw new Error("Refusing to reset non-regular note: " + notePath);
        }
        notes[name] = fs.readFileSync(notePath);
    }
    return { state, notes, fingerprint: fingerprintOf(state, notes) };
}
function timestampPrefix(now) {
    const pad = (n) => String(n).padStart(2, "0");
    return (`reset-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
        `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z-`);
}
function reset(cwdInput, confirmation) {
    if (!node_path_1.default.isAbsolute(cwdInput)) {
        throw new Error("Use an existing absolute project working directory.");
    }
    let dirStat;
    try {
        dirStat = fs.lstatSync(cwdInput);
    }
    catch {
        throw new Error("Use an existing absolute project working directory.");
    }
    if (!dirStat.isDirectory()) {
        throw new Error("Use an existing absolute project working directory.");
    }
    const cwd = node_path_1.default.resolve(cwdInput);
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
            project: node_path_1.default.dirname(state),
            state,
            files: Object.keys(notes),
            backup_parent: node_path_1.default.join(state, "backups"),
            confirmation: fingerprint,
        };
    }
    const backupParent = node_path_1.default.join(state, "backups");
    let backupParentStat;
    try {
        backupParentStat = fs.lstatSync(backupParent);
    }
    catch {
        backupParentStat = null;
    }
    if (backupParentStat && (backupParentStat.isSymbolicLink() || !backupParentStat.isDirectory())) {
        throw new Error("Backup path must be a real directory; nothing reset.");
    }
    if (!backupParentStat) {
        fs.mkdirSync(backupParent, { mode: 0o700 });
    }
    const backup = fs.mkdtempSync(node_path_1.default.join(backupParent, timestampPrefix(new Date())));
    try {
        // Finish all backups and prepare replacements before touching active notes.
        for (const [name, data] of Object.entries(notes)) {
            fs.writeFileSync(node_path_1.default.join(backup, name), data);
        }
        for (const [name, text] of Object.entries(exports.FRESH)) {
            fs.writeFileSync(node_path_1.default.join(backup, ".new-" + name), text, "utf-8");
        }
        if (snapshot(cwd).fingerprint !== fingerprint) {
            throw new Error("Notes changed during backup; active notes were not reset.");
        }
        for (const name of NOTE_NAMES) {
            fs.renameSync(node_path_1.default.join(backup, ".new-" + name), node_path_1.default.join(state, name));
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Reset did not complete. Backup location: ${backup}. ` +
            `Check active notes before continuing. ${message}`);
    }
    return { status: "reset", project: node_path_1.default.dirname(state), state, backup };
}
function main() {
    const args = process.argv.slice(2);
    let cwdArg;
    let confirmArg;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--cwd")
            cwdArg = args[++i];
        else if (args[i] === "--confirm")
            confirmArg = args[++i];
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(JSON.stringify({ status: "error", message }));
        process.exitCode = 1;
    }
}
if (require.main === module) {
    main();
}
