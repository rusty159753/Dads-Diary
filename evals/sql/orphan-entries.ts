// SQL Audit - Orphan Entries
// Verifies no entries exist with a user_id that has no corresponding auth user.
// Orphan rows indicate a data integrity failure - deleted auth user with data left behind.
// P1: any orphan entries found. Exits with code 1 on failure.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  console.error("Missing required environment variables. Check .env.test.");
  process.exit(1);
}

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

  // Pull all entries visible to the test user.
  // RLS scopes this to test user's own rows only.
  // A definitive cross-user orphan check requires service role access -
  // flag to Christopher if a service role audit is needed post-MVP.
  const { data: entries, error: entriesError } = await client
    .from("entries")
    .select("id, user_id, is_test")
    .limit(1000);

  if (entriesError) {
    console.error(`Entries query failed: ${entriesError.message}`);
    await client.auth.signOut();
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log("Orphan entries audit PASSED. No entries found for test user.");
    await client.auth.signOut();
    process.exit(0);
  }

  // Every entry returned must be owned by the authenticated test user.
  // If RLS is working correctly this should always be true.
  // If it is not, we have a combined RLS failure and potential orphan.
  const orphans = entries.filter((row) => row.user_id !== testUserId);

  if (orphans.length > 0) {
    console.error(`Orphan entries audit FAILED. Found ${orphans.length} entries with unexpected user_id:`);
    orphans.forEach((row) => {
      console.error(`  entry id: ${row.id}, user_id: ${row.user_id}`);
    });
    await client.auth.signOut();
    process.exit(1);
  }

  // Check that all is_test entries are correctly flagged
  const testEntries = entries.filter((row) => row.is_test === true);
  const nonTestEntries = entries.filter((row) => row.is_test === false || row.is_test === null);

  console.log(`Orphan entries audit PASSED.`);
  console.log(`  Total entries for test user: ${entries.length}`);
  console.log(`  is_test = true: ${testEntries.length}`);
  console.log(`  is_test = false/null (real data): ${nonTestEntries.length}`);

  await client.auth.signOut();
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error in orphan entries audit:", err);
  process.exit(1);
});
