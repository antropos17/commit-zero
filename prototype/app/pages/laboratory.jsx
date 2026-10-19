import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { revisionTag } from "../../../shared/revisions.mjs";
import { request } from "../api.mjs";
import { PageHeading } from "../components/ui.jsx";
import { ArenaArtifact, ArenaProgress } from "./arena-panels.jsx";
import { ArenaTheater } from "./arena-theater.jsx";

function PolicyChanges({ changes }) {
  return (
    <div className="lab-changes">
      {changes.map((change) => (
        <div key={change.game}>
          <h3>{change.game}</h3>
          <pre
            className="lab-policy-before"
            aria-label={`Previous policy for ${change.game}`}
          >
            <code>− {JSON.stringify(change.before)}</code>
          </pre>
          <pre
            className="lab-policy-after"
            aria-label={`Proposed policy for ${change.game}`}
          >
            <code>+ {JSON.stringify(change.after)}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}

function Artifact({ runId, name }) {
  const [item, setItem] = useState(null),
    [error, setError] = useState(""),
    [step, setStep] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setItem(null);
    setError("");
    setStep(0);
    if (name)
      request(`lab/runs/${runId}/artifacts/${name}`, {
        signal: controller.signal,
      })
        .then((value) => {
          if (!controller.signal.aborted) setItem(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [runId, name]);
  if (!name)
    return (
      <p className="muted">
        Choose a saved artifact or a match in the timeline to inspect the exact
        output.
      </p>
    );
  const content = item?.content,
    match = Array.isArray(content?.moves),
    move = match ? content.moves[step - 1] : null;
  const heap = move?.after ?? content?.opening;
  const source = item ? JSON.stringify(content, null, 2) : "";
  return (
    <section className="lab-artifact" aria-label="Artifact inspector">
      <h2>{name}</h2>
      {error && <p role="alert">{error}</p>}
      {!item && !error && <p role="status">Loading artifact…</p>}
      {content && <ArenaArtifact key={name} content={content} />}
      {content?.changes && (
        <>
          <p>
            <strong>
              {content.evaluation.accepted ? "Promoted" : "Not promoted"}
            </strong>{" "}
            · strategist {content.player + 1} · generation {content.generation}
          </p>
          <p>{content.analysis}</p>
          <p className="muted">
            Model interpretation. Candidate source:{" "}
            {content.candidateProvenance || "local_model"}. The executed checks
            below determine promotion.
          </p>
          <PolicyChanges changes={content.changes} />
          <p>{content.evaluation.reason}</p>
          <p>
            Control mistakes: {content.evaluation.before.controlErrors} →{" "}
            {content.evaluation.after.controlErrors}. Wins against frozen
            opponents: {content.evaluation.before.wins} →{" "}
            {content.evaluation.after.wins} /{" "}
            {content.evaluation.matchesPerVersion}.
          </p>
        </>
      )}
      {match && (
        <div className="lab-replay">
          <h3>{content.game} · match replay</h3>
          <p>
            {step === 0
              ? `Opening: ${heap} stones. Strategy ${content.first + 1} moves first.`
              : `Strategy ${move.player + 1} removed ${move.move}. ${heap} stones remain.`}
          </p>
          <div className="lab-stones" aria-label={`${heap} stones remaining`}>
            {Array.from({ length: heap }, (_, i) => (
              <span key={i} aria-hidden="true" />
            ))}
          </div>
          <label>
            Replay turn {step} / {content.moves.length}
            <input
              aria-label="Replay turn"
              type="range"
              min="0"
              max={content.moves.length}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
            />
          </label>
          <div className="lab-controls">
            <button
              className="btn"
              disabled={!step}
              onClick={() => setStep((s) => s - 1)}
            >
              Previous move
            </button>
            <button
              className="btn"
              disabled={step === content.moves.length}
              onClick={() => setStep((s) => s + 1)}
            >
              Next move
            </button>
          </div>
          <p>
            Winner: strategy {content.winner + 1}. Every move below was executed
            by the bounded interpreter.
          </p>
        </div>
      )}
      {item && (
        <>
          <p className="lab-hash">SHA-256 {item.sha256}</p>
          {source.length > 10000 && (
            <p>
              Source preview: first 10,000 characters.{" "}
              <a
                href={`/api/lab/runs/${runId}/artifacts/${name}`}
                download={name}
              >
                Download complete artifact
              </a>
            </p>
          )}
          <pre
            className="lab-source"
            tabIndex="0"
            aria-label="Saved artifact source"
          >
            <code>{source.slice(0, 10000)}</code>
          </pre>
        </>
      )}
    </section>
  );
}
export function Laboratory({ id }) {
  const [catalog, setCatalog] = useState(null),
    [run, setRun] = useState(null),
    [error, setError] = useState(""),
    [catalogError, setCatalogError] = useState(""),
    [runError, setRunError] = useState(""),
    [catalogPending, setCatalogPending] = useState(true),
    [catalogRefresh, setCatalogRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [actor, setActor] = useState(""),
    [eventType, setEventType] = useState("changes"),
    [rounds, setRounds] = useState(2),
    [mode, setMode] = useState("arena"),
    [artifact, setArtifact] = useState("");
  const latest = useRef(null),
    inspector = useRef(null),
    catalogOrigin = useRef(null);
  useLayoutEffect(() => {
    if (catalogPending) return;
    const origin = catalogOrigin.current;
    catalogOrigin.current = null;
    if (
      origin &&
      origin.hash === location.hash &&
      (document.activeElement === document.body ||
        document.activeElement === origin.trigger)
    )
      origin.trigger.focus({ preventScroll: true });
  }, [catalogPending, catalog, catalogError]);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    const load = async (foreground = false) => {
      if (loading) return;
      loading = true;
      if (foreground) setCatalogPending(true);
      try {
        const value = await request("lab", { signal: controller.signal });
        if (
          !Array.isArray(value?.runs) ||
          value.runs.some(
            (item) =>
              !item ||
              typeof item.id !== "string" ||
              typeof item.status !== "string",
          ) ||
          typeof value.provider?.available !== "boolean" ||
          (value.provider.reason !== undefined &&
            typeof value.provider.reason !== "string")
        )
          throw new Error(
            "The service returned invalid experiment discovery data. Refresh to try again.",
          );
        if (!controller.signal.aborted) {
          setCatalog(value);
          setCatalogError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) setCatalogError(e.message);
      } finally {
        loading = false;
        if (foreground && !controller.signal.aborted) setCatalogPending(false);
      }
    };
    void load(true);
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [catalogRefresh]);
  const selected = id || catalog?.runs[0]?.id;
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    latest.current = null;
    setRun(null);
    setArtifact("");
    setActor("");
    setError("");
    setRunError("");
    if (!selected) return () => controller.abort();
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = await request(`lab/runs/${selected}`, {
          signal: controller.signal,
          etag: latest.current
            ? revisionTag("lab", selected, latest.current.version)
            : undefined,
        });
        if (!controller.signal.aborted) {
          setRunError("");
          if (value && latest.current?.version !== value.version) {
            latest.current = value;
            setRun(value);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) setRunError(e.message);
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 1000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [selected]);
  async function start(continueRun = false) {
    setBusy(true);
    setError("");
    try {
      const next = await request("lab/runs", {
        method: "POST",
        body: {
          mode: continueRun ? run.summary.mode || "heap" : mode,
          learningRounds: rounds,
          ...(continueRun
            ? { sourceRunId: run.id, sourceVersion: run.version }
            : {}),
        },
      });
      location.hash = `/lab/${next.id}`;
      setCatalog((old) => ({ ...old, runs: [next, ...(old?.runs || [])] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    setError("");
    try {
      await request(`lab/runs/${run.id}/cancel`, {
        method: "POST",
        body: { version: run.version },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function inspect(name) {
    setArtifact(name);
    inspector.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  const running = run?.status === "running",
    active = catalog?.runs.some((r) => r.status === "running"),
    events =
      run?.events.filter(
        (e) =>
          (!actor || e.actor === actor) &&
          (eventType === "all" ||
            (eventType === "matches"
              ? ["match", "match-start", "round"].includes(e.kind)
              : !["match", "match-start", "round"].includes(e.kind))),
      ) || [],
    generations =
      run?.summary?.generations ||
      run?.events.filter((e) => e.kind === "generation").map((e) => e.data) ||
      [];
  return (
    <>
      <PageHeading
        title="Language lab"
        actions={
          <div className="lab-launch-actions">
            <button
              className="btn"
              disabled={catalogPending}
              onClick={(event) => {
                catalogOrigin.current = {
                  trigger: event.currentTarget,
                  hash: location.hash,
                };
                setCatalogPending(true);
                setCatalogRefresh((value) => value + 1);
              }}
            >
              Refresh experiments
            </button>
            <button
              className="btn green"
              onClick={() => start()}
              disabled={
                busy ||
                catalogPending ||
                Boolean(catalogError) ||
                catalog?.provider.available !== true ||
                active ||
                running
              }
            >
              {busy ? "Working…" : "Start local experiment"}
            </button>
            {run?.status === "completed" && (
              <button
                className="btn"
                onClick={() => start(true)}
                disabled={
                  busy ||
                  catalogPending ||
                  Boolean(catalogError) ||
                  active ||
                  catalog?.provider.available !== true
                }
              >
                Continue improving these strategies
              </button>
            )}
          </div>
        }
      >
        Watch matches, inspect losses, improve strategies.
      </PageHeading>
      <section
        className="lab-discovery-status"
        aria-label="Experiment discovery"
        aria-busy={catalogPending}
      >
        {catalogPending && (
          <p role="status">Checking experiment list and local model.</p>
        )}
        {catalogError && (
          <p className="inline-error" role="alert">
            {catalogError}
          </p>
        )}
        {catalogError && catalog && (
          <p className="small muted">
            Showing the last available experiment list. Local model availability
            is unknown.
          </p>
        )}
        {!catalog && !catalogPending && (
          <p>
            Experiment discovery is unavailable. Refresh experiments to try
            again.
          </p>
        )}
      </section>
      {(error || runError) && (
        <p className="inline-error" role="alert">
          {error || runError}
        </p>
      )}
      <div className="lab-workbench">
        <div className="lab-primary">
          <section className="lab-run-picker" aria-label="Selected experiment">
            <div className="lab-controls">
              <label>
                Run
                <select
                  aria-label="Experiment run"
                  disabled={!catalog?.runs.length}
                  value={selected || ""}
                  onChange={(e) => {
                    location.hash = `/lab/${e.target.value}`;
                  }}
                >
                  <option value="" disabled>
                    Select a run
                  </option>
                  {catalog?.runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.created_at).toLocaleString("en-US")} ·{" "}
                      {r.status}
                    </option>
                  ))}
                </select>
              </label>
              {running && (
                <button className="btn" disabled={busy} onClick={stop}>
                  Stop experiment
                </button>
              )}
            </div>

            {run && (
              <>
                <p className="lab-run-status" role="status">
                  <strong>{run.status}</strong> ·{" "}
                  {run.provenance === "local_model"
                    ? "Local model inference"
                    : run.provenance}{" "}
                  · {run.events.length} recorded events
                  {running ? " · updating every second" : ""}
                </p>
                {running && (
                  <p className="lab-current">
                    <strong>Latest activity: </strong>
                    {run.events.at(-1)?.message || "Preparing inference…"}
                  </p>
                )}
                {run.summary?.sourceRunId && (
                  <p>
                    Continued from{" "}
                    <a href={`#/lab/${run.summary.sourceRunId}`}>
                      parent experiment
                    </a>
                    . Earlier results are preserved.
                  </p>
                )}
              </>
            )}
          </section>
          {run?.summary.mode === "arena" && (
            <ArenaTheater
              key={run.id}
              run={run}
              connectionError={runError || catalogError || error}
            />
          )}
          {!selected && catalog && !catalogError && (
            <div className="lab-empty">
              <h2>Start with an empty experiment</h2>
              <p>
                No generated language, game or result is preloaded. The timeline
                begins when the local model is available and you start a run.
              </p>
            </div>
          )}
        </div>
        <aside className="lab-secondary" aria-label="Experiment setup">
          <section className="lab-setup" aria-label="New experiment">
            <h2>New experiment</h2>
            <div className="lab-controls">
              <label>
                Game mode
                <select
                  aria-label="Experiment mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={busy || running}
                >
                  <option value="arena">
                    Evolving rules · three strategies
                  </option>
                  <option value="heap">
                    Original heap games · two strategies
                  </option>
                </select>
              </label>
              <label>
                Improvement rounds
                <select
                  aria-label="Improvement rounds"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  disabled={busy || running}
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "round" : "rounds"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="lab-readiness" aria-label="Local runtime">
            <h2>Local runtime</h2>
            <strong>
              {catalogPending
                ? "Checking local model."
                : catalogError
                  ? "Local model availability unknown"
                  : catalog?.provider.available === true
                    ? "Local model ready"
                    : catalog
                      ? "Local model offline"
                      : "Checking local model…"}
            </strong>
            <p>Qwen2.5-Coder 7B · separate agent roles · no paid API.</p>
            {catalog?.provider.available === false &&
              !catalogError &&
              !catalogPending && <p>{catalog.provider.reason}</p>}
            <p>
              Bounded interpreter. Strategies evolve; model weights do not.
              Promotions require executed checks.
            </p>
            <a href="#/timeline">Scenario timeline</a>
          </section>
        </aside>
      </div>
      {run && (
        <>
          <div className="lab-layout">
            {" "}
            <section aria-label="Live experiment timeline">
              <h2>Live timeline</h2>
              <div className="lab-controls">
                <label>
                  Role
                  <select
                    aria-label="Experiment role"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  >
                    <option value="">All roles</option>
                    {[...new Set(run?.events.map((e) => e.actor) || [])].map(
                      (a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Events
                  <select
                    aria-label="Timeline events"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    <option value="changes">Analysis & changes</option>
                    <option value="matches">Matches</option>
                    <option value="all">All events</option>
                  </select>
                </label>
              </div>
              <ol
                className="lab-events"
                tabIndex="0"
                aria-label="Recorded experiment events"
              >
                {events.map((e) => (
                  <li key={e.sequence} data-lab-event={e.sequence}>
                    <div className="lab-event-heading">
                      <strong>{e.actor}</strong>
                      <span className={`lab-kind lab-${e.kind}`}>{e.kind}</span>
                    </div>
                    <p>{e.message}</p>
                    {e.kind === "analysis" && (
                      <p className="muted">
                        {run.summary.mode === "arena"
                          ? "Executed loss evidence · supplied to the local model."
                          : "Model interpretation · claims are checked by execution."}
                      </p>
                    )}
                    {e.data?.assistance === "host_synthesis" && (
                      <p className="muted">
                        Tool-generated candidates · selected by the local model.
                      </p>
                    )}
                    {e.data?.changes && (
                      <section>
                        <h3 className="section-title">Policy changes</h3>
                        <PolicyChanges changes={e.data.changes} />
                      </section>
                    )}
                    <div className="lab-event-meta">
                      <time dateTime={e.recorded_at}>
                        {new Date(e.recorded_at).toLocaleTimeString("en-US")}
                      </time>
                      <span>#{e.sequence}</span>
                      {e.data?.artifact && (
                        <button
                          className="btn"
                          onClick={() => inspect(e.data.artifact)}
                        >
                          Inspect {e.kind === "match" ? "match" : "artifact"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {!events.length && (
                <p className="muted">No events match these filters yet.</p>
              )}
            </section>
            <div ref={inspector} className="lab-inspector">
              <label>
                Saved artifact
                <select
                  aria-label="Saved artifact"
                  value={artifact}
                  onChange={(e) => setArtifact(e.target.value)}
                >
                  <option value="">Select an artifact</option>
                  {run.artifacts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <Artifact runId={run.id} name={artifact} />
            </div>
          </div>
          {run.summary.mode === "arena" && (
            <section className="spectator-report">
              <h3 className="section-title">
                Evolution results and rule tables
              </h3>
              <ArenaProgress run={run} generations={generations} />
            </section>
          )}
          {generations.length > 0 && run.summary.mode !== "arena" && (
            <section
              className="lab-results lab-learning-progress"
              aria-label="Learning progress"
            >
              <h2>Strategy evolution</h2>
              <p>
                G0 is the baseline. Control mistakes on heaps 33–64: fewer is
                better. These positions stay out of model feedback; the same
                control suite is reused each round.
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Round</th>
                    <th scope="col">Agent 1 errors</th>
                    <th scope="col">Agent 2 errors</th>
                    <th scope="col">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((g) => (
                    <tr key={g.generation}>
                      <th scope="row">{`G${g.generation}`}</th>
                      <td>{g.metrics[0].controlErrors}</td>
                      <td>{g.metrics[1].controlErrors}</td>
                      <td>{g.scores.join(" : ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!running && run.summary.generations && (
                <p>
                  {run.summary.decisions?.filter((d) => d.accepted).length || 0}{" "}
                  proposals promoted. {run.summary.totalTournamentMatches}{" "}
                  tournament matches executed. Continue to run another bounded
                  learning cycle.
                </p>
              )}
            </section>
          )}
          {run.summary?.scores && (
            <section className="lab-results">
              <h2>Latest tournament</h2>
              <p>
                {run.summary.matches} matches across two games, with both
                starting seats and 16 opening heaps per game.
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Generated strategy</th>
                    <th scope="col">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {run.summary.strategies.map((s, i) => (
                    <tr key={i}>
                      <td>Strategist {i + 1}</td>
                      <td>{s}</td>
                      <td>{run.summary.scores[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                {run.summary.calls} model calls · {run.summary.usage.completion}{" "}
                output tokens · {(run.summary.elapsedMs / 1000).toFixed(1)}{" "}
                seconds.
              </p>
              {run.summary.identicalPolicies && (
                <p>
                  The final strategies use identical policies. This tournament
                  does not demonstrate policy diversity.
                </p>
              )}
              {run.summary.results?.every(
                (result) => result.turns === result.opening,
              ) && (
                <p>
                  Every recorded match used one-stone moves. The generated
                  programs did not demonstrate different tactical behavior in
                  this tournament.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
