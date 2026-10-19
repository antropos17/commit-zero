ALTER TABLE commons ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
CREATE TABLE commons_projects (
  run_id uuid NOT NULL REFERENCES commons(run_id),
  id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  document jsonb NOT NULL CHECK (document->>'id' = id),
  PRIMARY KEY(run_id,id),
  UNIQUE(run_id,position)
);
CREATE TABLE commons_jobs (
  run_id uuid NOT NULL REFERENCES commons(run_id),
  id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  document jsonb NOT NULL CHECK ((document->>'id')::uuid = id),
  status text GENERATED ALWAYS AS (document->>'status') STORED,
  PRIMARY KEY(run_id,id),
  UNIQUE(run_id,position)
);
CREATE INDEX commons_running_jobs ON commons_jobs(run_id) WHERE status='running';
CREATE TABLE commons_events (
  run_id uuid NOT NULL REFERENCES commons(run_id),
  sequence integer NOT NULL CHECK (sequence > 0),
  id uuid NOT NULL,
  document jsonb NOT NULL CHECK ((document->>'id')::uuid = id AND (document->>'sequence')::integer = sequence),
  PRIMARY KEY(run_id,sequence),
  UNIQUE(run_id,id)
);
INSERT INTO commons_projects(run_id,id,position,document)
SELECT c.run_id,p.value->>'id',p.ordinality-1,p.value FROM commons c,
LATERAL jsonb_array_elements(c.document->'projects') WITH ORDINALITY p;
INSERT INTO commons_jobs(run_id,id,position,document)
SELECT c.run_id,(j.value->>'id')::uuid,j.ordinality-1,j.value FROM commons c,
LATERAL jsonb_array_elements(c.document->'jobs') WITH ORDINALITY j;
INSERT INTO commons_events(run_id,sequence,id,document)
SELECT c.run_id,(e.value->>'sequence')::integer,(e.value->>'id')::uuid,e.value FROM commons c,
LATERAL jsonb_array_elements(c.document->'events') e;
UPDATE commons SET revision=(document->>'version')::integer,
document=document-'projects'-'jobs'-'events'-'version';
CREATE INDEX experiment_runs_recent ON experiment_runs(created_at DESC,id);
CREATE INDEX experiment_artifacts_order ON experiment_artifacts(run_id,created_at,name);
