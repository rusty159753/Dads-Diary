// Category A - Security and Access Control
// Severity: P0 for all tests in this file. Any failure blocks merge immediately.
// Tests run against TEST_USER_ID only. Production refusal guard enforced in CI.

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  throw new Error("Missing required environment variables for security eval. Check .env.test.");
}

// Unauthenticated client - simulates anonymous access
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Authenticated client for test user
const authClient = createClient(supabaseUrl, supabaseAnonKey);

beforeAll(async () => {
  const { error } = await authClient.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (error) throw new Error(`Test user auth failed: ${error.message}`);
});

// ─── Anonymous Access ───────────────────────────────────────────────────────

describe("A1 - Anonymous users cannot read entries", () => {
  it("returns empty or error for anonymous entries query", async () => {
    const { data, error } = await anonClient
      .from("entries")
      .select("id")
      .limit(1);

    // RLS must return empty result or error - never actual rows
    const hasRows = data && data.length > 0;
    expect(hasRows).toBe(false);
  });
});

describe("A2 - Anonymous users cannot write entries", () => {
  it("blocks anonymous insert to entries", async () => {
    const { error } = await anonClient.from("entries").insert({
      user_id: testUserId,
      title: "anon-injection-attempt",
      content: "this should never persist",
      is_test: true,
    });

    expect(error).not.toBeNull();
  });
});

describe("A3 - Anonymous users cannot read childrenprofiles", () => {
  it("returns empty or error for anonymous childrenprofiles query", async () => {
    const { data, error } = await anonClient
      .from("childrenprofiles")
      .select("id")
      .limit(1);

    const hasRows = data && data.length > 0;
    expect(hasRows).toBe(false);
  });
});

// ─── Cross-User Isolation ────────────────────────────────────────────────────

describe("A4 - Authenticated user cannot read another user's entries", () => {
  it("entries query returns only rows owned by authenticated user", async () => {
    const { data, error } = await authClient
      .from("entries")
      .select("id, user_id")
      .is("deleted_at", null);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const foreignRows = data.filter((row) => row.user_id !== testUserId);
      expect(foreignRows.length).toBe(0);
    }
  });
});

describe("A5 - Authenticated user cannot read another user's childrenprofiles", () => {
  it("childrenprofiles query returns only rows owned by authenticated user", async () => {
    const { data, error } = await authClient
      .from("childrenprofiles")
      .select("id, user_id");

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const foreignRows = data.filter((row) => row.user_id !== testUserId);
      expect(foreignRows.length).toBe(0);
    }
  });
});

// ─── Direct ID Lookup ────────────────────────────────────────────────────────

describe("A6 - Direct entry ID lookup blocked for non-owner", () => {
  it("anonClient cannot fetch a known entry by ID", async () => {
    // First get a real entry ID as the authenticated user
    const { data: ownedEntries } = await authClient
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .limit(1);

    if (!ownedEntries || ownedEntries.length === 0) {
      // No entries exist yet - test passes vacuously, noted in output
      console.warn("A6: No entries found for test user. Skipping direct ID lookup check.");
      return;
    }

    const entryId = ownedEntries[0].id;

    // Now attempt the same lookup as anonymous
    const { data, error } = await anonClient
      .from("entries")
      .select("id")
      .eq("id", entryId)
      .single();

    expect(data).toBeNull();
  });
});
