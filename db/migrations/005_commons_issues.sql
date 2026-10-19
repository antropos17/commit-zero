CREATE TABLE commons_issues (
  run_id uuid NOT NULL,
  repo_id text NOT NULL,
  id uuid NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  document jsonb NOT NULL CHECK (document ? 'id' AND document ? 'number' AND document ? 'status'
    AND (document->>'id')::uuid = id AND (document->>'number')::integer = number
    AND document->>'status' IN ('open','closed')),
  PRIMARY KEY(run_id,id),
  UNIQUE(run_id,repo_id,number),
  FOREIGN KEY(run_id,repo_id) REFERENCES commons_projects(run_id,id)
);
INSERT INTO commons_issues(run_id,repo_id,id,number,document)
SELECT p.run_id,p.id,(i->>'id')::uuid,(i->>'number')::integer,i
FROM commons_projects p, LATERAL jsonb_array_elements(COALESCE(p.document->'issues','[]'::jsonb)) i;
UPDATE commons_projects SET document=jsonb_set(document,'{issues}','[]'::jsonb) WHERE document ? 'issues';
