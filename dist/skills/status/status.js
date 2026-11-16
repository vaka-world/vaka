"use strict";
/**
 * Reports a project's current learning-mode status without running Learn's
 * full resume flow: the saved mode, onboarding state, preferences, and
 * whatever's recorded as a pending decision. Read-only — writes nothing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.status = status;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const profile_1 = require("../../lib/profile");
const state_1 = require("../../lib/state");
function status(cwdInput) {
    if (!node_path_1.default.isAbsolute(cwdInput)) {
        throw new Error("Use an existing absolute project working directory.");
    }
    let dirStat;
    try {
        dirStat = (0, node_fs_1.lstatSync)(cwdInput);
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
    const profileText = (0, profile_1.readNoteFile)(node_path_1.default.join(state, "profile.md"));
    const fields = profileText === null
        ? {
            learningMode: null,
            onboarding: null,
            checkpointFrequency: null,
            questionStyle: null,
            implementationStyle: null,
        }
        : (0, profile_1.parseProfileFields)(profileText);
    const progressText = (0, profile_1.readNoteFile)(node_path_1.default.join(state, "progress.md"));
    const pendingDecision = progressText === null ? null : (0, profile_1.extractPendingDecision)(progressText);
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
        console.log(JSON.stringify(status(cwdArg)));
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
