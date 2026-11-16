import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkForUpdates, compareVersions, formatUpdateNotice, type FetchLike } from "../src/cli/update-check";

function tempCachePath(): string {
  return path.join(tmpdir(), `cognition-update-check-test-${Math.random().toString(36).slice(2)}.json`);
}

test("compareVersions treats equal versions as equal", () => {
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("compareVersions recognizes a newer major/minor/patch", () => {
  assert.ok(compareVersions("2.0.0", "1.9.9") > 0);
  assert.ok(compareVersions("1.3.0", "1.2.9") > 0);
  assert.ok(compareVersions("1.2.4", "1.2.3") > 0);
});

test("compareVersions recognizes an older version", () => {
  assert.ok(compareVersions("1.0.0", "1.0.1") < 0);
});

test("compareVersions ignores prerelease/build suffixes", () => {
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), 0);
});

test("compareVersions treats missing trailing parts as zero", () => {
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.ok(compareVersions("1.3", "1.2.9") > 0);
});

test("checkForUpdates returns no notice and triggers a background refresh when there is no cache yet", async () => {
  const cachePath = tempCachePath();
  try {
    let fetchCalls = 0;
    const fetchImpl: FetchLike = async () => {
      fetchCalls++;
      return { ok: true, json: async () => ({ latest: "9.9.9" }) };
    };

    const notice = checkForUpdates("0.1.0", "@craiggazimbi/cognition", { cachePath, fetchImpl });
    assert.equal(notice, undefined);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fetchCalls, 1);
  } finally {
    rmSync(cachePath, { force: true });
  }
});

test("checkForUpdates reports a notice from a fresh cache, without any network call", () => {
  const cachePath = tempCachePath();
  try {
    writeFileSync(cachePath, JSON.stringify({ lastChecked: 0, latestVersion: "9.9.9" }));
    let fetchCalls = 0;
    const fetchImpl: FetchLike = async () => {
      fetchCalls++;
      return { ok: true, json: async () => ({ latest: "9.9.9" }) };
    };

    const notice = checkForUpdates("0.1.0", "@craiggazimbi/cognition", {
      cachePath,
      now: () => 1_000_000, // well within the 24h TTL from lastChecked: 0
      fetchImpl,
    });
    assert.equal(fetchCalls, 0, "cache is fresh (no 24h elapsed), so no refetch should fire");
    assert.deepEqual(notice, { currentVersion: "0.1.0", latestVersion: "9.9.9" });
  } finally {
    rmSync(cachePath, { force: true });
  }
});

test("checkForUpdates reports nothing when already on the latest version", () => {
  const cachePath = tempCachePath();
  try {
    writeFileSync(cachePath, JSON.stringify({ lastChecked: 0, latestVersion: "1.0.0" }));
    const notice = checkForUpdates("1.0.0", "@craiggazimbi/cognition", {
      cachePath,
      now: () => 1_000_000,
      fetchImpl: async () => ({ ok: true, json: async () => ({ latest: "1.0.0" }) }),
    });
    assert.equal(notice, undefined);
  } finally {
    rmSync(cachePath, { force: true });
  }
});

test("formatUpdateNotice renders a boxed, padded notice naming both versions", () => {
  const text = formatUpdateNotice({ currentVersion: "0.1.0", latestVersion: "0.2.0" }, "@craiggazimbi/cognition");
  assert.match(text, /0\.1\.0 → 0\.2\.0/);
  assert.match(text, /npm install -g @craiggazimbi\/cognition/);
  const lines = text.split("\n");
  const width = lines[0]!.length;
  assert.ok(lines.every((line) => line.length === width));
});
