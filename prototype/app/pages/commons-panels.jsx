import React, { useState } from "react";
import { SourceCode } from "../components/ui.jsx";
import { path } from "../router.mjs";
import { eventLabel } from "../../../shared/commons-history.mjs";
import { Comments } from "./commons-projects.jsx";

export const actorNames = {
  operator: "Local operator",
  builder: "Builder",
  reviewer: "Reviewer",
  system: "Workspace",
};
export function RecordedTime({ at }) {
  return at ? (
    <time dateTime={at} title={new Date(at).toLocaleString("en-GB")}>
      {new Date(at).toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  ) : null;
}
export function SourceMessage({ event }) {
  if (!event) return null;
  return (
    <section className="commons-source" aria-label="Source message">
      <div className="commons-byline">
        <strong>Source message</strong>
        <span>{actorNames[event.actor]}</span>
        <a href={`${path("commons", event.repoId)}?view=discussion`}>
          {event.repoId || "General"}
        </a>
        <RecordedTime at={event.at} />
      </div>
      <p>{event.text}</p>
    </section>
  );
}
export function CodeFiles({ files, label }) {
  const [selected, setSelected] = useState("");
  const filename = Object.hasOwn(files, selected)
    ? selected
    : Object.keys(files)[0];
  if (!filename) return <p className="commons-empty">No files.</p>;
  return (
    <section className="commons-code" aria-label={label}>
      <div className="commons-file-list" aria-label="Files">
        {Object.keys(files).map((name) => (
          <button
            className="commons-file"
            key={name}
            aria-pressed={name === filename}
            onClick={() => setSelected(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="commons-file-content">
        <div className="commons-file-title">
          {filename}
          <span>{label}</span>
        </div>
        <SourceCode text={files[filename]} />
      </div>
    </section>
  );
}
export function Forks({ forks }) {
  const [selected, setSelected] = useState("");
  const fork = forks.find((item) => item.id === selected) || forks[0];
  if (!fork)
    return <p className="commons-empty">No retained agent forks yet.</p>;
  return (
    <section aria-label="Retained forks">
      <nav className="commons-record-picker" aria-label="Select fork">
        {forks.map((item) => (
          <button
            className="btn"
            key={item.id}
            aria-pressed={fork.id === item.id}
            onClick={() => setSelected(item.id)}
          >
            <strong>Builder / {item.id.slice(0, 8)}</strong>
            <span>From v{item.baseRevision}</span>
          </button>
        ))}
      </nav>
      <CodeFiles
        key={fork.id}
        files={fork.files}
        label={`Fork ${fork.id.slice(0, 8)}`}
      />
    </section>
  );
}
export function Versions({ history, selected, onSelect, onPull }) {
  const snapshot =
    history.versions.find((v) => v.revision === selected) ||
    history.versions[0];
  if (history.error)
    return (
      <p role="alert" className="inline-error">
        {history.error}
      </p>
    );
  return (
    <div className="commons-versions">
      <ol aria-label="Project versions">
        {history.versions.map((version) => (
          <li key={version.revision}>
            <button
              className="commons-version"
              aria-pressed={snapshot.revision === version.revision}
              onClick={() => onSelect(version.revision)}
            >
              v{version.revision}
            </button>
            <div>
              <strong>{version.title}</strong>
              <div className="commons-byline commons-meta">
                <span>{actorNames[version.author]}</span>
                <RecordedTime at={version.at} />
                {version.prId && (
                  <button
                    className="commons-text-button"
                    onClick={() => onPull(version.prId)}
                  >
                    PR #{version.number}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <CodeFiles
        key={snapshot.revision}
        files={snapshot.files}
        label={`v${snapshot.revision}`}
      />
    </div>
  );
}
export function PullChanges({
  prs,
  pending,
  act,
  focusedId,
  onVersion,
  jobs = [],
  onTask,
  events = [],
  onRevise,
}) {
  return (
    <div className="commons-changes">
      {!prs.length && <p className="commons-empty">No pull requests.</p>}
      {prs.map((pr) => (
        <article
          className="commons-pull"
          key={pr.id}
          data-focused={focusedId === pr.id || undefined}
        >
          <h2>
            <strong>
              #{pr.number} {pr.title}
            </strong>
            <span className="commons-pull-status">{pr.status}</span>
          </h2>
          <p className="commons-meta">
            {pr.repoId} / {pr.path} · base v{pr.baseRevision} ·{" "}
            {pr.check.passed ? "Syntax passed" : "Syntax failed"} · Runtime
            untested
          </p>
          {jobs
            .filter((job) => job.id === pr.jobId)
            .map((job) => (
              <div key={job.id}>
                <button
                  className="commons-text-button"
                  onClick={() => onTask(job.id)}
                >
                  Task #{job.number}
                </button>
                <SourceMessage event={job.sourceMessage} />
              </div>
            ))}
          {pr.review && (
            <p>
              <strong>Reviewer:</strong> {pr.review.message}
            </p>
          )}
          <div className="commons-actions">
            {pr.status === "merged" ? (
              <button
                className="btn"
                onClick={() => onVersion(pr.repoId, pr.baseRevision + 1)}
              >
                View v{pr.baseRevision + 1}
              </button>
            ) : (
              <button
                className="btn"
                disabled={pending || pr.status !== "approved"}
                onClick={() => act("merge", { repoId: pr.repoId, prId: pr.id })}
              >
                Merge pull request
              </button>
            )}
            {pr.status !== "merged" && (
              <>
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    act("pull-state", {
                      repoId: pr.repoId,
                      prId: pr.id,
                      status: pr.status === "closed" ? "open" : "closed",
                    })
                  }
                >
                  {pr.status === "closed"
                    ? "Reopen pull request"
                    : "Close pull request"}
                </button>
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() => onRevise?.(pr)}
                >
                  Create revision task
                </button>
              </>
            )}
          </div>
          <div className="commons-diff" aria-label="Source changes">
            <section>
              <h3>Before</h3>
              <pre role="region" tabIndex={0} aria-label="Source before change">
                {pr.before}
              </pre>
            </section>
            <section>
              <h3>After</h3>
              <pre role="region" tabIndex={0} aria-label="Source after change">
                {pr.after}
              </pre>
            </section>
          </div>
          <p className="commons-hash">Patch SHA-256: {pr.hash}</p>
          <Comments
            events={events}
            targetType="pull"
            targetId={pr.id}
            repoId={pr.repoId}
            pending={pending}
            act={act}
          />
        </article>
      ))}
    </div>
  );
}
export function Activity({ events, pulls, onPull, onVersion }) {
  const [actor, setActor] = useState("");
  const [repo, setRepo] = useState("");
  const identities = [
    ...new Map(
      events.map((event) => [
        event.agentId || event.actor,
        event.actorName || actorNames[event.actor],
      ]),
    ).entries(),
  ];
  const repositories = [
    ...new Set(events.map((event) => event.repoId).filter(Boolean)),
  ];
  const shown = events.filter(
    (event) =>
      (!actor || (event.agentId || event.actor) === actor) &&
      (!repo || event.repoId === repo),
  );
  return (
    <>
      <div className="commons-project-filters">
        <label>
          Timeline author
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All authors</option>
            {identities.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Timeline project
          <select value={repo} onChange={(e) => setRepo(e.target.value)}>
            <option value="">All projects</option>
            {repositories.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol
        className="commons-events"
        tabIndex={0}
        aria-label="Collaboration timeline"
      >
        {!shown.length && (
          <li className="commons-empty">No matching activity.</li>
        )}
        {shown.map((event) => {
          const pr = pulls.find((p) => p.id === event.prId);
          return (
            <li key={event.id}>
              <div className="commons-byline">
                <strong>{event.actorName || actorNames[event.actor]}</strong>
                <span>{eventLabel(event, pr)}</span>
                {event.repoId && (
                  <a href={path("commons", event.repoId)}>{event.repoId}</a>
                )}
                <RecordedTime at={event.at} />
                {pr && (
                  <button
                    className="commons-text-button"
                    onClick={() => onPull(pr.id)}
                  >
                    PR #{pr.number}
                  </button>
                )}
                {pr && event.type === "merge" && (
                  <button
                    className="commons-version"
                    onClick={() => onVersion(pr.repoId, pr.baseRevision + 1)}
                  >
                    v{pr.baseRevision + 1}
                  </button>
                )}
              </div>
              <div className="commons-event-body">
                <p>{event.text}</p>
                {event.inference && (
                  <dl
                    className="commons-receipt"
                    aria-label="Inference receipt"
                  >
                    {Object.entries(event.inference).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {event.source && (
                  <p>
                    Source: {event.source.repoId}/{event.source.path}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
