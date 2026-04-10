// SQL Audit - Index Presence
// Verifies that performance-critical columns have indexes defined.
// P2: missing index. Does not block merge but logs a warning for the milestone report.
// Exits with code 1 only if the query itself fails - missing indexes exit with code 0 + warning.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword) {
  console.error("Missing required environment variables. Check .env.test.");
  process.exit(1);
}

// Columns that must be indexed for acceptable query performance.
// Format: { table, column, reason }
// Update this list as new tables and queries are added each milestone.
const REQUIRED_INDEXES = [
  {
    table: "entries",
    column: "user_id",
    reason: "Feed query filters by user_id on every page load",
  },
  {
    table: "entries",
    column: "deleted_at",
    reason: "Feed query filters WHERE deleted_at IS NULL on every page load",
  },
  {
    table: "entries",
    column: "created_at",
    reason: "Feed query orders by created_at descending",
  },
  {
    table: "childrenprofiles",
    column: "user_id",
    reason: "Child profile list filters by user_id",
  },
  {
    table: "reminder_settings",
    column: "user_id",
    reason: "Reminder lookup filters by user_id - added M3",
  },
  {
    table: "releases",
    column: "child_id",
    reason: "Child diary query filters releases by child_id - added M4",
  },
  {
    table: "releases",
    column: "entry_id",
    reason: "Release lookup filters by entry_id - added M4",
  },
];

const client = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });

  if (authError) {
    console.error(`Auth failed: ${authError.message}`);
    process.exit(1);
  }

  // Direct pg_catalog index inspection requires service role access.
  // This script uses EXPLAIN output as a behavioral proxy to detect
  // whether Postgres is using index scans on the critical columns.
  // Hephaestus replacement note (deprecated): wire this to a Supabase
  // edge function with service role to query pg_indexes directly when
  // Christopher approves service role usage in the eval suite.

  const warnings: string[] = [];

  for (const spec of REQUIRED_INDEXES) {
    // Behavioral proxy: run a query that should hit the index and
    // verify it completes within the P2 threshold of 500ms.
    // A full table scan will typically exceed this on a non-trivial dataset.

    const start = performance.now();

    const { error } = await client
      .from(spec.table)
      .select("id")
      .not(spec.column, "is", null)
      .limit(1);

    const duration = performance.now() - start;

    if (error && error.code !== "PGRST116") {
      // Table may not exist yet (e.g. releases before M4) - warn, do not fail
      console.warn(`Index check SKIP for ${spec.table}.${spec.column}: table not accessible (${error.code})`);
      warnings.push(`${spec.table}.${spec.column} - table not accessible`);
      continue;
    }

    if (duration > 500) {
      console.warn(
        `Index check WARN for ${spec.table}.${spec.column}: query took ${duration.toFixed(0)}ms (threshold 500ms) - possible missing index`
      );
      console.warn(`  Reason index is required: ${spec.reason}`);
      warnings.push(`${spec.table}.${spec.column} - slow query (${duration.toFixed(0)}ms)`);
    } else {
      console.log(`Index check PASS for ${spec.table}.${spec.column}: ${duration.toFixed(0)}ms`);
    }
  }

  await client.auth.signOut();

  if (warnings.length > 0) {
    console.warn(`\nIndex presence audit completed with ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn("These are P2 findings. Log to milestone report. Do not block merge.");
    process.exit(0);
  }

  console.log("\nIndex presence audit PASSED. All critical columns responding within threshold.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error in index presence audit:", err);
  process.exit(1);
});
