// Test User Setup - Evaluation Fixtures
// Creates the test user in Supabase Auth and seeds baseline test data.
// Must run before any automated eval suite executes.
// Two-key safety: all inserted rows set user_id = TEST_USER_ID and is_test = true.
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

async function run() {
  console.log("Test user setup starting...");
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Test user: ${testUserEmail}`);

  // Sign in as test user - the test user must already exist in Supabase Auth.
  // If sign-in fails, the test user has not been created.
  // See evals/fixtures/README.md for manual test user creation instructions.
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });

  if (authError) {
    console.error(`Test user sign-in failed: ${authError.message}`);
    console.error("The test user must exist in Supabase Auth before setup can run.");
    console.error("See evals/fixtures/README.md for creation instructions.");
    process.exit(1);
  }

  const resolvedUserId = authData.user?.id;

  if (resolvedUserId !== testUserId) {
    console.error(`TEST_USER_ID mismatch. Expected: ${testUserId}, got: ${resolvedUserId}`);
    console.error("Update TEST_USER_ID in .env.test to match the actual Supabase auth user id.");
    process.exit(1);
  }

  console.log(`Test user authenticated. User ID confirmed: ${resolvedUserId}`);

  // Seed a baseline child profile for tests that require one
  const { data: existingChild, error: childCheckError } = await client
    .from("childrenprofiles")
    .select("id")
    .eq("user_id", testUserId)
    .eq("is_test", true)
    .limit(1);

  if (childCheckError) {
    console.error(`Child profile check failed: ${childCheckError.message}`);
    await client.auth.signOut();
    process.exit(1);
  }

  if (!existingChild || existingChild.length === 0) {
    const { error: childInsertError } = await client
      .from("childrenprofiles")
      .insert({
        user_id: testUserId,
        name: "eval-baseline-child",
        date_of_birth: "2018-06-15",
        is_test: true,
      });

    if (childInsertError) {
      console.error(`Baseline child profile creation failed: ${childInsertError.message}`);
      await client.auth.signOut();
      process.exit(1);
    }

    console.log("Baseline child profile created.");
  } else {
    console.log("Baseline child profile already exists. Skipping.");
  }

  // Seed a baseline entry for tests that require at least one entry
  const { data: existingEntry, error: entryCheckError } = await client
    .from("entries")
    .select("id")
    .eq("user_id", testUserId)
    .eq("is_test", true)
    .is("deleted_at", null)
    .limit(1);

  if (entryCheckError) {
    console.error(`Entry check failed: ${entryCheckError.message}`);
    await client.auth.signOut();
    process.exit(1);
  }

  if (!existingEntry || existingEntry.length === 0) {
    const { error: entryInsertError } = await client
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-baseline-entry",
        content: "This is a baseline test entry created by the eval setup fixture.",
        is_test: true,
      });

    if (entryInsertError) {
      console.error(`Baseline entry creation failed: ${entryInsertError.message}`);
      await client.auth.signOut();
      process.exit(1);
    }

    console.log("Baseline entry created.");
  } else {
    console.log("Baseline entry already exists. Skipping.");
  }

  await client.auth.signOut();

  console.log("\nTest user setup COMPLETE. Eval suite is ready to run.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error in test user setup:", err);
  process.exit(1);
});
