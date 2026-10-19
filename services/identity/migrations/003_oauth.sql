ALTER TABLE accounts ALTER COLUMN password_hash DROP NOT NULL;
CREATE TABLE external_identities (
  provider text NOT NULL CHECK (provider IN ('github', 'google')),
  subject text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider, subject)
);
CREATE INDEX external_identity_account ON external_identities(account_id);
CREATE TABLE oauth_attempts (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('github', 'google')),
  verifier text NOT NULL,
  destination text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_attempt_expiry ON oauth_attempts(expires_at);
