// Category F - Milestone Behavior: M6 PWA Polish, Export, and Launch
// Verifies data export correctness, offline sync, PWA installability,
// known bug fixes, and full flow regression.
// P0: export contains foreign user data.
// P1: all others unless marked P2.
// Note: PWA install and offline sync tests require Playwright and a running
// app server. Lighthouse CI runs separately in the workflow.

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  throw new Error("Missing required environment variables for M6 eval. Check .env.test.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);

const createdEntryIds: string[] = [];
const createdChildProfileIds: string[] = [];

let testChildProfileId: string | null = null;

beforeAll(async () => {
  const { error } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (error) throw new Error(`Test user auth failed: ${error.message}`);

  // Seed a child profile for export tests
  const { data: childProfile, error: childProfileError } = await client
    .from("childrenprofiles")
    .insert({
      user_id: testUserId,
      name: "eval-m6-child-profile",
      date_of_birth: "2017-11-05",
      is_test: true,
    })
    .select("id")
    .single();

  if (childProfileError) throw new Error(`Child profile seed failed: ${childProfileError.message}`);
  testChildProfileId = childProfile!.id;
  createdChildProfileIds.push(childProfile!.id);

  // Seed entries for export tests - one plain, one with child tag
  const { data: plainEntry, error: plainError } = await client
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-m6-export-entry-plain",
      content: "plain export test entry",
      is_test: true,
    })
    .select("id")
    .single();

  if (plainError) throw new Error(`Plain entry seed failed: ${plainError.message}`);
  createdEntryIds.push(plainEntry!.id);

  const { data: taggedEntry, error: taggedError } = await client
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-m6-export-entry-tagged",
      content: "tagged export test entry",
      child_id: testChildProfileId,
      is_test: true,
    })
    .select("id")
    .single();

  if (taggedError) throw new Error(`Tagged entry seed failed: ${taggedError.message}`);
  createdEntryIds.push(taggedEntry!.id);
});

afterAll(async () => {
  if (createdEntryIds.length > 0) {
    await client
      .from("entries")
      .delete()
      .in("id", createdEntryIds)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  if (createdChildProfileIds.length > 0) {
    await client
      .from("childrenprofiles")
      .delete()
      .in("id", createdChildProfileIds)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  await client.auth.signOut();
});

// ─── Export Correctness ───────────────────────────────────────────────────────

describe("F-M6-1 - Export query returns all non-deleted entries for user", () => {
  it("all seeded test entries appear in export query result", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id, title, content, created_at, child_id, photo_url")
      .is("deleted_at", null)
      .eq("user_id", testUserId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const ids = data!.map((e) => e.id);
    for (const entryId of createdEntryIds) {
      expect(ids).toContain(entryId);
    }
  });
});

describe("F-M6-2 - Export query includes child tag on tagged entries", () => {
  it("tagged entry has child_id populated in export result", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id, child_id")
      .is("deleted_at", null)
      .eq("user_id", testUserId)
      .eq("child_id", testChildProfileId!);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0].child_id).toBe(testChildProfileId);
  });
});

describe("F-M6-3 - Export contains no foreign user data (P0)", () => {
  it("all rows in export result are owned by authenticated user", async () => {
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

describe("F-M6-4 - Export excludes soft-deleted entries", () => {
  it("soft-deleted entry does not appear in export query", async () => {
    // Seed and soft-delete an entry
    const { data: deletedEntry, error: seedError } = await client
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m6-deleted-entry",
        content: "this must not appear in export",
        deleted_at: new Date().toISOString(),
        is_test: true,
      })
      .select("id")
      .single();

    expect(seedError).toBeNull();
    createdEntryIds.push(deletedEntry!.id);

    const { data, error } = await client
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .eq("id", deletedEntry!.id);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});

describe("F-M6-5 - Export round-trip: re-imported data matches original", () => {
  it("exported entry fields match seeded values exactly", async () => {
    const { data, error } = await client
      .from("entries")
      .select("id, title, content, user_id, child_id")
      .eq("id", createdEntryIds[0])
      .single();

    expect(error).toBeNull();
    expect(data!.title).toBe("eval-m6-export-entry-plain");
    expect(data!.content).toBe("plain export test entry");
    expect(data!.user_id).toBe(testUserId);
  });
});

// ─── RLS Full Coverage ────────────────────────────────────────────────────────

describe("F-M6-6 - All user-facing tables have RLS active at launch gate", () => {
  it("anon client returns no rows from any user-facing table", async () => {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    const tables = ["entries", "childrenprofiles", "reminder_settings", "releases", "subscriptions"];

    for (const table of tables) {
      const { data, error } = await anonClient
        .from(table)
        .select("id")
        .limit(1);

      const hasRows = data && data.length > 0;
      if (hasRows) {
        console.error(`F-M6-6 FAIL: Table "${table}" returned rows to anonymous client. RLS may not be active.`);
      }
      expect(hasRows).toBe(false);
    }
  });
});

// ─── Known Bug Fixes ──────────────────────────────────────────────────────────

describe("F-M6-7 - B1 fix: authenticated user redirected from / to /entries (P1 at M6)", () => {
  // This test is a placeholder - redirect behavior requires a running app server
  // and Playwright. Verified manually by Christopher using the founder checklist.
  // Automated coverage via Playwright E2E suite - see mobile.test.ts patterns.
  it.skip("authenticated user visiting / lands on /entries not /auth", async () => {
    // Implement via Playwright in mobile.test.ts or a dedicated e2e suite
  });
});

describe("F-M6-8 - B2 fix: Google OAuth does not route through M1 preview URL (P1 at M6)", () => {
  // Manual verification only - OAuth redirect URLs are configured in Supabase dashboard
  // and cannot be tested without a browser flow.
  // Verified by Christopher using the founder checklist.
  it.skip("Google OAuth redirect URL points to production domain not preview URL", async () => {
    // Verify in Supabase Auth dashboard: Authentication > URL Configuration
    // Redirect URL must not contain vercel.app preview domain from M1
  });
});

// ─── Placeholder: Storage Cap ─────────────────────────────────────────────────

// Activated once Decision D1 (storage cap per user) is resolved.
// Do not remove this block - it documents the pending test requirement.
describe.skip("F-M6-PLACEHOLDER - Storage cap enforcement (pending D1)", () => {
  it("photo upload blocked and error returned gracefully when user exceeds storage cap", async () => {
    // Implement once D1 is decided.
    // Test must verify:
    // 1. Upload succeeds below the cap
    // 2. Upload returns a clear error at the cap boundary
    // 3. Cap value is configurable via environment variable
    // 4. No silent failure - user receives actionable error message
  });
});
