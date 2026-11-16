/**
 * Checks npm for a newer release of the CLI, at most once a day, without ever
 * blocking a command on the network. Ported from the same check in Vaka's
 * CLI (apps/cli/src/update-check.ts) — the logic is identical; only the
 * default cache location changed.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REGISTRY_DIST_TAGS_URL = "https://registry.npmjs.org/-/package/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface UpdateNotice {
  currentVersion: string;
  latestVersion: string;
}

interface CheckForUpdatesOptions {
  cachePath?: string;
  now?: () => number;
  fetchImpl?: FetchLike;
}

function defaultCachePath(): string {
  return join(homedir(), ".vaka", "update-check.json");
}

function readCache(cachePath: string): UpdateCache | undefined {
  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as Partial<UpdateCache>;
    if (typeof parsed.lastChecked === "number" && typeof parsed.latestVersion === "string") {
      return { lastChecked: parsed.lastChecked, latestVersion: parsed.latestVersion };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeCache(cachePath: string, cache: UpdateCache): void {
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache), "utf8");
  } catch {
    // Best-effort: a write failure just means we check again next run.
  }
}

/** Compares dotted numeric versions, ignoring any -prerelease/+build suffix. Returns >0 if a is newer. */
export function compareVersions(a: string, b: string): number {
  const toParts = (version: string) =>
    (version.split(/[-+]/)[0] ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const partsA = toParts(a);
  const partsB = toParts(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

async function fetchLatestVersion(
  packageName: string,
  fetchImpl: FetchLike
): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `${REGISTRY_DIST_TAGS_URL}${encodeURIComponent(packageName)}/dist-tags`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      return undefined;
    }
    const tags = (await response.json()) as Record<string, unknown>;
    return typeof tags.latest === "string" ? tags.latest : undefined;
  } catch {
    // Offline, timed out, or registry unreachable: silently skip this check.
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns a notice built from the last cached registry check (instant, no network wait).
 * When the cache is missing or older than CACHE_TTL_MS, also kicks off a background refetch
 * (not awaited) so the cache is fresh for the *next* run. Never blocks and never throws.
 */
export function checkForUpdates(
  currentVersion: string,
  packageName: string,
  options: CheckForUpdatesOptions = {}
): UpdateNotice | undefined {
  const cachePath = options.cachePath ?? defaultCachePath();
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? (fetch as FetchLike);

  const cache = readCache(cachePath);
  const isStale = !cache || now() - cache.lastChecked > CACHE_TTL_MS;

  if (isStale) {
    void fetchLatestVersion(packageName, fetchImpl).then((latestVersion) => {
      if (latestVersion) {
        writeCache(cachePath, { lastChecked: now(), latestVersion });
      }
    });
  }

  if (cache && compareVersions(cache.latestVersion, currentVersion) > 0) {
    return { currentVersion, latestVersion: cache.latestVersion };
  }
  return undefined;
}

export function formatUpdateNotice(notice: UpdateNotice, packageName: string): string {
  const line1 = `Update available: ${notice.currentVersion} → ${notice.latestVersion}`;
  const line2 = `Run: npm install -g ${packageName}`;
  const width = Math.max(line1.length, line2.length) + 2;
  const pad = (line: string) => `│ ${line.padEnd(width - 1)}│`;
  return [`┌${"─".repeat(width)}┐`, pad(line1), pad(line2), `└${"─".repeat(width)}┘`].join("\n");
}
