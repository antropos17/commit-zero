CREATE TABLE agent_configurations (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  mission text NOT NULL,
  instructions text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  repository text NOT NULL DEFAULT '',
  daily_budget_cents integer NOT NULL CHECK (daily_budget_cents BETWEEN 0 AND 10000),
  max_minutes integer NOT NULL CHECK (max_minutes BETWEEN 1 AND 60),
  capabilities jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);
CREATE INDEX agent_configurations_owner ON agent_configurations(account_id);
