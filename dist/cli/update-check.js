"use strict";
/**
 * Checks npm for a newer release of the CLI, at most once a day, without ever
 * blocking a command on the network. Ported from the same check in Vaka's
 * CLI (apps/cli/src/update-check.ts) — the logic is identical; only the
 * default cache location changed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareVersions = compareVersions;
exports.checkForUpdates = checkForUpdates;
exports.formatUpdateNotice = formatUpdateNotice;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const REGISTRY_DIST_TAGS_URL = "https://registry.npmjs.org/-/package/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;
function defaultCachePath() {
    return (0, node_path_1.join)((0, node_os_1.homedir)(), ".vaka", "update-check.json");
}
function readCache(cachePath) {
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(cachePath, "utf8"));
        if (typeof parsed.lastChecked === "number" && typeof parsed.latestVersion === "string") {
            return { lastChecked: parsed.lastChecked, latestVersion: parsed.latestVersion };
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
function writeCache(cachePath, cache) {
    try {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(cachePath), { recursive: true });
        (0, node_fs_1.writeFileSync)(cachePath, JSON.stringify(cache), "utf8");
    }
    catch {
        // Best-effort: a write failure just means we check again next run.
    }
}
/** Compares dotted numeric versions, ignoring any -prerelease/+build suffix. Returns >0 if a is newer. */
function compareVersions(a, b) {
    const toParts = (version) => (version.split(/[-+]/)[0] ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
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
async function fetchLatestVersion(packageName, fetchImpl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetchImpl(`${REGISTRY_DIST_TAGS_URL}${encodeURIComponent(packageName)}/dist-tags`, { signal: controller.signal });
        if (!response.ok) {
            return undefined;
        }
        const tags = (await response.json());
        return typeof tags.latest === "string" ? tags.latest : undefined;
    }
    catch {
        // Offline, timed out, or registry unreachable: silently skip this check.
        return undefined;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Returns a notice built from the last cached registry check (instant, no network wait).
 * When the cache is missing or older than CACHE_TTL_MS, also kicks off a background refetch
 * (not awaited) so the cache is fresh for the *next* run. Never blocks and never throws.
 */
function checkForUpdates(currentVersion, packageName, options = {}) {
    const cachePath = options.cachePath ?? defaultCachePath();
    const now = options.now ?? Date.now;
    const fetchImpl = options.fetchImpl ?? fetch;
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
function formatUpdateNotice(notice, packageName) {
    const line1 = `Update available: ${notice.currentVersion} → ${notice.latestVersion}`;
    const line2 = `Run: npm install -g ${packageName}`;
    const width = Math.max(line1.length, line2.length) + 2;
    const pad = (line) => `│ ${line.padEnd(width - 1)}│`;
    return [`┌${"─".repeat(width)}┐`, pad(line1), pad(line2), `└${"─".repeat(width)}┘`].join("\n");
}
