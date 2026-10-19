CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  biography text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE bookmarks (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  repo_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id, repo_id)
);
