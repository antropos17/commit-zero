import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../hooks.mjs";
import { request } from "../api.mjs";
import { Avatar, Empty, PageHeading } from "../components/ui.jsx";
import { path } from "../router.mjs";

const labels = {
  issue: "Issue",
  pr: "Pull request",
  review: "Review",
  approve: "Approval",
  check: "Checks",
  merge: "Merge",
  star: "Star",
  learn: "Memory",
  create: "Project",
  fork: "Fork",
  comment: "Discussion",
  commit: "Code",
  follow: "Follow",
};
export function TimelineFeed({ actor = "", repository = "", compact = false }) {
  const { data: workspace, refresh } = useWorkspace();
  const workspaceRef = useRef({ workspace, refresh });
  workspaceRef.current = { workspace, refresh };
  const [agent, setAgent] = useState(actor),
    [repo, setRepo] = useState(repository),
    [kind, setKind] = useState("");
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [pending, setPending] = useState(null),
    [loading, setLoading] = useState(false);
  const current = useRef(null),
    feed = useRef(null),
    generation = useRef(0),
    pausedRef = useRef(false),
    refreshRef = useRef(null);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const query = new URLSearchParams({
    limit: compact ? "5" : "30",
    ...(actor || agent ? { actor: actor || agent } : {}),
    ...(repository || repo ? { repo: repository || repo } : {}),
    ...(kind ? { kind } : {}),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const version = ++generation.current;
    let running = false;
    current.current = null;
    setResult(null);
    setPending(null);
    setError("");
    const load = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const next = await request(`timeline?${query}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setError("");
        const latest = workspaceRef.current;
        if (
          latest.workspace.runId !== next.runId ||
          latest.workspace.version < next.version
        )
          void latest.refresh(true);
        if (
          current.current?.runId === next.runId &&
          current.current?.version === next.version
        )
          return;
        if (
          current.current &&
          (pausedRef.current ||
            feed.current?.getBoundingClientRect().top < 0 ||
            feed.current?.querySelector(".event-timeline")?.scrollTop > 0)
        ) {
          setPending(next);
          return;
        }
        current.current = next;
        setResult(next);
        setPending(null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        running = false;
      }
    };
    refreshRef.current = load;
    void load();
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        !pausedRef.current &&
        version === generation.current
      )
        void load();
    }, 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
      refreshRef.current = null;
    };
  }, [query]);
  useEffect(() => {
    if (!pausedRef.current) void refreshRef.current?.();
  }, [workspace.version]);
  async function older() {
    if (loading || !result?.nextBefore) return;
    setLoading(true);
    const version = generation.current;
    try {
      const next = await request(
        `timeline?${query}&runId=${result.runId}&before=${result.nextBefore}`,
      );
      if (
        version !== generation.current ||
        current.current?.runId !== next.runId
      )
        return;
      setResult((old) => {
        const seen = new Set(old.items.map((e) => e.id));
        const merged = {
          ...old,
          items: [...old.items, ...next.items.filter((e) => !seen.has(e.id))],
          nextBefore: next.nextBefore,
        };
        current.current = merged;
        return merged;
      });
    } catch (err) {
      if (version === generation.current) setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  const showPending = () => {
    current.current = pending;
    setResult(pending);
    setPending(null);
    feed.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  return (
    <section
      className={`timeline-feed${compact ? " compact" : ""}`}
      aria-label={actor ? "Agent timeline" : "Activity timeline"}
      ref={feed}
    >
      {!compact && (
        <div className="timeline-filters">
          {!actor && (
            <label>
              Agent
              <select value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">All agents</option>
                {(result?.agents || workspace.agents).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!repository && (
            <label>
              Project
              <select value={repo} onChange={(e) => setRepo(e.target.value)}>
                <option value="">All projects</option>
                {(result?.repositories || workspace.repos).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.owner}/{r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Action
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All actions</option>
              {Object.entries(labels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="timeline-status">
        <span role="status">
          {error
            ? "Updates unavailable"
            : paused
              ? "Updates paused"
              : "Live updates · every 3 seconds"}
          {result ? ` · ${result.total} events` : ""}
        </span>
        <button
          className="btn"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Resume updates" : "Pause updates"}
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error} {result ? "Saved events remain visible. " : ""}Updates retry
          automatically.
        </p>
      )}
      {pending && (
        <button className="btn timeline-new" onClick={showPending}>
          Show new activity
        </button>
      )}
      {!result && !error && <p role="status">Loading activity…</p>}
      {result?.items.length === 0 && (
        <Empty>No activity matches these filters.</Empty>
      )}
      <ol
        className="event-timeline"
        tabIndex={0}
        aria-label="Recorded activity"
      >
        {result?.items.map((event) => {
          const a = result.agents.find((item) => item.id === event.actor),
            r = result.repositories.find((item) => item.id === event.repo);
          return (
            <li key={event.id} data-event={event.id} className="timeline-event">
              <a
                className="timeline-avatar"
                href={path("agent", event.actor)}
                aria-label={`${a?.name || event.actor} profile`}
              >
                {a && <Avatar agent={a} />}
              </a>
              <article className="timeline-event-body">
                <div className="timeline-event-head">
                  <p>
                    <a
                      className="timeline-actor"
                      href={path("agent", event.actor)}
                    >
                      {a?.name || event.actor}
                    </a>{" "}
                    {event.text}
                  </p>
                  <span className={`timeline-kind kind-${event.type}`}>
                    {labels[event.type] || event.type}
                  </span>
                </div>
                <p className="timeline-detail">{event.detail}</p>
                <div className="timeline-evidence">
                  <a href={path("repo", event.repo)}>
                    {r ? `${r.owner}/${r.name}` : event.repo}
                  </a>
                  {event.pr && (
                    <a href={path("pr", event.pr)}>Pull request #{event.pr}</a>
                  )}
                  {event.type === "learn" && (
                    <a href={path("agent", event.actor, "memory")}>
                      View memory
                    </a>
                  )}
                </div>
                <div className="timeline-meta">
                  <span>
                    {event.step ? `Step ${event.step}` : "Initial state"}
                  </span>
                  <span>Simulated action</span>
                  {event.recordedAt && (
                    <time
                      dateTime={event.recordedAt}
                      title="Time recorded by the workspace"
                    >
                      Recorded{" "}
                      {new Date(event.recordedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      {compact ? (
        <a href={`#/timeline${actor ? `?agent=${actor}` : ""}`}>
          View full timeline
        </a>
      ) : (
        result?.nextBefore !== null &&
        result?.nextBefore !== undefined && (
          <button className="btn" disabled={loading} onClick={older}>
            {loading ? "Loading…" : "Load older activity"}
          </button>
        )
      )}
    </section>
  );
}
export function Timeline({ agent = "" }) {
  return (
    <>
      <PageHeading title="Timeline">
        Changes, reviews and merges · saved scenario.
      </PageHeading>
      <div className="page-columns">
        <div className="page-primary">
          <TimelineFeed key={agent} actor={agent} />
        </div>
        <aside className="page-support" aria-label="Activity sources">
          <section>
            <h2>Activity sources</h2>
            <nav className="support-links" aria-label="Activity source">
              <a href="#/timeline" aria-current="page">
                Scenario timeline
              </a>
              <a href="#/commons?view=activity">Local agent activity</a>
              <a href="#/lab">Local experiments</a>
            </nav>
          </section>
          <section>
            <h2>About this feed</h2>
            <p>
              Recorded scenario actions. Each event links to its project and
              evidence.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
