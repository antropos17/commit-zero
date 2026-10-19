import React from "react";
import { useWorkspace } from "../hooks.mjs";
import { path } from "../router.mjs";
import {
  commonsPullPath,
  projectContributions,
} from "../../../shared/contributions.mjs";

export function Contributor({ model, agent }) {
  if (!model && !agent)
    return <span className="muted">Author not verified</span>;
  return (
    <a
      className="contributor-link"
      href={path(agent ? "agent" : "model", agent?.id || model)}
      title={agent ? "Simulated account" : "Recorded local model"}
    >
      {agent ? (
        <img src={`assets/${agent.logo}.svg`} width="20" height="20" alt="" />
      ) : (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="4" y="4" width="8" height="8" rx="1" />
          <path d="M6 1v3m4-3v3M6 12v3m4-3v3M1 6h3m-3 4h3m8-4h3m-3 4h3" />
        </svg>
      )}
      <span>{agent?.name || model}</span>
    </a>
  );
}

export function ProjectContributions({
  project,
  jobs = [],
  pulls = [],
  simulated = false,
}) {
  const { data } = useWorkspace();
  const owner = data.agents.find((agent) => agent.id === project.owner);
  const seed =
    !project.createdAt && data.repos.find((repo) => repo.id === project.id);
  const seedOwner =
    seed && data.agents.find((agent) => agent.id === seed.owner);
  const contribution = simulated
    ? {
        initial: null,
        accepted: pulls
          .filter((pull) => pull.status === "merged")
          .map((pull) => ({
            pull,
            agent: data.agents.find((a) => a.id === pull.author),
          })),
        proposed: pulls
          .filter((pull) => pull.status !== "merged")
          .map((pull) => ({
            pull,
            agent: data.agents.find((a) => a.id === pull.author),
          })),
      }
    : projectContributions(project, jobs);
  const diff = (pull) =>
    simulated
      ? path("pr", pull.id, "files")
      : commonsPullPath(project.id, pull.id);
  const groups = new Map();
  for (const change of contribution.accepted) {
    const key = JSON.stringify([
      change.agent?.id || null,
      change.model || null,
    ]);
    if (!groups.has(key)) groups.set(key, { ...change, changes: [] });
    groups.get(key).changes.push(change.pull);
  }
  return (
    <section
      className="project-contributions"
      aria-label="Project model contributions"
    >
      <h2>Model contributions</h2>
      <div className="project-creator">
        {simulated ? (
          <>
            <span>{project.forkOf ? "Fork owner" : "Created by"}</span>
            <Contributor agent={owner} />
            <span className="commons-meta">
              Scenario · creation diff not recorded
            </span>
          </>
        ) : project.origin ? (
          <>
            <span>Forked from</span>
            <a href={path("commons", project.origin.repoId)}>
              {project.origin.repoId}
            </a>
            <span className="commons-meta">
              v{project.origin.revision} · copied source
            </span>
          </>
        ) : contribution.initial ? (
          <>
            <span>First implementation</span>
            <Contributor model={contribution.initial.model} />
            <a href={diff(contribution.initial.pull)}>View first diff</a>
          </>
        ) : seedOwner ? (
          <>
            <span>Seeded source</span>
            <Contributor agent={seedOwner} />
            <span className="commons-meta">Simulated author</span>
          </>
        ) : (
          <span className="muted">No model implementation merged yet.</span>
        )}
      </div>
      <h3>
        Accepted changes{" "}
        <span className="count">{contribution.accepted.length}</span>
      </h3>
      {!groups.size && <p className="muted">No accepted PRs yet.</p>}
      {[...groups].map(([key, group]) => (
        <div className="project-contributor" key={key}>
          <div className="project-contributor-heading">
            <Contributor model={group.model} agent={group.agent} />
            <span className="commons-meta">
              {group.changes.length} merged{" "}
              {group.changes.length === 1 ? "PR" : "PRs"}
            </span>
          </div>
          <ul className="project-change-list">
            {group.changes.map((pull) => (
              <li key={pull.id}>
                <div>
                  <a href={diff(pull)}>
                    #{simulated ? pull.id : pull.number} · {pull.title}
                  </a>
                  {pull.path && <code>{pull.path}</code>}
                </div>
                {!simulated && (
                  <a
                    className="project-change-version"
                    href={`${path("commons", project.id)}?view=versions&version=${pull.baseRevision + 1}`}
                  >
                    v{pull.baseRevision} → v{pull.baseRevision + 1}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {contribution.proposed.length > 0 && (
        <>
          <h3>
            Not merged{" "}
            <span className="count">{contribution.proposed.length}</span>
          </h3>
          <ul className="project-proposal-list">
            {contribution.proposed.map(({ pull, model, agent }) => (
              <li key={pull.id}>
                <Contributor model={model} agent={agent} />
                <a href={diff(pull)}>
                  #{simulated ? pull.id : pull.number} · {pull.title}
                </a>
                <span className="commons-meta">{pull.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {simulated && (
        <p className="commons-meta">Scenario contributions · no model calls.</p>
      )}
    </section>
  );
}
