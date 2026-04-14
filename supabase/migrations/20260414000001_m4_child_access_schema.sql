-- M4.2: Child Access Schema
-- Creates child_access_codes and child_accounts tables
-- Adds RLS policies for child read access to releases and entries

-- child_access_codes: invite codes dad generates per child profile
-- Invalidated after use
CREATE TABLE child_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dad_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_profile_id UUID NOT NULL REFERENCES childrenprofiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = not yet used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX idx_child_access_codes_dad_id ON child_access_codes(dad_id);
CREATE INDEX idx_child_access_codes_code ON child_access_codes(code);
CREATE INDEX idx_child_access_codes_child_profile_id ON child_access_codes(child_profile_id);

ALTER TABLE child_access_codes ENABLE ROW LEVEL SECURITY;

-- Dad can read and create codes for their own child profiles
CREATE POLICY "Dad can read own access codes"
  ON child_access_codes FOR SELECT
  TO authenticated
  USING (dad_id = auth.uid());

CREATE POLICY "Dad can create access codes for own child profiles"
  ON child_access_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    dad_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM childrenprofiles
      WHERE childrenprofiles.id = child_profile_id
        AND childrenprofiles.user_id = auth.uid()
    )
  );

-- Code validation at registration: service role only (handled by edge function)
-- No client-side UPDATE permitted via RLS


-- child_accounts: links a registered child auth user to a child profile
-- Written server-side at registration via edge function using service role
CREATE TABLE child_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_profile_id UUID NOT NULL REFERENCES childrenprofiles(id) ON DELETE CASCADE,
  dad_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(child_user_id), -- one child account per auth user
  UNIQUE(child_profile_id) -- one registered account per child profile
);

CREATE INDEX idx_child_accounts_child_user_id ON child_accounts(child_user_id);
CREATE INDEX idx_child_accounts_child_profile_id ON child_accounts(child_profile_id);
CREATE INDEX idx_child_accounts_dad_id ON child_accounts(dad_id);

ALTER TABLE child_accounts ENABLE ROW LEVEL SECURITY;

-- Child can read their own account record
CREATE POLICY "Child can read own account"
  ON child_accounts FOR SELECT
  TO authenticated
  USING (child_user_id = auth.uid());

-- Dad can read child accounts linked to them
CREATE POLICY "Dad can read child accounts linked to them"
  ON child_accounts FOR SELECT
  TO authenticated
  USING (dad_id = auth.uid());

-- No INSERT, UPDATE, or DELETE via client - service role only


-- RLS on releases: child can read releases targeting their child profile
CREATE POLICY "Child can read releases for their profile"
  ON releases FOR SELECT
  TO authenticated
  USING (
    child_id IN (
      SELECT child_profile_id FROM child_accounts
      WHERE child_accounts.child_user_id = auth.uid()
    )
  );

-- RLS on entries: child can read entries that have been released to their profile
-- and are not soft-deleted
CREATE POLICY "Child can read released entries"
  ON entries FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT releases.entry_id FROM releases
      INNER JOIN child_accounts ON child_accounts.child_profile_id = releases.child_id
      WHERE child_accounts.child_user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );
