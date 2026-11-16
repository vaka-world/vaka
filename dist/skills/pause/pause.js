"use strict";
/**
 * Explicitly pauses learning mode for a project: sets `Learning mode: paused`
 * in its profile.md and touches nothing else. This is the deterministic form
 * of saying "pause learning" in conversation — no reasoning, no onboarding
 * state, no pending decision is read or changed.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pause = pause;
// A literal `require` binding (see reset.ts) so tests can monkey-patch the
// shared `fs` module object and have this module observe the patch.
const fs = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const profile_1 = require("../../lib/profile");
const state_1 = require("../../lib/state");
function pause(cwdInput) {
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
    const state = (0, state_1.stateDirectory)(cwd);
    if (state === null) {
        return { status: "no_notes", cwd };
    }
    const profilePath = node_path_1.default.join(state, "profile.md");
    let profileStat;
    try {
        profileStat = fs.lstatSync(profilePath);
    }
    catch {
        return { status: "no_notes", cwd };
    }
    // Never write through a symlink, and never treat a directory or anything
    // else at this path as a profile to rewrite.
    if (profileStat.isSymbolicLink() || !profileStat.isFile()) {
        throw new Error("Refusing to modify non-regular profile: " + profilePath);
    }
    const text = fs.readFileSync(profilePath, "utf-8");
    fs.writeFileSync(profilePath, (0, profile_1.setLearningMode)(text, "paused"), "utf-8");
    return { status: "paused", state };
}
function main() {
    const args = process.argv.slice(2);
    let cwdArg;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--cwd")
            cwdArg = args[++i];
    }
    if (!cwdArg) {
        console.log(JSON.stringify({ status: "error", message: "--cwd is required" }));
        process.exitCode = 1;
        return;
    }
    try {
        console.log(JSON.stringify(pause(cwdArg)));
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
