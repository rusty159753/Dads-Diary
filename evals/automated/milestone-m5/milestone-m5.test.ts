// Category F - Milestone Behavior: M5 Monetization
// Verifies trial access, subscription state transitions, archival behavior,
// and child access preservation during dad's archival.
// P0: data deleted on archival, child loses access during dad's archival,
//     subscription check bypassed client-side, unsigned webhook accepted.
// P1: all others.
// Note: Live Stripe webhook tests are manual only - cannot be automated in CI.
// This suite uses synthetic subscription state manipulation via database only.

import { createClient } from "@supabase/supabase-js";
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
  throw new Error("Missing required environment variables for M5 eval. Check .env.test.");
}

const dadClient = createClient(supabaseUrl, supabaseAnonKey);
const childClient = createClient(supabaseUrl, supabaseAnonKey);

const createdEntryIds: string[] = [];
const createdChildProfileIds: string[] = [];
const createdReleaseIds: string[] = [];

let testEntryId: string | null = null;
let testChildProfileId: string | null = null;

beforeAll(async () => {
  const { error: dadError } = await dadClient.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (dadError) throw new Error(`Dad auth failed: ${dadError.message}`);

  const { error: childError } = await childClient.auth.signInWithPassword({
    email: testChildEmail,
    password: testChildPassword,
  });
  if (childError) throw new Error(`Child auth failed: ${childError.message}`);

  // Seed entry for data preservation tests
  const { data: entry, error: entryError } = await dadClient
    .from("entries")
    .insert({
      user_id: testUserId,
      title: "eval-m5-preservation-entry",
      content: "this entry must survive archival and re-subscription",
      is_test: true,
    })
    .select("id")
    .single();

  if (entryError) throw new Error(`Entry seed failed: ${entryError.message}`);
  testEntryId = entry!.id;
  createdEntryIds.push(entry!.id);

  // Seed child profile and release for child access tests
  const { data: childProfile, error: childProfileError } = await dadClient
    .from("childrenprofiles")
    .insert({
      user_id: testUserId,
      name: "eval-m5-child-profile",
      date_of_birth: "2016-08-20",
      is_test: true,
    })
    .select("id")
    .single();

  if (childProfileError) throw new Error(`Child profile seed failed: ${childProfileError.message}`);
  testChildProfileId = childProfile!.id;
  createdChildProfileIds.push(childProfile!.id);

  const { data: release, error: releaseError } = await dadClient
    .from("releases")
    .insert({
      entry_id: testEntryId,
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

  // Restore subscription status to active after all tests
  await dadClient
    .from("subscriptions")
    .update({ status: "active" })
    .eq("user_id", testUserId)
    .eq("is_test", true);

  await dadClient.auth.signOut();
  await childClient.auth.signOut();
});

// ─── Trial Access ─────────────────────────────────────────────────────────────

describe("F-M5-1 - Trial access granted when trial_ends_at is in future", () => {
  it("subscription middleware allows entry creation during active trial", async () => {
    // Set trial_ends_at to 30 days from now
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { error: updateError } = await dadClient
      .from("subscriptions")
      .update({
        status: "trialing",
        trial_ends_at: trialEnd.toISOString(),
      })
      .eq("user_id", testUserId)
      .eq("is_test", true);

    expect(updateError).toBeNull();

    // Entry creation must succeed during trial
    const { data, error } = await dadClient
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m5-trial-entry",
        content: "created during active trial",
        is_test: true,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBeDefined();
    createdEntryIds.push(data!.id);
  });
});

describe("F-M5-2 - Trial duration is exactly 30 days from account creation", () => {
  it("trial_ends_at is within 1 minute of 30 days from created_at", async () => {
    const { data, error } = await dadClient
      .from("subscriptions")
      .select("trial_ends_at, created_at")
      .eq("user_id", testUserId)
      .eq("is_test", true)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const createdAt = new Date(data!.created_at).getTime();
    const trialEndsAt = new Date(data!.trial_ends_at).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const toleranceMs = 60 * 1000; // 1 minute tolerance

    expect(Math.abs(trialEndsAt - createdAt - thirtyDaysMs)).toBeLessThan(toleranceMs);
  });
});

// ─── Archival Behavior ────────────────────────────────────────────────────────

describe("F-M5-3 - Archival blocks write access", () => {
  it("entry insert fails when subscription status is archived", async () => {
    const { error: archiveError } = await dadClient
      .from("subscriptions")
      .update({ status: "archived" })
      .eq("user_id", testUserId)
      .eq("is_test", true);

    expect(archiveError).toBeNull();

    // Entry creation must be blocked - middleware enforces this
    // If the app is correctly implemented, insert will fail or return an
    // auth/permission error when subscription status is archived.
    // This test validates the database-level or middleware-level enforcement.
    const { error: insertError } = await dadClient
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m5-archived-insert-attempt",
        content: "this must be blocked",
        is_test: true,
      });

    // Expect a block - exact error depends on middleware implementation
    expect(insertError).not.toBeNull();
  });
});

describe("F-M5-4 - Archival preserves read access", () => {
  it("existing entries remain readable when subscription is archived", async () => {
    expect(testEntryId).not.toBeNull();

    const { data, error } = await dadClient
      .from("entries")
      .select("id, title")
      .eq("id", testEntryId!)
      .single();

    expect(error).toBeNull();
      expect(data!.id).toBe(testEntryId);
  });
});

describe("F-M5-5 - Archival does not delete any user data (P0)", () => {
  it("entries, child profiles, and releases all persist during archival", async () => {
    // Entries intact
    const { data: entries, error: entriesError } = await dadClient
      .from("entries")
      .select("id")
      .eq("id", testEntryId!);

    expect(entriesError).toBeNull();
    expect(entries!.length).toBe(1);

    // Child profiles intact
    const { data: children, error: childrenError } = await dadClient
      .from("childrenprofiles")
      .select("id")
      .eq("id", testChildProfileId!);

    expect(childrenError).toBeNull();
    expect(children!.length).toBe(1);

    // Releases intact
    const { data: releases, error: releasesError } = await dadClient
      .from("releases")
      .select("id")
      .eq("id", createdReleaseIds[0]);

    expect(releasesError).toBeNull();
    expect(releases!.length).toBe(1);
  });
});

// ─── Child Access During Archival ─────────────────────────────────────────────

describe("F-M5-6 - Child retains read access to released entries when dad is archived (P0)", () => {
  it("child can still read released entry while dad subscription is archived", async () => {
    expect(testEntryId).not.toBeNull();
    expect(testChildProfileId).not.toBeNull();

    const { data, error } = await childClient
      .from("releases")
      .select("entry_id, entries!inner(id, title)")
      .eq("child_id", testChildProfileId!)
      .eq("entry_id", testEntryId!)
      .is("entries.deleted_at", null);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

// ─── Re-subscription ──────────────────────────────────────────────────────────

describe("F-M5-7 - Re-subscription restores write access", () => {
  it("entry insert succeeds after subscription restored to active", async () => {
    const { error: restoreError } = await dadClient
      .from("subscriptions")
      .update({ status: "active" })
      .eq("user_id", testUserId)
      .eq("is_test", true);

    expect(restoreError).toBeNull();

    const { data, error } = await dadClient
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m5-resubscribed-entry",
        content: "created after re-subscription",
        is_test: true,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBeDefined();
    createdEntryIds.push(data!.id);
  });
});

describe("F-M5-8 - All data intact after archival and re-subscription (P0)", () => {
  it("original seeded entry survives full archival and re-subscription cycle", async () => {
    expect(testEntryId).not.toBeNull();

    const { data, error } = await dadClient
      .from("entries")
      .select("id, title, content")
      .eq("id", testEntryId!)
      .single();

    expect(error).toBeNull();
    expect(data!.title).toBe("eval-m5-preservation-entry");
    expect(data!.content).toBe("this entry must survive archival and re-subscription");
  });
});

// ─── Placeholder: Grace Period ────────────────────────────────────────────────

// Activated once Decision D2 (grace period duration) is resolved.
// Do not remove this block - it documents the pending test requirement.
describe.skip("F-M5-PLACEHOLDER - Grace period boundary behavior (pending D2)", () => {
  it("access blocked exactly at grace period expiry, not before", async () => {
    // Implement once D2 is decided.
    // Test must verify:
    // 1. Write access allowed during grace period
    // 2. Write access blocked at grace period expiry
    // 3. Read access preserved throughout
    // 4. Grace period duration matches D2 decision
  });
});
