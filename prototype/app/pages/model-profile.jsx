import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../hooks.mjs";
import { request } from "../api.mjs";
import { path } from "../router.mjs";
import { PageHeading } from "../components/ui.jsx";
import { Contributions } from "../components/contributions.jsx";
import { Activity } from "./commons-panels.jsx";
import {
  modelContributions,
  commonsPullPath,
} from "../../../shared/contributions.mjs";
import { revisionTag } from "../../../shared/revisions.mjs";
import { cachedCommons, retainCommons } from "./commons-cache.mjs";

export function ModelProfile({ id }) {
  const { data: workspace } = useWorkspace();
  const runId = workspace.runId;
  const [data, setData] = useState(() => cachedCommons(runId));
  const [pending, setPending] = useState(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(data?.version ?? null);
  const accepted = useRef(data);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const next = await request(`commons?runId=${runId}`, {
          signal: controller.signal,
          etag:
            latest.current === null
              ? undefined
              : revisionTag("commons", runId, latest.current),
        });
        if (controller.signal.aborted) return;
        setError("");
        if (next) {
          latest.current = next.version;
          retainCommons(next);
          if (accepted.current && window.scrollY > 200) setPending(next);
          else {
            accepted.current = next;
            setData(next);
            setPending(null);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 2500);
    }
    if (!paused) void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId, paused]);
  const {
    jobs,
    pulls,
    created,
    improved,
    accepted: merged,
  } = modelContributions(data, id);
  const ids = new Set(jobs.map((job) => job.id));
  const projects = data?.projects || [];
  const awaiting = pulls.filter((pull) => pull.status !== "merged");
  const forks = projects.flatMap((project) =>
    project.forks
      .filter((fork) => ids.has(fork.jobId))
      .map((fork) => ({ ...fork, project })),
  );
  const events = data?.events.filter((event) => ids.has(event.jobId)) || [];
  return (
    <div className="model-profile">
      <PageHeading title={id}>
        Local model · Recorded Builder and Reviewer calls
      </PageHeading>
      <div className="model-live-controls">
        <span role="status">
          {error ? "Disconnected" : paused ? "Updates paused" : "Live"} ·{" "}
          {jobs.length} tasks ·{" "}
          {pulls.filter((p) => p.status === "merged").length} merged
        </span>
        <button className="btn" onClick={() => setPaused(!paused)}>
          {paused ? "Resume updates" : "Pause updates"}
        </button>
        {pending && (
          <button
            className="btn"
            onClick={() => {
              accepted.current = pending;
              setData(pending);
              setPending(null);
            }}
          >
            Show new activity
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p aria-busy="true">Loading model history…</p>
      ) : (
        <>
          {!jobs.length && (
            <p>No recorded local calls for this model in the current run.</p>
          )}
          <div className="model-contribution-summary">
            <Contributions
              created={created}
              improved={improved}
              accepted={merged}
              projects={projects}
              jobs={data.jobs}
            />
          </div>
          <div className="page-columns">
            <div className="page-primary">
              <section aria-label="Model timeline">
                <h2>Live timeline</h2>
                <p className="commons-meta">
                  Recorded task lifecycle, including operator decisions. Syntax
                  checks do not establish runtime correctness.
                </p>
                <Activity
                  events={events}
                  pulls={pulls}
                  onPull={(pullId) => {
                    const pull = pulls.find((p) => p.id === pullId);
                    if (pull)
                      location.hash = commonsPullPath(pull.repoId, pull.id);
                  }}
                  onVersion={(repoId, version) => {
                    location.hash = `/commons/${encodeURIComponent(repoId)}?view=versions&version=${version}`;
                  }}
                />
              </section>
            </div>
            <aside
              className="page-support"
              aria-label="Forks and pending changes"
            >
              {" "}
              <section aria-label="Model forks">
                <h2>Forks ({forks.length})</h2>
                <ul className="model-records">
                  {forks.map((fork) => (
                    <li key={fork.id}>
                      <a href={path("commons", fork.project.id)}>
                        {fork.project.name}
                      </a>
                      <span>
                        from v{fork.baseRevision} · {fork.actor}
                      </span>
                      <code>{fork.id.slice(0, 8)}</code>
                    </li>
                  ))}
                </ul>
                {!forks.length && <p className="muted">No retained forks.</p>}
              </section>
              <section aria-label="Model pull requests">
                <h2>Other pull requests ({awaiting.length})</h2>
                <ul className="model-records">
                  {awaiting.map((pull) => (
                    <li key={pull.id}>
                      <a href={commonsPullPath(pull.repoId, pull.id)}>
                        {pull.repoId} #{pull.number} · {pull.title}
                      </a>
                      <span>
                        {pull.status} · {pull.path}
                      </span>
                    </li>
                  ))}
                </ul>
                {!awaiting.length && (
                  <p className="muted">No unmerged pull requests.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
