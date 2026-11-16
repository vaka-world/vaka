/**
 * `cognition init` — vendors Cognition's own skill guides (the source of
 * truth under `skills/`) into the current project, for people who installed
 * this as an npm package instead of a Claude Code / Codex plugin. Modeled on
 * Vaka's `vaka init` (apps/cli/src/commands/init.ts): same file-safety
 * helpers (refuse symlinks, create-if-missing, atomic merge), adapted to
 * Cognition's own skill set and to rewriting `${CLAUDE_PLUGIN_ROOT}`
 * references into direct CLI calls instead of a vendored plugin path.
 */

import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

export type Integration = "claude" | "codex";
export type HookStatus = "added" | "already-present" | "not-applicable";

export interface InitResult {
  integrations: Integration[];
  created: string[];
  skipped: string[];
  hook: HookStatus;
}

export interface InitOptions {
  /** Root of the installed Cognition package (where `skills/` lives). Defaults to this module's own package. */
  packageRoot?: string;
}

const SKILL_NAMES = ["learn", "pause", "reset", "status"] as const;
type SkillName = (typeof SKILL_NAMES)[number];

function vendoredName(name: SkillName): string {
  return `cognition-${name}`;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

async function inspectPath(path: string): Promise<"file" | "directory" | undefined> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to follow symbolic link: ${path}`);
    }
    if (stat.isDirectory()) return "directory";
    if (stat.isFile()) return "file";
    return undefined;
  } catch (error) {
    if (isMissing(error)) return undefined;
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
async function hasPreExistingClaudeDirectoryMarker(projectRoot: string): Promise<boolean> {
  const claudeDirectoryPath = join(projectRoot, ".claude");
  if ((await inspectPath(claudeDirectoryPath)) !== "directory") return false;
  const entries = await readdir(claudeDirectoryPath);
  return entries.length === 0 || entries.some((entry) => entry !== "skills");
}

async function detectIntegrations(projectRoot: string): Promise<Integration[]> {
  const [claudeManifest, hasClaudeDirectoryMarker, codexManifest, codexDirectory] = await Promise.all([
    inspectPath(join(projectRoot, "CLAUDE.md")),
    hasPreExistingClaudeDirectoryMarker(projectRoot),
    inspectPath(join(projectRoot, "AGENTS.md")),
    inspectPath(join(projectRoot, ".codex")),
  ]);

  const integrations: Integration[] = [];
  if (claudeManifest === "file" || hasClaudeDirectoryMarker) integrations.push("claude");
  if (codexManifest === "file" || codexDirectory === "directory") integrations.push("codex");
  return integrations;
}

async function ensureDirectory(projectRoot: string, relativePath: string): Promise<void> {
  const absolutePath = resolve(projectRoot, relativePath);
  const fromRoot = relative(projectRoot, absolutePath);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Refusing to create a directory outside the project: ${relativePath}`);
  }

  const segments = fromRoot.split(/[/\\]/).filter(Boolean);
  let current = projectRoot;
  for (const segment of segments) {
    current = join(current, segment);
    const existing = await inspectPath(current);
    if (existing === "file") {
      throw new Error(`Expected a directory, found a file: ${current}`);
    }
    if (existing === undefined) {
      try {
        await mkdir(current, { mode: 0o755 });
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
      }
      if ((await inspectPath(current)) !== "directory") {
        throw new Error(`Could not safely create directory: ${current}`);
      }
    }
  }
}

async function createIfMissing(projectRoot: string, relativePath: string, contents: string): Promise<"created" | "skipped"> {
  const absolutePath = resolve(projectRoot, relativePath);
  const parent = relative(projectRoot, absolutePath).split(/[/\\]/).slice(0, -1).join("/");
  if (parent) await ensureDirectory(projectRoot, parent);

  try {
    await writeFile(absolutePath, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });
    return "created";
  } catch (error) {
    if (isAlreadyExists(error)) return "skipped";
    throw error;
  }
}

async function writeJsonAtomic(absolutePath: string, data: unknown): Promise<void> {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const stat = await inspectPath(absolutePath);
  if (stat === undefined) {
    try {
      await writeFile(absolutePath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
      return;
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  }

  const temporaryPath = join(dirname(absolutePath), `.${basename(absolutePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
    await rename(temporaryPath, absolutePath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (!isMissing(cleanupError)) {
        throw new AggregateError([error, cleanupError], `Could not update ${absolutePath} or clean up ${temporaryPath}.`);
      }
    }
    throw error;
  }
}

/** Throws instead of silently no-op'ing if the skill guides drift from what this rewrite expects. */
function replaceOnce(text: string, search: string, replacement: string, label: string): string {
  if (!text.includes(search)) {
    throw new Error(`cognition init: expected to find ${label} while vendoring a skill guide, but it was not there.`);
  }
  return text.replace(search, replacement);
}

function removeLineOnce(text: string, line: string, label: string): string {
  return replaceOnce(text, `${line}\n`, "", label);
}

// Exact text captured from skills/*/SKILL.md and skills/*/codex.md. Kept as
// plain (non-template) strings so `${CLAUDE_PLUGIN_ROOT}` stays literal text,
// never a JS interpolation.
const PAUSE_CMD_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/pause/pause.js" --cwd "<absolute project directory>"';
const STATUS_CMD_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/status/status.js" --cwd "<absolute project directory>"';
const RESET_CMD1_OLD = 'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<absolute project directory>"';
const RESET_CMD2_OLD =
  'node "${CLAUDE_PLUGIN_ROOT}/dist/skills/reset/reset.js" --cwd "<original cwd>" --confirm "<confirmation>"';
const RESET_LEARN_PATH_OLD = "`${CLAUDE_PLUGIN_ROOT}/skills/learn/SKILL.md`";

const LEARN_CODEX_PATHS_OLD =
  "- **Paths:** Codex doesn't expand `${CLAUDE_PLUGIN_ROOT}`. From this file, the plugin root is two directories up; the other guides (behavior.md, onboarding.md, state-templates.md) sit right next to this one.";
const LEARN_CODEX_PATHS_NEW =
  "- **Paths:** This is a vendored install, not a plugin — there's no plugin root to resolve. The other guides (behavior.md, onboarding.md, state-templates.md) sit right next to this one.";

const PAUSE_CODEX_PATHS_OLD =
  "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `pause.js` as `../../dist/skills/pause/pause.js` relative to this file, and use its absolute path.";
const STATUS_CODEX_PATHS_OLD =
  "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `status.js` as `../../dist/skills/status/status.js` relative to this file, and use its absolute path.";
const RESET_CODEX_PATHS_OLD =
  "- **Paths:** `${CLAUDE_PLUGIN_ROOT}` isn't expanded here. Resolve `reset.js` as `../../dist/skills/reset/reset.js` relative to this file, and use its absolute path when invoking `node`. The Learn guide is `../learn/SKILL.md` relative to this file.";

function rewriteCommandNames(text: string): string {
  return text.split("/cognition:").join("/cognition-").split("$cognition:").join("$cognition-");
}

function rewriteSkillMdFrontmatterName(text: string, name: SkillName): string {
  return replaceOnce(text, `name: ${name}`, `name: ${vendoredName(name)}`, `the "${name}" frontmatter name`);
}

interface RewriteContext {
  npxCommand: string;
  /** Absolute path, in this destination tree, to the vendored learn skill's SKILL.md. */
  learnSkillMdPath: string;
}

function rewriteFileContents(name: SkillName, fileName: string, text: string, ctx: RewriteContext): string {
  let out = rewriteCommandNames(text);

  if (fileName === "SKILL.md") {
    out = rewriteSkillMdFrontmatterName(out, name);
  }

  if (name === "pause" && fileName === "SKILL.md") {
    out = replaceOnce(out, PAUSE_CMD_OLD, `${ctx.npxCommand} pause --cwd "<absolute project directory>"`, "pause's node command");
  }
  if (name === "status" && fileName === "SKILL.md") {
    out = replaceOnce(
      out,
      STATUS_CMD_OLD,
      `${ctx.npxCommand} status --cwd "<absolute project directory>"`,
      "status's node command"
    );
  }
  if (name === "reset" && fileName === "SKILL.md") {
    out = replaceOnce(
      out,
      RESET_CMD1_OLD,
      `${ctx.npxCommand} reset --cwd "<absolute project directory>"`,
      "reset's preview node command"
    );
    out = replaceOnce(
      out,
      RESET_CMD2_OLD,
      `${ctx.npxCommand} reset --cwd "<original cwd>" --confirm "<confirmation>"`,
      "reset's confirm node command"
    );
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

async function vendorSkillsInto(
  packageRoot: string,
  projectRoot: string,
  destTreeRelative: string,
  npxCommand: string,
  result: InitResult
): Promise<void> {
  const learnSkillMdPath = resolve(projectRoot, destTreeRelative, vendoredName("learn"), "SKILL.md");
  const ctx: RewriteContext = { npxCommand, learnSkillMdPath };

  for (const name of SKILL_NAMES) {
    const sourceDir = join(packageRoot, "skills", name);
    const entries = await readdir(sourceDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

    for (const fileName of files) {
      const raw = await readFile(join(sourceDir, fileName), "utf8");
      const rewritten = rewriteFileContents(name, fileName, raw, ctx);
      const relativePath = join(destTreeRelative, vendoredName(name), fileName);
      const status = await createIfMissing(projectRoot, relativePath, rewritten);
      result[status].push(relativePath);
    }
  }
}

const SESSION_START_MATCHER = "startup|resume|clear|compact|fork";

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}
interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

async function mergeSessionStartHook(projectRoot: string, npxCommand: string): Promise<HookStatus> {
  const settingsPath = resolve(projectRoot, ".claude", "settings.json");
  const command = `${npxCommand} hook session-start`;

  const existingStat = await inspectPath(settingsPath);
  let settings: Record<string, unknown> = {};
  if (existingStat === "file") {
    const text = await readFile(settingsPath, "utf8");
    try {
      settings = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Refusing to modify malformed JSON: ${settingsPath}`);
    }
  } else if (existingStat === "directory") {
    throw new Error(`Expected a regular file, found a directory: ${settingsPath}`);
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const sessionStart = hooks.SessionStart;
  if (sessionStart !== undefined && !Array.isArray(sessionStart)) {
    throw new Error(`Refusing to modify malformed hooks.SessionStart in: ${settingsPath}`);
  }
  const groups = (sessionStart ?? []) as HookGroup[];

  const alreadyPresent = groups.some((group) => group.hooks?.some((hook) => hook.command?.includes(command)));
  if (alreadyPresent) {
    return "already-present";
  }

  const updatedGroups: HookGroup[] = [
    ...groups,
    { matcher: SESSION_START_MATCHER, hooks: [{ type: "command", command, timeout: 5 }] },
  ];

  await ensureDirectory(projectRoot, ".claude");
  await writeJsonAtomic(settingsPath, { ...settings, hooks: { ...hooks, SessionStart: updatedGroups } });
  return "added";
}

function defaultPackageRoot(): string {
  // This file lives at <package root>/dist/cli/commands/, or at
  // <package root>/src/cli/commands/ when run directly from source (tests).
  return resolve(__dirname, "..", "..", "..");
}

export async function initializeProject(projectPath: string, options: InitOptions = {}): Promise<InitResult> {
  const projectRoot = resolve(projectPath);
  if ((await inspectPath(projectRoot)) !== "directory") {
    throw new Error(`Project path is not a directory: ${projectRoot}`);
  }

  const packageRoot = options.packageRoot ?? defaultPackageRoot();
  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { name: string };
  const npxCommand = `npx --yes ${packageJson.name}`;

  const integrations = await detectIntegrations(projectRoot);
  const result: InitResult = { integrations, created: [], skipped: [], hook: "not-applicable" };

  await vendorSkillsInto(packageRoot, projectRoot, ".claude/skills", npxCommand, result);
  await vendorSkillsInto(packageRoot, projectRoot, ".agents/skills", npxCommand, result);

  if (integrations.includes("claude")) {
    result.hook = await mergeSessionStartHook(projectRoot, npxCommand);
  }

  return result;
}
