"use strict";
/**
 * `cognition init` — vendors Cognition's own skill guides (the source of
 * truth under `skills/`) into the current project, for people who installed
 * this as an npm package instead of a Claude Code / Codex plugin. Modeled on
 * Vaka's `vaka init` (apps/cli/src/commands/init.ts): same file-safety
 * helpers (refuse symlinks, create-if-missing, atomic merge), adapted to
 * Cognition's own skill set and to rewriting `${CLAUDE_PLUGIN_ROOT}`
 * references into direct CLI calls instead of a vendored plugin path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeProject = initializeProject;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const SKILL_NAMES = ["learn", "pause", "reset", "status"];
function vendoredName(name) {
    return `cognition-${name}`;
}
function isMissing(error) {
    return (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
}
function isAlreadyExists(error) {
    return (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST");
}
async function inspectPath(path) {
    try {
        const stat = await (0, promises_1.lstat)(path);
        if (stat.isSymbolicLink()) {
            throw new Error(`Refusing to follow symbolic link: ${path}`);
        }
        if (stat.isDirectory())
            return "directory";
        if (stat.isFile())
            return "file";
        return undefined;
    }
    catch (error) {
        if (isMissing(error))
            return undefined;
        throw error;
    }
}
/**
 * `cognition init` always creates `.claude/skills/cognition-<name>`, so a bare
 * `.claude` directory whose only content is Cognition's own skills must not
 * itself be read back as "this project already uses Claude Code" on a later
 * run — that would start merging a SessionStart hook into settings.json for
 * projects that never otherwise touched Claude Code.
 */
async function hasPreExistingClaudeDirectoryMarker(projectRoot) {
    const claudeDirectoryPath = (0, node_path_1.join)(projectRoot, ".claude");
    if ((await inspectPath(claudeDirectoryPath)) !== "directory")
        return false;
    const entries = await (0, promises_1.readdir)(claudeDirectoryPath);
    return entries.length === 0 || entries.some((entry) => entry !== "skills");
}
async function detectIntegrations(projectRoot) {
    const [claudeManifest, hasClaudeDirectoryMarker, codexManifest, codexDirectory] = await Promise.all([
        inspectPath((0, node_path_1.join)(projectRoot, "CLAUDE.md")),
        hasPreExistingClaudeDirectoryMarker(projectRoot),
        inspectPath((0, node_path_1.join)(projectRoot, "AGENTS.md")),
        inspectPath((0, node_path_1.join)(projectRoot, ".codex")),
    ]);
    const integrations = [];
    if (claudeManifest === "file" || hasClaudeDirectoryMarker)
        integrations.push("claude");
    if (codexManifest === "file" || codexDirectory === "directory")
        integrations.push("codex");
    return integrations;
}
async function ensureDirectory(projectRoot, relativePath) {
    const absolutePath = (0, node_path_1.resolve)(projectRoot, relativePath);
    const fromRoot = (0, node_path_1.relative)(projectRoot, absolutePath);
    if (fromRoot.startsWith("..") || (0, node_path_1.isAbsolute)(fromRoot)) {
        throw new Error(`Refusing to create a directory outside the project: ${relativePath}`);
    }
    const segments = fromRoot.split(/[/\\]/).filter(Boolean);
    let current = projectRoot;
    for (const segment of segments) {
        current = (0, node_path_1.join)(current, segment);
        const existing = await inspectPath(current);
        if (existing === "file") {
            throw new Error(`Expected a directory, found a file: ${current}`);
        }
        if (existing === undefined) {
            try {
                await (0, promises_1.mkdir)(current, { mode: 0o755 });
            }
            catch (error) {
                if (!isAlreadyExists(error))
                    throw error;
            }
            if ((await inspectPath(current)) !== "directory") {
                throw new Error(`Could not safely create directory: ${current}`);
            }
        }
    }
}
async function createIfMissing(projectRoot, relativePath, contents) {
    const absolutePath = (0, node_path_1.resolve)(projectRoot, relativePath);
    const parent = (0, node_path_1.relative)(projectRoot, absolutePath).split(/[/\\]/).slice(0, -1).join("/");
    if (parent)
        await ensureDirectory(projectRoot, parent);
    try {
        await (0, promises_1.writeFile)(absolutePath, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });
        return "created";
    }
    catch (error) {
        if (isAlreadyExists(error))
            return "skipped";
        throw error;
    }
}
async function writeJsonAtomic(absolutePath, data) {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    const stat = await inspectPath(absolutePath);
    if (stat === undefined) {
        try {
            await (0, promises_1.writeFile)(absolutePath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
            return;
        }
        catch (error) {
            if (!isAlreadyExists(error))
                throw error;
        }
    }
    const temporaryPath = (0, node_path_1.join)((0, node_path_1.dirname)(absolutePath), `.${(0, node_path_1.basename)(absolutePath)}.${(0, node_crypto_1.randomUUID)()}.tmp`);
    try {
        await (0, promises_1.writeFile)(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
        await (0, promises_1.rename)(temporaryPath, absolutePath);
    }
    catch (error) {
        try {
            await (0, promises_1.unlink)(temporaryPath);
        }
        catch (cleanupError) {
            if (!isMissing(cleanupError)) {
                throw new AggregateError([error, cleanupError], `Could not update ${absolutePath} or clean up ${temporaryPath}.`);
            }
        }
        throw error;
    }
}
/** Throws instead of silently no-op'ing if the skill guides drift from what this rewrite expects. */
function replaceOnce(text, search, replacement, label) {
    if (!text.includes(search)) {
        throw new Error(`cognition init: expected to find ${label} while vendoring a skill guide, but it was not there.`);
    }
    return text.replace(search, replacement);
}
function removeLineOnce(text, line, label) {
    return replaceOnce(text, `${line}\n`, "", label);
}
// Exact text captured from skills/*/SKILL.md and skills/*/codex.md. Kept as
// plain (non-template) strings so `${CLAUDE_PLUGIN_ROOT}` stays literal text,
// never a JS interpolation.
const PAUSE_CMD_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/pause/pause.js" --cwd "<absolute project directory>"';
const STATUS_CMD_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/status/status.js" --cwd "<absolute project directory>"';
const RESET_CMD1_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<absolute project directory>"';
const RESET_CMD2_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<original cwd>" --confirm "<confirmation>"';
const RESET_LEARN_PATH_OLD = "`${CLAUDE_PLUGIN_ROOT}/skills/learn/SKILL.md`";
const LEARN_CODEX_PATHS_OLD = "- **Paths:** Codex doesn't expand `${CLAUDE_PLUGIN_ROOT}`. From this file, the plugin root is two directories up; the other guides (behavior.md, onboarding.md, state-templates.md) sit right next to this one.";
const LEARN_CODEX_PATHS_NEW = "- **Paths:** This is a vendored install, not a plugin — there's no plugin root to resolve. The other guides (behavior.md, onboarding.md, state-templates.md) sit right next to this one.";
const PAUSE_CODEX_PATHS_OLD = "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `pause.js` as `../../dist/skills/pause/pause.js` relative to this file, and use its absolute path.";
const STATUS_CODEX_PATHS_OLD = "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `status.js` as `../../dist/skills/status/status.js` relative to this file, and use its absolute path.";
const RESET_CODEX_PATHS_OLD = "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `reset.js` as `../../dist/skills/reset/reset.js` relative to this file, and use its absolute path when invoking `node`. The Learn guide is `../learn/SKILL.md` relative to this file.";
function rewriteCommandNames(text) {
    return text.split("/cognition:").join("/cognition-").split("$cognition:").join("$cognition-");
}
function rewriteSkillMdFrontmatterName(text, name) {
    return replaceOnce(text, `name: ${name}`, `name: ${vendoredName(name)}`, `the "${name}" frontmatter name`);
}
function rewriteFileContents(name, fileName, text, ctx) {
    let out = rewriteCommandNames(text);
    if (fileName === "SKILL.md") {
        out = rewriteSkillMdFrontmatterName(out, name);
    }
    if (name === "pause" && fileName === "SKILL.md") {
        out = replaceOnce(out, PAUSE_CMD_OLD, `${ctx.npxCommand} pause --cwd "<absolute project directory>"`, "pause's node command");
    }
    if (name === "status" && fileName === "SKILL.md") {
        out = replaceOnce(out, STATUS_CMD_OLD, `${ctx.npxCommand} status --cwd "<absolute project directory>"`, "status's node command");
    }
    if (name === "reset" && fileName === "SKILL.md") {
        out = replaceOnce(out, RESET_CMD1_OLD, `${ctx.npxCommand} reset --cwd "<absolute project directory>"`, "reset's preview node command");
        out = replaceOnce(out, RESET_CMD2_OLD, `${ctx.npxCommand} reset --cwd "<original cwd>" --confirm "<confirmation>"`, "reset's confirm node command");
        out = replaceOnce(out, RESET_LEARN_PATH_OLD, `\`${ctx.learnSkillMdPath}\``, "reset's pointer back to the Learn guide");
    }
    if (name === "learn" && fileName === "codex.md") {
        out = replaceOnce(out, LEARN_CODEX_PATHS_OLD, LEARN_CODEX_PATHS_NEW, "learn's codex.md Paths bullet");
    }
    if (name === "pause" && fileName === "codex.md") {
        out = removeLineOnce(out, PAUSE_CODEX_PATHS_OLD, "pause's codex.md Paths bullet");
    }
    if (name === "status" && fileName === "codex.md") {
        out = removeLineOnce(out, STATUS_CODEX_PATHS_OLD, "status's codex.md Paths bullet");
    }
    if (name === "reset" && fileName === "codex.md") {
        out = removeLineOnce(out, RESET_CODEX_PATHS_OLD, "reset's codex.md Paths bullet");
    }
    return out;
}
async function vendorSkillsInto(packageRoot, projectRoot, destTreeRelative, npxCommand, result) {
    const learnSkillMdPath = (0, node_path_1.resolve)(projectRoot, destTreeRelative, vendoredName("learn"), "SKILL.md");
    const ctx = { npxCommand, learnSkillMdPath };
    for (const name of SKILL_NAMES) {
        const sourceDir = (0, node_path_1.join)(packageRoot, "skills", name);
        const entries = await (0, promises_1.readdir)(sourceDir, { withFileTypes: true });
        const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
        for (const fileName of files) {
            const raw = await (0, promises_1.readFile)((0, node_path_1.join)(sourceDir, fileName), "utf8");
            const rewritten = rewriteFileContents(name, fileName, raw, ctx);
            const relativePath = (0, node_path_1.join)(destTreeRelative, vendoredName(name), fileName);
            const status = await createIfMissing(projectRoot, relativePath, rewritten);
            result[status].push(relativePath);
        }
    }
}
const SESSION_START_MATCHER = "startup|resume|clear|compact|fork";
async function mergeSessionStartHook(projectRoot, npxCommand) {
    const settingsPath = (0, node_path_1.resolve)(projectRoot, ".claude", "settings.json");
    const command = `${npxCommand} hook session-start`;
    const existingStat = await inspectPath(settingsPath);
    let settings = {};
    if (existingStat === "file") {
        const text = await (0, promises_1.readFile)(settingsPath, "utf8");
        try {
            settings = JSON.parse(text);
        }
        catch {
            throw new Error(`Refusing to modify malformed JSON: ${settingsPath}`);
        }
    }
    else if (existingStat === "directory") {
        throw new Error(`Expected a regular file, found a directory: ${settingsPath}`);
    }
    const hooks = (settings.hooks ?? {});
    const sessionStart = hooks.SessionStart;
    if (sessionStart !== undefined && !Array.isArray(sessionStart)) {
        throw new Error(`Refusing to modify malformed hooks.SessionStart in: ${settingsPath}`);
    }
    const groups = (sessionStart ?? []);
    const alreadyPresent = groups.some((group) => group.hooks?.some((hook) => hook.command?.includes(command)));
    if (alreadyPresent) {
        return "already-present";
    }
    const updatedGroups = [
        ...groups,
        { matcher: SESSION_START_MATCHER, hooks: [{ type: "command", command, timeout: 5 }] },
    ];
    await ensureDirectory(projectRoot, ".claude");
    await writeJsonAtomic(settingsPath, { ...settings, hooks: { ...hooks, SessionStart: updatedGroups } });
    return "added";
}
function defaultPackageRoot() {
    // This file lives at <package root>/dist/cli/commands/, or at
    // <package root>/src/cli/commands/ when run directly from source (tests).
    return (0, node_path_1.resolve)(__dirname, "..", "..", "..");
}
async function initializeProject(projectPath, options = {}) {
    const projectRoot = (0, node_path_1.resolve)(projectPath);
    if ((await inspectPath(projectRoot)) !== "directory") {
        throw new Error(`Project path is not a directory: ${projectRoot}`);
    }
    const packageRoot = options.packageRoot ?? defaultPackageRoot();
    const packageJson = JSON.parse(await (0, promises_1.readFile)((0, node_path_1.join)(packageRoot, "package.json"), "utf8"));
    const npxCommand = `npx --yes ${packageJson.name}`;
    const integrations = await detectIntegrations(projectRoot);
    const result = { integrations, created: [], skipped: [], hook: "not-applicable" };
    await vendorSkillsInto(packageRoot, projectRoot, ".claude/skills", npxCommand, result);
    await vendorSkillsInto(packageRoot, projectRoot, ".agents/skills", npxCommand, result);
    if (integrations.includes("claude")) {
        result.hook = await mergeSessionStartHook(projectRoot, npxCommand);
    }
    return result;
}
