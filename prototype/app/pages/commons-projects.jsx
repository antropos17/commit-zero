import React, { useState } from "react";
import { ProjectMark, projectKind } from "../components/project-mark.jsx";
import { RecordedTime } from "./commons-panels.jsx";

export function ProjectForm({ source, pending, act }) {
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [kind, setKind] = useState(source?.kind || "library");
  return (
    <section
      className="commons-start"
      aria-label={source ? "Fork project" : "New project"}
    >
      <h2>{source ? `Fork ${source.name}` : "New project"}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(
            "projects",
            { id, name, description, kind, sourceRepoId: source?.id || "" },
            () => {
              location.hash = `/commons/${id}`;
            },
          );
        }}
      >
        <label>
          Project address
          <input
            required
            pattern="[a-z][a-z0-9-]{1,47}"
            maxLength={48}
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="my-project"
          />
        </label>
        <label>
          Project name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            required
            maxLength={600}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Project type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="library">Library</option>
            <option value="game">Game</option>
          </select>
        </label>
        <button className="btn" disabled={pending}>
          {source ? "Create independent fork" : "Create project"}
        </button>
        <p className="commons-meta">
          {source
            ? `Copies current files at v${source.revision}; retains their source hash.`
            : "Starts with a README and an empty JavaScript module. Run an agent task to implement it."}
        </p>
      </form>
    </section>
  );
}
export function Projects({ projects, jobs }) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all");
  const shown = projects.filter(
    (p) =>
      `${p.name} ${p.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (kind === "all" || projectKind(p).toLowerCase() === kind),
  );
  return (
    <>
      <div className="commons-project-filters">
        <label>
          Find a project
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All projects</option>
            <option value="game">Games</option>
            <option value="library">Libraries</option>
          </select>
        </label>
      </div>
      <ul className="commons-project-list" aria-label="Workspace projects">
        {shown.map((p) => (
          <li key={p.id}>
            <ProjectMark repo={p} jobs={jobs} />
            <div>
              <a href={`#/commons/${p.id}`}>{p.name}</a>
              <p>{p.description || "Collaboration copy"}</p>
              <span className="commons-meta">
                {projectKind(p)} · v{p.revision} · {p.stars.length} stars
                {p.archived ? " · Archived" : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {!shown.length && <p>No projects match these filters.</p>}
    </>
  );
}
export function Comments({
  events,
  targetType,
  targetId,
  repoId,
  pending,
  act,
  disabled = false,
}) {
  const [message, setMessage] = useState("");
  const comments = events.filter(
    (event) =>
      event.type === "comment" &&
      (targetType === "issue" ? event.issueId : event.prId) === targetId,
  );
  return (
    <section
      className="commons-thread"
      aria-label={`${targetType === "issue" ? "Issue" : "Pull request"} discussion`}
    >
      {comments.map((comment) => (
        <article key={comment.id}>
          <strong>{comment.actorName || "Local operator"}</strong>{" "}
          <RecordedTime at={comment.at} />
          <p>{comment.text}</p>
        </article>
      ))}
      <form
        className="commons-compose"
        onSubmit={(e) => {
          e.preventDefault();
          act("comments", { repoId, targetType, targetId, message }, () =>
            setMessage(""),
          );
        }}
      >
        <label>
          Comment
          <textarea
            rows={2}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <button
          className="btn"
          disabled={disabled || pending || !message.trim()}
        >
          Add comment
        </button>
      </form>
    </section>
  );
}
export function Issues({ project, events, jobs, pending, act, onTask }) {
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [filter, setFilter] = useState("open");
  const issues = (project.issues || []).filter(
    (issue) => filter === "all" || issue.status === filter,
  );
  return (
    <div className="commons-issues">
      <label>
        Issue status
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All issues</option>
        </select>
      </label>
      {!issues.length && (
        <p className="commons-empty">
          No {filter === "all" ? "" : filter} issues.
        </p>
      )}
      {issues.map((issue) => (
        <article className="commons-pull" key={issue.id}>
          <h2>
            #{issue.number} {issue.title}{" "}
            <span className="commons-meta">{issue.status}</span>
          </h2>
          <p>{issue.description}</p>
          <RecordedTime at={issue.createdAt} />
          <div className="commons-actions">
            <button
              className="btn"
              disabled={pending || project.archived}
              onClick={() =>
                act("issue-state", {
                  repoId: project.id,
                  issueId: issue.id,
                  status: issue.status === "open" ? "closed" : "open",
                })
              }
            >
              {issue.status === "open" ? "Close issue" : "Reopen issue"}
            </button>
            <button
              className="btn"
              disabled={project.archived || issue.status !== "open"}
              onClick={() => onTask(issue)}
            >
              Create task from issue
            </button>
          </div>
          {jobs
            .filter((job) => job.issueId === issue.id)
            .map((job) => (
              <p className="commons-meta" key={job.id}>
                Task #{job.number}: {job.phase} · {job.outcome}
              </p>
            ))}
          <Comments
            events={events}
            targetType="issue"
            targetId={issue.id}
            repoId={project.id}
            pending={pending}
            act={act}
            disabled={project.archived}
          />
        </article>
      ))}
      <section className="commons-start">
        <h2>New issue</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act("issues", { repoId: project.id, title, description }, () => {
              setTitle("");
              setDescription("");
              setFilter("open");
            });
          }}
        >
          <label>
            Issue title
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Problem and expected behavior
            <textarea
              required
              rows={4}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            className="btn"
            disabled={
              pending ||
              project.archived ||
              !title.trim() ||
              !description.trim()
            }
          >
            Open issue
          </button>
        </form>
      </section>
    </div>
  );
}
