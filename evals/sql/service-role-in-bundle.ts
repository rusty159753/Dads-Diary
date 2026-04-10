// SQL Audit - Service Role Key in Bundle
// Scans the Next.js build output for any occurrence of the Supabase service role key.
// P0: service role key found in any client-accessible file. Exits with code 1 immediately.
// This audit runs against the built output - ensure `npm run build` has completed before CI runs this.

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SERVICE_ROLE_MARKERS = [
  "service_role",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", // common Supabase JWT header prefix
];

// Directories to scan in the Next.js build output
const SCAN_PATHS = [
  ".next/static",
  "public",
];

// Extensions to scan - limit to files a browser could load
const SCAN_EXTENSIONS = [".js", ".ts", ".json", ".map", ".html", ".txt"];

function getAllFiles(dir: string): string[] {
  const results: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Directory does not exist - skip silently
    // .next/static will not exist if build has not run
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      const ext = fullPath.slice(fullPath.lastIndexOf("."));
      if (SCAN_EXTENSIONS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function run() {
  console.log("Service role key bundle scan starting...");

  const failures: { file: string; marker: string }[] = [];
  let scannedCount = 0;

  for (const scanPath of SCAN_PATHS) {
    const files = getAllFiles(scanPath);

    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(file, "utf-8");
      } catch {
        console.warn(`Could not read file: ${file} - skipping`);
        continue;
      }

      scannedCount++;

      for (const marker of SERVICE_ROLE_MARKERS) {
        if (content.includes(marker)) {
          console.error(`SERVICE ROLE KEY DETECTED in: ${file} (matched marker: "${marker}")`);
          failures.push({ file, marker });
        }
      }
    }
  }

  console.log(`Scanned ${scannedCount} files across ${SCAN_PATHS.join(", ")}`);

  if (scannedCount === 0) {
    console.warn("No files scanned. Build output may not exist.");
    console.warn("Run `npm run build` before executing this audit in CI.");
    // Do not fail - build may legitimately be absent in some CI steps
    process.exit(0);
  }

  if (failures.length > 0) {
    console.error(`\nService role key audit FAILED. Found ${failures.length} match(es):`);
    failures.forEach(({ file, marker }) => {
      console.error(`  File: ${file}`);
      console.error(`  Matched: "${marker}"`);
    });
    console.error("\nThis is a P0 failure. The service role key must never appear in client-accessible files.");
    console.error("Rotate the Supabase service role key immediately and audit all recent deployments.");
    process.exit(1);
  }

  console.log("\nService role key audit PASSED. No matches found in build output.");
  process.exit(0);
}

run();
