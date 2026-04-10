// Category B - Data Integrity
// Verifies soft delete behavior, entry scoping, and data preservation invariants.
// P0: any row deletion that should be soft delete. P1: all others.

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  throw new Error("Missing required environment variables for data integrity eval. Check .env.test.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);

let testEntryId: string | null = null;

beforeAll(async () => {
  const { error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (authError) throw new Error(`Test user auth failed: ${authError.message}`);

  // Create a disposable test entry for this suite
  const { data, error } = await client
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-b-test-entry",
      content: "data integrity test entry - safe to delete",
      is_test: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create test entry: ${error.message}`);
  testEntryId = data.id;
});

afterAll(async () => {
  // Hard delete the test entry by both keys - never touch real user data
  if (testEntryId) {
    await client
      .from("entries")
      .delete()
      .eq("id", testEntryId)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }
  await client.auth.signOut();
});

// ─── Soft Delete ─────────────────────────────────────────────────────────────

describe("B1 - Soft delete sets deleted_at, does not remove row", () => {
  it("deleted_at is set after delete operation", async () => {
    expect(testEntryId).not.toBeNull();

    const { error: deleteError } = await client
      .from("entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", testEntryId!)
      .eq("is_test", true);

    expect(deleteError).toBeNull();

    // Row must still exist in the database
    const { data, error } = await client
      .from("entries")
      .select("id, deleted_at")
      .eq("id", testEntryId!)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.deleted_at).not.toBeNull();
  });
});

describe("B2 - Soft-deleted entries are excluded from the feed query", () => {
  it("entry with deleted_at set does not appear in filtered feed", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .eq("id", testEntryId!);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(0);
  });
});

describe("B3 - Restoring deleted_at restores entry to feed", () => {
  it("clearing deleted_at makes entry visible again", async () => {
    const { error: restoreError } = await client
      .from("entries")
      .update({ deleted_at: null })
      .eq("id", testEntryId!)
      .eq("is_test", true);

    expect(restoreError).toBeNull();

    const { data, error } = await client
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .eq("id", testEntryId!);

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });
});

// ─── Entry Scoping ────────────────────────────────────────────────────────────

describe("B4 - All entries returned belong to the authenticated user", () => {
  it("no foreign user_id values in entries result set", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id, user_id")
      .is("deleted_at", null);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const foreign = data.filter((row) => row.user_id !== testUserId);
      expect(foreign.length).toBe(0);
    }
  });
});

// ─── is_test Column ───────────────────────────────────────────────────────────

describe("B5 - is_test column exists on entries table", () => {
  it("can insert and read is_test field without error", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id, is_test")
      .eq("id", testEntryId!)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.is_test).toBe(true);
  });
});
