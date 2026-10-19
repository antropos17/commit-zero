import React from "react";
import { path } from "../router.mjs";
import { RecordedTime, SourceMessage } from "./commons-panels.jsx";

export function Tasks({
  jobs,
  onPull,
  onTimeline,
  onVersion,
  onOpen,
  focused,
}) {
  if (!jobs.length)
    return (
      <p className="commons-empty">No tasks yet. Use New task to start.</p>
    );
  return (
    <ol className="commons-tasks" aria-label="Saved tasks">
      {jobs.map((job) => (
        <li key={job.id}>
          <div className="commons-byline">
            <h2>Task #{job.number}</h2>
            <a href={path("commons", job.repoId)}>{job.repoId}</a>
            <span>{job.phase}</span>
          </div>
          <p className="commons-task-text">{job.task}</p>
          {job.issue && (
            <p>
              <a href={`${path("commons", job.repoId)}?view=issues`}>
                Issue #{job.issue.number}: {job.issue.title}
              </a>{" "}
              · {job.issue.status}
            </p>
          )}
          {job.agent && (
            <p className="commons-meta">
              {job.agent.name} · configuration v{job.agent.version} ·{" "}
              {job.agent.maxMinutes} minutes max · permissions:{" "}
              {job.agent.capabilities.join(", ")}
            </p>
          )}
          <SourceMessage event={job.sourceMessage} />
          {job.fork && (
            <p className="commons-meta">
              Fork <code>{job.fork.id.slice(0, 8)}</code> · base v
              {job.fork.baseRevision} · {Object.keys(job.fork.files).length}{" "}
              files retained
            </p>
          )}
          {job.sourcePull && (
            <button
              className="commons-text-button"
              onClick={() => onPull(job.sourcePull.id)}
            >
              Revision of PR #{job.sourcePull.number}
            </button>
          )}
          <div className="commons-byline">
            <span>
              Started <RecordedTime at={job.startedAt} />
            </span>
            {job.finishedAt && (
              <span>
                Finished <RecordedTime at={job.finishedAt} />
              </span>
            )}
          </div>
          <p className="commons-meta">
            {job.model} · {job.provenance} · {job.responseCount} recorded
            responses
          </p>
          {job.reason && <p className="commons-task-text">{job.reason}</p>}
          <div className="commons-actions">
            <strong>{job.outcome}</strong>
            {!focused && (
              <button className="btn" onClick={() => onOpen(job.id)}>
                Open task #{job.number}
              </button>
            )}
            {job.pull && (
              <button
                className="commons-text-button"
                onClick={() => onPull(job.pull.id)}
              >
                PR #{job.pull.number}
              </button>
            )}
            {job.pull?.status === "merged" && (
              <button
                className="commons-text-button"
                onClick={() => onVersion(job.repoId, job.pull.baseRevision + 1)}
              >
                View v{job.pull.baseRevision + 1}
              </button>
            )}
            <button
              className="commons-text-button"
              onClick={() => onTimeline(job.id)}
            >
              Task #{job.number} timeline
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
