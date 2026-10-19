CREATE TABLE experiment_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('running','completed','failed','cancelled','interrupted')),
  version integer NOT NULL DEFAULT 0,
  model text NOT NULL,
  provenance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX one_running_experiment ON experiment_runs ((status)) WHERE status='running';
CREATE TABLE experiment_events (
  run_id uuid NOT NULL REFERENCES experiment_runs(id),
  sequence integer NOT NULL,
  actor text NOT NULL,
  kind text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,sequence)
);
CREATE TABLE experiment_artifacts (
  run_id uuid NOT NULL REFERENCES experiment_runs(id),
  name text NOT NULL,
  sha256 text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,name)
);
