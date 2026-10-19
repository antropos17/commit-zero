import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "../hooks.mjs";
import { request } from "../api.mjs";
import { path } from "../router.mjs";
import { Contributor } from "./project-contributions.jsx";
import { Icon } from "./ui.jsx";
import { RecordedTime, actorNames } from "../pages/commons-panels.jsx";
import { commonsPullPath } from "../../../shared/contributions.mjs";
import {
  localProjectTimeline,
  scenarioProjectTimeline,
} from "../../../shared/project-timeline.mjs";

export function LocalProjectTimeline({
  project,
  jobs,
  events,
  offline,
  paused,
  taskId,
}) {
  const rows = useMemo(
    () => localProjectTimeline(project, jobs, events, taskId),
    [project, jobs, events, taskId],
  );
  return (
    <ProjectTimeline
      rows={rows}
      projectId={project.id}
      offline={offline}
      sourcePaused={paused}
    />
  );
}

export function ScenarioProjectTimeline({ projectId }) {
  const { data, refresh } = useWorkspace();
  const [snapshot, setSnapshot] = useState(data);
  const [error, setError] = useState("");
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const workspaceVersion = useRef(data.version);
  workspaceVersion.current = data.version;
  useEffect(() => {
    setSnapshot((old) => (data.version >= old.version ? data : old));
  }, [data]);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const next = await request("state", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setError("");
        if (next.runId === data.runId) {
          setSnapshot((old) => (next.version > old.version ? next : old));
          if (next.version > workspaceVersion.current)
            void refreshRef.current(true);
        } else void refreshRef.current(true);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 3000);
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [data.runId]);
  const rows = useMemo(
    () =>
      scenarioProjectTimeline(
        projectId,
        snapshot.events,
        snapshot.prs,
        snapshot.runId,
      ),
    [projectId, snapshot],
  );
  return (
    <ProjectTimeline
      rows={rows}
      projectId={projectId}
      agents={snapshot.agents}
      simulated
      offline={error}
    />
  );
}

function ProjectTimeline({
  rows,
  projectId,
  agents = [],
  simulated = false,
  offline = false,
  sourcePaused = false,
}) {
  const [shown, setShown] = useState(rows);
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState(null);
  const section = useRef(null);
  const accepted = useRef(rows);
  useEffect(() => {
    const signature = (items) =>
      JSON.stringify(
        items.map(({ id, action, model, version }) => [
          id,
          action,
          model,
          version,
        ]),
      );
    if (signature(rows) === signature(accepted.current)) return;
    if (
      paused ||
      section.current?.getBoundingClientRect().top < 0 ||
      section.current?.querySelector(".project-timeline-events")?.scrollTop > 0
    )
      setPending(rows);
    else {
      accepted.current = rows;
      setShown(rows);
      setPending(null);
    }
  }, [rows, paused]);
  function show(next) {
    accepted.current = next;
    setShown(next);
    setPending(null);
  }
  return (
    <section
      className="project-live-timeline"
      aria-label="Project live timeline"
      ref={section}
    >
      <div className="project-timeline-heading">
        <h2>Live timeline</h2>
        <span className="commons-meta" role="status">
          {offline
            ? "Offline · saved events"
            : paused || sourcePaused
              ? "Paused"
              : "Live"}{" "}
          · {simulated ? "Scenario" : "Local records"}
        </span>
      </div>
      <div className="project-timeline-controls">
        <button
          className="btn"
          aria-pressed={paused}
          onClick={() => {
            if (paused) show(rows);
            setPaused(!paused);
          }}
        >
          {paused ? "Resume timeline" : "Pause timeline"}
        </button>
        <button
          className="btn"
          disabled={!pending}
          onClick={() => show(pending)}
        >
          {pending ? "Show new activity" : "Up to date"}
        </button>
      </div>
      {!shown.length && <p className="muted">No recorded changes yet.</p>}
      <ol
        className="project-timeline-events"
        tabIndex={0}
        aria-label="Timeline events"
      >
        {shown.map((row) => {
          const agent =
            simulated && agents.find((item) => item.id === row.actor);
          return (
            <li key={row.id} data-project-event={row.id}>
              <div className="project-event-who">
                {agent || row.model ? (
                  <Contributor agent={agent} model={row.model} />
                ) : (
                  <span className="project-event-system">
                    <Icon name={row.actor === "system" ? "check" : "pr"} />
                    {actorNames[row.actor] || "Unknown author"}
                  </span>
                )}
                {row.model && (
                  <span className="commons-meta">{actorNames[row.actor]}</span>
                )}
              </div>
              <div className="project-event-action">
                <span>{row.action}</span>
                {row.task && (
                  <a
                    href={`${path("commons", projectId)}?view=tasks&task=${row.task.id}`}
                  >
                    Task #{row.task.number}
                  </a>
                )}
                {row.forkId && <code>fork {row.forkId.slice(0, 8)}</code>}
                {row.text && <p className="project-event-text">{row.text}</p>}
                {row.file && <code>{row.file}</code>}
                {row.pull && (
                  <a
                    title={row.pull.title}
                    href={
                      simulated
                        ? path("pr", row.pull.id, "files")
                        : commonsPullPath(projectId, row.pull.id)
                    }
                  >
                    PR #{simulated ? row.pull.id : row.pull.number}
                  </a>
                )}
                {row.version != null && (
                  <a
                    href={`${path("commons", projectId)}?view=versions&version=${row.version}`}
                  >
                    v{row.version}
                  </a>
                )}
              </div>
              <RecordedTime at={row.at} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
