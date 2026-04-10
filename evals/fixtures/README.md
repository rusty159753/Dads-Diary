# Dad's Diary - Evaluation Fixtures

**Version:** 1.0
**Last Updated:** April 9, 2026

---

## Purpose

This document defines the test user contract, the two-key safety requirement,
and the production refusal guard used by all automated evaluation scripts that
touch the database.

The fixture files that execute against the database are:
- `/evals/fixtures/test-user-setup.sql`
- `/evals/fixtures/test-user-cleanup.sql`

---

## TEST_USER_ID Contract

All automated database tests run against a single dedicated test user identified
by the `TEST_USER_ID` environment variable.

Rules:

- `TEST_USER_ID` must be set in `.env.test` locally and in GitHub Actions secrets
  for CI runs
- The test user must exist in Supabase Auth before any eval scripts run
- The test user email must use the non-deliverable domain `@dadsdiary.test`
- The test user must not be used for any purpose other than automated evaluation
- No real user data may be associated with the test user account
- The test user account must be recreated from `test-user-setup.sql` at the
  start of every Tier 2 gate run to ensure a clean state

---

## Two-Key Safety Requirement

All test-created rows in the database carry two identifying markers:

1. `user_id` set to `TEST_USER_ID`
2. `is_test` set to `true`

Every cleanup script must match both keys before deleting any row:

```sql
WHERE user_id = TEST_USER_ID AND is_test = true
```

Neither key alone is sufficient to authorize deletion. This is not optional.

Rationale: A single-key match on `user_id` alone is a single point of failure.
If `TEST_USER_ID` is misconfigured and resolves to a real user ID, a cleanup
script with single-key matching would delete that user's real data. The second
key (`is_test = true`) ensures only rows explicitly created by the eval framework
are touched. Real user rows default to `is_test = false` and are never matched
by cleanup scripts.

---

## Tables With `is_test` Column

| Table | Column | Default | Notes |
|-------|--------|---------|-------|
| `entries` | `is_test BOOLEAN NOT NULL DEFAULT false` | false | Added via migration during eval framework setup |
| `releases` | `is_test BOOLEAN NOT NULL DEFAULT false` | false | Added via migration during eval framework setup |

All other tables owned by the test user are cleaned up by cascading deletes
from parent rows, not by direct deletion.

If new tables are added in future milestones that require direct eval-created
rows, the `is_test` column must be added to those tables before eval scripts
write to them.

---

## Production Refusal Guard

Any script that connects to the Supabase database must check the target URL
before executing. If the URL matches the production Supabase project, the script
must refuse to run unless `EVAL_ALLOW_PRODUCTION=true` is explicitly set.

Implementation pattern for SQL scripts:

```sql
DO $$
BEGIN
  IF current_setting('app.supabase_url', true) LIKE '%yagoticnplkqfzitjqge%'
     AND current_setting('app.eval_allow_production', true)
         IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Production database detected. Set EVAL_ALLOW_PRODUCTION=true to proceed.';
  END IF;
END $$;
```

Implementation pattern for TypeScript test files:

```typescript
// Production refusal guard - must run before any database operation
const supabaseUrl = process.env.SUPABASE_TEST_URL ?? '';
const evalAllowProduction = process.env.EVAL_ALLOW_PRODUCTION === 'true';

if (supabaseUrl.includes('yagoticnplkqfzitjqge') && !evalAllowProduction) {
  throw new Error(
    'Production database detected. Set EVAL_ALLOW_PRODUCTION=true to proceed.'
  );
}
```

The production Supabase project ID `yagoticnplkqfzitjqge` is hardcoded into
the guard intentionally. It must not be configurable via environment variable
because a misconfigured variable could disable the guard.

---

## EVAL_ALLOW_PRODUCTION Flag

For the MVP phase, eval scripts run against the production Supabase project
because no separate staging environment exists. `EVAL_ALLOW_PRODUCTION=true`
is set in CI secrets to permit this.

This is a known compromise. When the product is funded and rebuilt with a
dedicated staging environment, `EVAL_ALLOW_PRODUCTION` must be set to `false`
in all CI secrets and the production refusal guard updated accordingly.

The flag is named to communicate the risk explicitly. Anyone setting it to
`true` must understand they are authorizing eval scripts to run against
production data.

---

## Local Setup

1. Create `.env.test` at the repo root
2. Set the following variables:
SUPABASE_TEST_URL=https://yagoticnplkqfzitjqge.supabase.co
SUPABASE_TEST_ANON_KEY=[anon key from Vercel env vars]
SUPABASE_TEST_SERVICE_ROLE_KEY=[service role key - never commit this]
TEST_USER_ID=[UUID of the dedicated test user from Supabase Auth]
EVAL_ALLOW_PRODUCTION=true
3. Run `test-user-setup.sql` to initialize the test user and baseline data
4. Run the eval suite
5. Run `test-user-cleanup.sql` to remove all test data

Never commit `.env.test`. It must be in `.gitignore`.

---

## GitHub Actions Secrets Required

| Secret | Used By | Notes |
|--------|---------|-------|
| `SUPABASE_TEST_URL` | Tier 1 and Tier 2 | Production URL for MVP phase |
| `SUPABASE_TEST_ANON_KEY` | Tier 1 and Tier 2 | Anon key only - never service role in Tier 1 |
| `TEST_USER_ID` | Tier 1 and Tier 2 | UUID of dedicated test user |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | Tier 2 only | Required for SQL audits and RLS bypass tests |
| `EVAL_ALLOW_PRODUCTION` | Tier 2 only | Set to `true` for MVP phase |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-09 | Initial fixtures documentation |
