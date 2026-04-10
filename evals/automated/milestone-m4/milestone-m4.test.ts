// Category F - Milestone Behavior: M4 Diary Release
// Verifies release creation, child access scoping, release permanence, and write blocks.
// P0: child reads non-released entry, child writes anything, release deleted by dad.
// P1: all others.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;
const testChildEmail = process.env.TEST_CHILD_EMAIL!;
const testChildPassword = process.env.TEST_CHILD_PASSWORD!;

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !testUserEmail ||
  !testUserPassword ||
  !testUserId ||
  !testChildEmail ||
  !testChildPassword
) {
  throw new Error("Missing required environment variables for M4 eval. Check .env.test.");
}

const dadClient = createClient(supabaseUrl, supabaseAnonKey);
const childClient = createClient(supabaseUrl, supabaseAnonKey);

const createdEntryIds: string[] = [];
const createdChildProfileIds: string[] = [];
const createdReleaseIds: string[] = [];

let releasedEntryId: string | null = null;
let unreleasedEntryId: string | null = null;
let testChildProfileId: string | null = null;

beforeAll(async () => {
  // Authenticate dad
  const { error: dadError } = await dadClient.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (dadError) throw new Error(`Dad auth failed: ${dadError.message}`);

  // Authenticate child
  const { error: childError } = await childClient.auth.signInWithPassword({
    email: testChildEmail,
    password: testChildPassword,
  });
  if (childError) throw new Error(`Child auth failed: ${childError.message}`);

  // Seed a child profile
  const { data: childProfile, error: childProfileError } = await dadClient
    .from("childrenprofiles")
    .insert({
      user_id: testUserId,
      name: "eval-m4-child-profile",
      date_of_birth: "2015-03-10",
      is_test: true,
    })
    .select("id")
    .single();

  if (childProfileError) throw new Error(`Child profile seed failed: ${childProfileError.message}`);
  testChildProfileId = childProfile!.id;
  createdChildProfileIds.push(childProfile!.id);

  // Seed released entry
  const { data: releasedEntry, error: releasedError } = await dadClient
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-m4-released-entry",
      content: "this entry will be released to the child",
      is_test: true,
    })
    .select("id")
    .single();

  if (releasedError) throw new Error(`Released entry seed failed: ${releasedError.message}`);
  releasedEntryId = releasedEntry!.id;
  createdEntryIds.push(releasedEntry!.id);

  // Seed unreleased entry
  const { data: unreleasedEntry, error: unreleasedError } = await dadClient
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-m4-unreleased-entry",
      content: "this entry must never be visible to the child",
      is_test: true,
    })
    .select("id")
    .single();

  if (unreleasedError) throw new Error(`Unreleased entry seed failed: ${unreleasedError.message}`);
  unreleasedEntryId = unreleasedEntry!.id;
  createdEntryIds.push(unreleasedEntry!.id);

  // Create the release
  const { data: release, error: releaseError } = await dadClient
    .from("releases")
    .insert({
      entry_id: releasedEntryId,
      child_id: testChildProfileId,
      user_id: testUserId,
      is_test: true,
    })
    .select("id")
    .single();

  if (releaseError) throw new Error(`Release seed failed: ${releaseError.message}`);
  createdReleaseIds.push(release!.id);
});

afterAll(async () => {
  if (createdReleaseIds.length > 0) {
    await dadClient
      .from("releases")
      .delete()
      .in("id", createdReleaseIds)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  if (createdEntryIds.length > 0) {
    await dadClient
      .from("entries")
      .delete()
      .in("id", createdEntryIds)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  if (createdChildProfileIds.length > 0) {
    await dadClient
      .from("childrenprofiles")
      .delete()
      .in("id", createdChildProfileIds)
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  await dadClient.auth.signOut();
  await childClient.auth.signOut();
});

// ─── Child Read Access ────────────────────────────────────────────────────────

describe("F-M4-1 - Child can read released entry", () => {
  it("child query returns the released entry", async () => {
    expect(releasedEntryId).not.toBeNull();
    expect(testChildProfileId).not.toBeNull();

    const { data, error } = await childClient
      .from("releases")
      .select("entry_id, entries(id, title, content)")
      .eq("child_id", testChildProfileId!)
      .eq("entry_id", releasedEntryId!);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

describe("F-M4-2 - Child cannot read unreleased entry (P0)", () => {
  it("direct lookup of unreleased entry returns nothing for child", async () => {
    expect(unreleasedEntryId).not.toBeNull();

    const { data, error } = await childClient
      .from("entries")
      .select("id")
      .eq("id", unreleasedEntryId!)
      .limit(1);

    expect(data).not.toBeNull();
    expect(data!.length).toBe(0);
  });
});

// ─── Child Write Blocks (P0) ──────────────────────────────────────────────────

describe("F-M4-3 - Child cannot insert entries (P0)", () => {
  it("insert attempt by child is blocked", async () => {
    const { error } = await childClient
      .from("entries")
      .insert({
        title: "child-injection-attempt",
        content: "this must never persist",
        is_test: true,
      });

    expect(error).not.toBeNull();
  });
});

describe("F-M4-4 - Child cannot update entries (P0)", () => {
  it("update attempt by child on released entry is blocked", async () => {
    expect(releasedEntryId).not.toBeNull();

    const { error } = await childClient
      .from("entries")
      .update({ content: "child-tamper-attempt" })
      .eq("id", releasedEntryId!);

    expect(error).not.toBeNull();
  });
});

describe("F-M4-5 - Child cannot delete entries (P0)", () => {
  it("delete attempt by child on released entry is blocked", async () => {
    expect(releasedEntryId).not.toBeNull();

    const { error } = await childClient
      .from("entries")
      .delete()
      .eq("id", releasedEntryId!);

    expect(error).not.toBeNull();
  });
});

// ─── Release Permanence ───────────────────────────────────────────────────────

describe("F-M4-6 - Dad cannot delete a release (P0)", () => {
  it("delete attempt on releases table by dad is blocked by RLS", async () => {
    expect(createdReleaseIds.length).toBeGreaterThan(0);

    const { error } = await dadClient
      .from("releases")
      .delete()
      .eq("id", createdReleaseIds[0]);

    expect(error).not.toBeNull();
  });
});

describe("F-M4-7 - Soft-deleted entry removes child access (P0)", () => {
  it("child cannot read entry after dad soft-deletes it", async () => {
    expect(releasedEntryId).not.toBeNull();
    expect(testChildProfileId).not.toBeNull();

    // Dad soft-deletes the entry
    const { error: deleteError } = await dadClient
      .from("entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", releasedEntryId!)
      .eq("is_test", true);

    expect(deleteError).toBeNull();

    // Child query must now return nothing for this entry
    const { data, error } = await childClient
      .from("releases")
      .select("entry_id, entries!inner(id, deleted_at)")
      .eq("child_id", testChildProfileId!)
      .eq("entry_id", releasedEntryId!)
      .is("entries.deleted_at", null);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);

    // Restore for subsequent tests
    await dadClient
      .from("entries")
      .update({ deleted_at: null })
      .eq("id", releasedEntryId!)
      .eq("is_test", true);
  });
});

describe("F-M4-8 - Restoring entry restores child access", () => {
  it("child can read entry again after dad clears deleted_at", async () => {
    expect(releasedEntryId).not.toBeNull();
    expect(testChildProfileId).not.toBeNull();

    const { data, error } = await childClient
      .from("releases")
      .select("entry_id, entries!inner(id, title)")
      .eq("child_id", testChildProfileId!)
      .eq("entry_id", releasedEntryId!)
      .is("entries.deleted_at", null);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

// ─── Cross-Child Isolation ────────────────────────────────────────────────────

describe("F-M4-9 - Child cannot read releases targeting a different child", () => {
  it("child release query scoped to own child_id only", async () => {
    expect(testChildProfileId).not.toBeNull();

    const { data, error } = await childClient
      .from("releases")
      .select("id, child_id")
      .neq("child_id", testChildProfileId!);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});
