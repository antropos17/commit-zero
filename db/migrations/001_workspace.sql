CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  step integer NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 10),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspace (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active_run uuid REFERENCES runs(id)
);
INSERT INTO workspace (id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS agents (
  run_id uuid NOT NULL REFERENCES runs(id),
  id text NOT NULL,
  position integer NOT NULL,
  profile jsonb NOT NULL,
  PRIMARY KEY (run_id,id)
);
CREATE TABLE IF NOT EXISTS follows (
  run_id uuid NOT NULL,
  agent_id text NOT NULL,
  target_id text NOT NULL,
  PRIMARY KEY (run_id,agent_id,target_id),
  FOREIGN KEY (run_id,agent_id) REFERENCES agents(run_id,id),
  FOREIGN KEY (run_id,target_id) REFERENCES agents(run_id,id),
  CHECK (agent_id <> target_id)
);
CREATE TABLE IF NOT EXISTS repositories (
  run_id uuid NOT NULL,
  id text NOT NULL,
  owner_id text NOT NULL,
  position integer NOT NULL,
  metadata jsonb NOT NULL,
  PRIMARY KEY (run_id,id),
  FOREIGN KEY (run_id,owner_id) REFERENCES agents(run_id,id)
);
CREATE INDEX repositories_owner_idx ON repositories(run_id,owner_id);
CREATE TABLE IF NOT EXISTS files (
  run_id uuid NOT NULL,
  repo_id text NOT NULL,
  path text NOT NULL CHECK (path NOT LIKE '%..%' AND path NOT LIKE '/%'),
  position integer NOT NULL,
  content text NOT NULL,
  PRIMARY KEY (run_id,repo_id,path),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id)
);
CREATE TABLE IF NOT EXISTS stars (
  run_id uuid NOT NULL,
  repo_id text NOT NULL,
  agent_id text NOT NULL,
  PRIMARY KEY (run_id,repo_id,agent_id),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,agent_id) REFERENCES agents(run_id,id)
);
CREATE TABLE IF NOT EXISTS lineage (
  run_id uuid NOT NULL,
  repo_id text NOT NULL,
  source_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fork','reuse')),
  PRIMARY KEY (run_id,repo_id,source_id),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,source_id) REFERENCES repositories(run_id,id),
  CHECK (repo_id <> source_id)
);
CREATE TABLE IF NOT EXISTS pull_requests (
  run_id uuid NOT NULL,
  id integer NOT NULL,
  repo_id text NOT NULL,
  author_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('open','merged')),
  checks text NOT NULL CHECK (checks IN ('pending','passed','failed')),
  approved boolean NOT NULL DEFAULT false,
  position integer NOT NULL,
  details jsonb NOT NULL,
  PRIMARY KEY (run_id,id),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,author_id) REFERENCES agents(run_id,id),
  CHECK (status <> 'merged' OR (checks = 'passed' AND approved))
);
CREATE INDEX pull_requests_status_idx ON pull_requests(run_id,status);
CREATE TABLE IF NOT EXISTS issues (
  run_id uuid NOT NULL,
  id integer NOT NULL,
  repo_id text NOT NULL,
  author_id text NOT NULL,
  pr_id integer,
  details jsonb NOT NULL,
  PRIMARY KEY (run_id,id),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,author_id) REFERENCES agents(run_id,id),
  FOREIGN KEY (run_id,pr_id) REFERENCES pull_requests(run_id,id)
);
CREATE TABLE IF NOT EXISTS memories (
  run_id uuid NOT NULL,
  agent_id text NOT NULL,
  position integer NOT NULL,
  source_repo text NOT NULL,
  source_pr integer,
  content jsonb NOT NULL,
  PRIMARY KEY (run_id,agent_id,position),
  FOREIGN KEY (run_id,agent_id) REFERENCES agents(run_id,id),
  FOREIGN KEY (run_id,source_repo) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,source_pr) REFERENCES pull_requests(run_id,id)
);
CREATE TABLE IF NOT EXISTS events (
  run_id uuid NOT NULL,
  sequence integer NOT NULL,
  actor_id text NOT NULL,
  repo_id text NOT NULL,
  pr_id integer,
  kind text NOT NULL,
  data jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id,sequence),
  FOREIGN KEY (run_id,actor_id) REFERENCES agents(run_id,id),
  FOREIGN KEY (run_id,repo_id) REFERENCES repositories(run_id,id),
  FOREIGN KEY (run_id,pr_id) REFERENCES pull_requests(run_id,id)
);
CREATE INDEX events_actor_idx ON events(run_id,actor_id,sequence DESC);

