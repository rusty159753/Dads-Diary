// Category F - Milestone Behavior: M3 Engagement Features
// Verifies reminder settings persistence and On This Day query correctness.
// P1: all tests in this file unless marked P2.

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  throw new Error("Missing required environment variables for M3 eval. Check .env.test.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);

const createdEntryIds: string[] = [];
let reminderSettingsCreated = false;

beforeAll(async () => {
  const { error } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (error) throw new Error(`Test user auth failed: ${error.message}`);
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

  if (reminderSettingsCreated) {
    await client
      .from("reminder_settings")
      .delete()
      .eq("user_id", testUserId)
      .eq("is_test", true);
  }

  await client.auth.signOut();
});

// ─── Reminder Settings ────────────────────────────────────────────────────────

describe("F-M3-1 - Reminder settings can be created for a user", () => {
  it("inserts reminder settings row and returns it", async () => {
    const { data, error } = await client
      .from("reminder_settings")
      .insert({
        user_id: testUserId,
        frequency: "weekly",
        preferred_time: "08:00:00",
        preferred_day: 1, // Monday
        is_test: true,
      })
      .select("id, frequency, preferred_time, preferred_day")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.frequency).toBe("weekly");
    expect(data!.preferred_time).toBe("08:00:00");
    expect(data!.preferred_day).toBe(1);

    reminderSettingsCreated = true;
  });
});

describe("F-M3-2 - Reminder settings persist on update", () => {
  it("updates frequency and reads back correctly", async () => {
    const { error: updateError } = await client
      .from("reminder_settings")
      .update({ frequency: "daily" })
      .eq("user_id", testUserId)
      .eq("is_test", true);

    expect(updateError).toBeNull();

    const { data, error } = await client
      .from("reminder_settings")
      .select("frequency")
      .eq("user_id", testUserId)
      .eq("is_test", true)
      .single();

    expect(error).toBeNull();
    expect(data!.frequency).toBe("daily");
  });
});

describe("F-M3-3 - Reminder settings are scoped to owner only", () => {
  it("reminder_settings query returns only rows for authenticated user", async () => {
    const { data, error } = await client
      .from("reminder_settings")
      .select("id, user_id");

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const foreign = data.filter((row) => row.user_id !== testUserId);
      expect(foreign.length).toBe(0);
    }
  });
});

// ─── On This Day Query ────────────────────────────────────────────────────────

describe("F-M3-4 - On This Day query returns entries from prior years on same date", () => {
  it("seeds a prior-year entry and confirms it appears in On This Day results", async () => {
    const today = new Date();
    const priorYear = today.getFullYear() - 1;

    // Seed an entry dated exactly one year ago today
    const priorDate = new Date(priorYear, today.getMonth(), today.getDate());

    const { data: seeded, error: seedError } = await client
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m3-on-this-day-entry",
        content: "on this day test entry from prior year",
        created_at: priorDate.toISOString(),
        is_test: true,
      })
      .select("id")
      .single();

    expect(seedError).toBeNull();
    createdEntryIds.push(seeded!.id);

    // On This Day query: same month and day, year < current year
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const { data: results, error: queryError } = await client
      .from("entries")
      .select("id, title, created_at")
      .is("deleted_at", null)
      .lt("created_at", new Date(today.getFullYear(), 0, 1).toISOString())
      .filter("created_at", "gte", new Date(priorYear, today.getMonth(), today.getDate()).toISOString())
      .filter("created_at", "lt", new Date(priorYear, today.getMonth(), today.getDate() + 1).toISOString());

    expect(queryError).toBeNull();
    expect(results).not.toBeNull();

    const match = results!.find((r) => r.id === seeded!.id);
    expect(match).toBeDefined();
  });
});

describe("F-M3-5 - On This Day query excludes soft-deleted entries", () => {
  it("soft-deleted prior-year entry does not appear in On This Day results", async () => {
    const today = new Date();
    const priorYear = today.getFullYear() - 1;
    const priorDate = new Date(priorYear, today.getMonth(), today.getDate());

    // Seed and immediately soft-delete an entry
    const { data: seeded, error: seedError } = await client
      .from("entries")
      .insert({
        user_id: testUserId,
        title: "eval-m3-deleted-on-this-day",
        content: "this entry is soft deleted and must not appear",
        created_at: priorDate.toISOString(),
        deleted_at: new Date().toISOString(),
        is_test: true,
      })
      .select("id")
      .single();

    expect(seedError).toBeNull();
    createdEntryIds.push(seeded!.id);

    const { data: results, error: queryError } = await client
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .filter("created_at", "gte", new Date(priorYear, today.getMonth(), today.getDate()).toISOString())
      .filter("created_at", "lt", new Date(priorYear, today.getMonth(), today.getDate() + 1).toISOString());

    expect(queryError).toBeNull();

    const match = results!.find((r) => r.id === seeded!.id);
    expect(match).toBeUndefined();
  });
});

describe("F-M3-6 - On This Day query returns nothing when no prior year entries exist", () => {
  it("query returns empty array for a date with no prior entries", async () => {
    // Use a date far in the past with no seeded data
    const { data, error } = await client
      .from("entries")
      .select("id")
      .is("deleted_at", null)
      .filter("created_at", "gte", new Date(1990, 0, 1).toISOString())
      .filter("created_at", "lt", new Date(1990, 0, 2).toISOString());

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});
