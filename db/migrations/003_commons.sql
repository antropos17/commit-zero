CREATE TABLE commons (
  run_id uuid PRIMARY KEY REFERENCES runs(id),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
