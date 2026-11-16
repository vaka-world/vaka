#!/usr/bin/env node
/**
 * The `vaka` CLI: the npm-install path alongside the Claude Code/Codex
 * plugin install. `init` vendors the skill guides into a project (see
 * commands/init.ts); `pause`/`reset`/`status`/`hook session-start` are thin
 * wrappers around the same logic the plugin's own dist/ scripts run, so a
 * vendored SKILL.md can call `npx <pkg> <command>` instead of a
 * `${CLAUDE_PLUGIN_ROOT}`-relative path. Update checking and the banner are
 * ported from Vaka's CLI (apps/cli/src/index.ts).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeProject } from "./commands/init";
import { animateVakaEntrance } from "./ui/banner";
import { checkForUpdates, formatUpdateNotice } from "./update-check";
import { main as sessionStartMain } from "../hooks/session-start";
import { pause } from "../skills/pause/pause";
import { reset } from "../skills/reset/reset";
import { status } from "../skills/status/status";

interface PackageMetadata {
  name: string;
  version: string;
}

const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")) as PackageMetadata;
const PACKAGE_NAME = packageJson.name;
const VERSION = packageJson.version;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DESCRIPTION = [
  "Your mind is the architect. Reason through design, data flow, and failure modes before a single line of code is written.",
  "A plugin for Claude Code and Codex that slows the agent down at the decisions that matter. It will not sketch a data model, pick a storage strategy, or scaffold an architecture until you've proposed one yourself. It pushes on weak spots, explains anything you don't recognize, and only starts writing code once you've said the design is ready. Afterward it tells you exactly what it built and why, so you can check its work against your own mental model — not just trust the diff.",
  "Built for anyone who wants the thinking, not just the output: someone learning to program, a developer picking up an unfamiliar stack, or an experienced engineer who doesn't want \"vibe coding\" to quietly replace their own judgment.",
].join("\n\n");

function printHelp(): void {
  console.log(
    [
      `${PACKAGE_NAME} v${VERSION} — Your mind is the architect.`,
      "",
      "Usage:",
      "  vaka init                     Vendor Vaka's skills into the current project",
      "  vaka pause --cwd <dir>         Pause learning mode for a project",
      "  vaka reset --cwd <dir> [...]   Preview/confirm resetting a project's learning notes",
      "  vaka status --cwd <dir>        Print a project's learning-mode status as JSON",
      "  vaka --version                 Print the installed version",
    ].join("\n")
  );
}

async function run(): Promise<"skip-update-check" | void> {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case "init": {
      await animateVakaEntrance({ version: VERSION });
      console.log(`\n${DESCRIPTION}\n`);
      console.log(`vaka init — vendoring skills into ${process.cwd()}\n`);
      try {
        const result = await initializeProject(process.cwd());
        for (const file of result.created) console.log(`  created  ${file}`);
        for (const file of result.skipped) console.log(`  kept     ${file} (already exists)`);
        if (result.hook === "added") console.log("  added    SessionStart hook in .claude/settings.json");
        else if (result.hook === "already-present") console.log("  kept     SessionStart hook (already present)");

        console.log(
          result.integrations.length === 0
            ? "\nNo CLAUDE.md/AGENTS.md detected yet — the skill guides are installed either way; run `/vaka-learn` (Claude Code) or `$vaka-learn` (Codex) once you're set up."
            : `\nDetected: ${result.integrations.join(", ")}`
        );
      } catch (error) {
        console.error(errorMessage(error));
        process.exitCode = 1;
      }
      return;
    }

    case "pause": {
      const cwd = flag(rest, "--cwd");
      if (!cwd) {
        printJson({ status: "error", message: "--cwd is required" });
        process.exitCode = 1;
        return "skip-update-check";
      }
      try {
        printJson(pause(cwd));
      } catch (error) {
        printJson({ status: "error", message: errorMessage(error) });
        process.exitCode = 1;
      }
      // Stdout here is a machine-readable contract the agent parses — never
      // append an update notice after it.
      return "skip-update-check";
    }

    case "reset": {
      const cwd = flag(rest, "--cwd");
      const confirm = flag(rest, "--confirm");
      if (!cwd) {
        printJson({ status: "error", message: "--cwd is required" });
        process.exitCode = 1;
        return "skip-update-check";
      }
      try {
        printJson(reset(cwd, confirm));
      } catch (error) {
        printJson({ status: "error", message: errorMessage(error) });
        process.exitCode = 1;
      }
      return "skip-update-check";
    }

    case "status": {
      const cwd = flag(rest, "--cwd");
      if (!cwd) {
        printJson({ status: "error", message: "--cwd is required" });
        process.exitCode = 1;
        return "skip-update-check";
      }
      try {
        printJson(status(cwd));
      } catch (error) {
        printJson({ status: "error", message: errorMessage(error) });
        process.exitCode = 1;
      }
      return "skip-update-check";
    }

    case "hook": {
      if (rest[0] === "session-start") {
        await sessionStartMain();
        return "skip-update-check"; // stdout is the hook's JSON protocol
      }
      console.error(`Unknown hook: ${rest[0] ?? "(none)"}`);
      process.exitCode = 1;
      return "skip-update-check";
    }

    case "--version":
    case "-v":
      console.log(VERSION);
      return "skip-update-check";

    case undefined:
    case "--help":
    case "-h":
      printHelp();
      return "skip-update-check";

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
      return "skip-update-check";
  }
}

async function main(): Promise<void> {
  const outcome = await run();
  if (outcome === "skip-update-check") return;

  const notice = checkForUpdates(VERSION, PACKAGE_NAME);
  if (notice) console.log(formatUpdateNotice(notice, PACKAGE_NAME));
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
