import path from "node:path";

/**
 * Collapses node:test's per-test event stream into one row per test file
 * (status, pass/fail/skip counts, duration) via console.table, instead of
 * the default spec reporter's scrolling per-test log. Failing tests still
 * get their error printed below the table, since the table has no room for it.
 */
export default async function* tableReporter(source) {
  const fileSummaries = new Map();
  const failures = [];
  let overall;

  for await (const event of source) {
    if (event.type === "test:fail") {
      const error = event.data.details?.error;
      failures.push({
        file: event.data.file,
        name: event.data.name,
        message: error?.cause?.message ?? error?.message ?? String(error),
      });
    }
    if (event.type === "test:summary") {
      if (event.data.file) fileSummaries.set(event.data.file, event.data);
      else overall = event.data;
    }
  }

  const files = [...fileSummaries.keys()].sort((a, b) => a.localeCompare(b));
  const rows = files.map((file) => {
    const { counts, duration_ms, success } = fileSummaries.get(file);
    return {
      File: path.relative(process.cwd(), file),
      Status: success ? "PASS" : "FAIL",
      Passed: counts.passed,
      Failed: counts.failed,
      Skipped: counts.skipped + counts.todo + counts.cancelled,
      "Time (ms)": Math.round(duration_ms),
    };
  });
  console.table(rows);

  if (overall) {
    const failedFiles = rows.filter((row) => row.Status === "FAIL").length;
    const skipped = overall.counts.skipped + overall.counts.todo + overall.counts.cancelled;
    console.log(
      `${rows.length} files (${failedFiles} failed), ${overall.counts.passed} passed, ${overall.counts.failed} failed, ${skipped} skipped`
    );
  }

  for (const failure of failures) {
    console.log(`\n✗ ${path.relative(process.cwd(), failure.file)}`);
    console.log(`  ✗ ${failure.name}`);
    console.log(`    ${failure.message}`);
  }
}
