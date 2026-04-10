// Test User Cleanup - Evaluation Fixtures
// Removes all test data created by the eval suite.
// Two-key safety: only deletes rows where user_id = TEST_USER_ID AND is_test = true.
// Never touches rows where is_test = false or is_test = null.
// Runs after every Tier 2 gate regardless of pass/fail (see workflow: if: always()).
// This script refuses to run against the production Supabase project
// unless EVAL_ALLOW_PRODUCTION=true is explicitly set.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;
const evalAllowProduction = process.env.EVAL_ALLOW_PRODUCTION === "true";

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  console.error("Missing required environment variables. Check .env.test.");
  process.exit(1);
}

// Production refusal guard
if (supabaseUrl.includes("yagoticnplkqfzitjqge") && !evalAllowProduction) {
  console.error("ERROR: This script is pointed at the production Supabase project.");
  console.error("Set EVAL_ALLOW_PRODUCTION=true explicitly to override.");
  console.error("This should never be done in CI.");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey);

// Tables to clean up in dependency order - children before parents
// to avoid foreign key constraint violations.
// Add new tables here as milestones introduce them.
const CLEANUP_TABLES = [
  { table: "releases", reason: "M4 - release records" },
  { table: "entries", reason: "M2 - journal entries" },
  { table: "reminder_settings", reason: "M3 - reminder settings" },
  { table: "childrenprofiles", reason: "M1 - child profiles" },
];

async function run() {
  console.log("Test user cleanup starting...");
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Test user: ${testUserEmail}`);

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });

  if (authError) {
    console.error(`Test user sign-in failed: ${authError.message}`);
    process.exit(1);
  }

  const resolvedUserId = authData.user?.id;

  if (resolvedUserId !== testUserId) {
    console.error(`TEST_USER_ID mismatch. Expected: ${testUserId}, got: ${resolvedUserId}`);
    console.error("Cleanup aborted. No data was deleted.");
    await client.auth.signOut();
    process.exit(1);
  }

  console.log(`Test user authenticated. User ID confirmed: ${resolvedUserId}`);
  console.log("Two-key safety active: only rows with user_id = TEST_USER_ID AND is_test = true will be deleted.\n");

  const results: { table: string; deleted: number; error: string | null }[] = [];

  for (const { table, reason } of CLEANUP_TABLES) {
    // Count before delete for reporting
    const { data: countData, error: countError } = await client
      .from(table)
      .select("id")
      .eq("user_id", testUserId)
      .eq("is_test", true);

    if (countError) {
      // Table may not exist yet (e.g. releases before M4) - skip silently
      console.log(`SKIP ${table} (${reason}): ${countError.message}`);
      results.push({ table, deleted: 0, error: countError.message });
      continue;
    }

    const rowCount = countData?.length ?? 0;

    if (rowCount === 0) {
      console.log(`SKIP ${table} (${reason}): no test rows found`);
      results.push({ table, deleted: 0, error: null });
      continue;
    }

    // Delete with both keys - this is the safety boundary
    const { error: deleteError } = await client
      .from(table)
      .delete()
      .eq("user_id", testUserId)
      .eq("is_test", true);

    if (deleteError) {
      console.error(`FAIL ${table} (${reason}): ${deleteError.message}`);
      results.push({ table, deleted: 0, error: deleteError.message });
    } else {
      console.log(`DELETED ${rowCount} row(s) from ${table} (${reason})`);
      results.push({ table, deleted: rowCount, error: null });
    }
  }

  await client.auth.signOut();

  // Summary
  console.log("\n--- Cleanup Summary ---");
  let totalDeleted = 0;
  let hasErrors = false;

  for (const result of results) {
    if (result.error) {
      console.error(`  ${result.table}: ERROR - ${result.error}`);
      hasErrors = true;
    } else {
      console.log(`  ${result.table}: ${result.deleted} row(s) deleted`);
      totalDeleted += result.deleted;
    }
  }

  console.log(`\nTotal rows deleted: ${totalDeleted}`);

  if (hasErrors) {
    console.error("Cleanup completed with errors. Review output above.");
    process.exit(1);
  }

  console.log("Test user cleanup COMPLETE.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error in test user cleanup:", err);
  process.exit(1);
});
