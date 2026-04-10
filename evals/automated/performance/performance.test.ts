// Category D - Performance
// Verifies response times for core database operations against defined thresholds.
// P1: entry save and photo upload thresholds. P2: query and bundle thresholds.
// Lighthouse CI covers LCP, TTI, CLS - those run separately in the workflow.

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const testUserEmail = process.env.TEST_USER_EMAIL!;
const testUserPassword = process.env.TEST_USER_PASSWORD!;
const testUserId = process.env.TEST_USER_ID!;

if (!supabaseUrl || !supabaseAnonKey || !testUserEmail || !testUserPassword || !testUserId) {
  throw new Error("Missing required environment variables for performance eval. Check .env.test.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);

const createdEntryIds: string[] = [];

// Thresholds in milliseconds - do not change without Christopher approval
const THRESHOLDS = {
  entrySaveP50: 800,
  entrySaveP95: 2000,
  onThisDayQueryP95: 300,
  supabaseIndexedReadP95: 500,
};

const SAMPLE_SIZE = 20; // number of runs for p50/p95 calculations

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

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
  await client.auth.signOut();
});

// ─── Entry Save Latency ───────────────────────────────────────────────────────

describe("D1 - Entry save p50 under 800ms", () => {
  it(`completes ${SAMPLE_SIZE} inserts and p50 is within threshold`, async () => {
    const durations: number[] = [];

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = performance.now();

      const { data, error } = await client
        .from("entries")
        .insert({
          user_id: testUserId,
          title: `eval-d-perf-entry-${i}`,
          content: "performance test entry",
          is_test: true,
        })
        .select("id")
        .single();

      const duration = performance.now() - start;
      durations.push(duration);

      if (error) throw new Error(`Entry insert failed on iteration ${i}: ${error.message}`);
      if (data?.id) createdEntryIds.push(data.id);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);

    console.log(`D1 p50: ${p50.toFixed(0)}ms (threshold: ${THRESHOLDS.entrySaveP50}ms)`);
    expect(p50).toBeLessThan(THRESHOLDS.entrySaveP50);
  });
});

describe("D2 - Entry save p95 under 2000ms", () => {
  it("p95 of entry inserts is within threshold", async () => {
    const durations: number[] = [];

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = performance.now();

      const { data, error } = await client
        .from("entries")
        .insert({
          user_id: testUserId,
          title: `eval-d-p95-entry-${i}`,
          content: "performance p95 test entry",
          is_test: true,
        })
        .select("id")
        .single();

      const duration = performance.now() - start;
      durations.push(duration);

      if (error) throw new Error(`Entry insert failed on iteration ${i}: ${error.message}`);
      if (data?.id) createdEntryIds.push(data.id);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);

    console.log(`D2 p95: ${p95.toFixed(0)}ms (threshold: ${THRESHOLDS.entrySaveP95}ms)`);
    expect(p95).toBeLessThan(THRESHOLDS.entrySaveP95);
  });
});

// ─── Indexed Read Latency ─────────────────────────────────────────────────────

describe("D3 - Supabase indexed read p95 under 500ms", () => {
  it("p95 of entries feed query is within threshold", async () => {
    const durations: number[] = [];

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = performance.now();

      const { error } = await client
        .from("entries")
        .select("id, title, content, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const duration = performance.now() - start;
      durations.push(duration);

      if (error) throw new Error(`Feed query failed on iteration ${i}: ${error.message}`);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);

    console.log(`D3 p95: ${p95.toFixed(0)}ms (threshold: ${THRESHOLDS.supabaseIndexedReadP95}ms)`);
    expect(p95).toBeLessThan(THRESHOLDS.supabaseIndexedReadP95);
  });
});

// ─── On This Day Query ────────────────────────────────────────────────────────

describe("D4 - On This Day query p95 under 300ms", () => {
  it("p95 of On This Day query is within threshold", async () => {
    const durations: number[] = [];

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = performance.now();

      const { error } = await client
        .from("entries")
        .select("id, title, created_at")
        .is("deleted_at", null)
        // Match month and day across prior years
        // Actual On This Day query will use a Supabase function or RPC -
        // this approximation verifies the base read latency
        .lt("created_at", new Date(today.getFullYear(), 0, 1).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      const duration = performance.now() - start;
      durations.push(duration);

      if (error) throw new Error(`On This Day query failed on iteration ${i}: ${error.message}`);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);

    console.log(`D4 p95: ${p95.toFixed(0)}ms (threshold: ${THRESHOLDS.onThisDayQueryP95}ms)`);
    expect(p95).toBeLessThan(THRESHOLDS.onThisDayQueryP95);
  });
});
