import React from "react";
import { path } from "../router.mjs";
import { ProjectMark } from "./project-mark.jsx";
import { commonsPullPath } from "../../../shared/contributions.mjs";

export function Contributions({
  created,
  improved,
  accepted,
  projects,
  jobs,
  simulated = false,
}) {
  const projectPath = (project) =>
    path(simulated ? "repo" : "commons", project.id);
  const pullPath = (pull) =>
    simulated
      ? path("pr", pull.id, "files")
      : commonsPullPath(pull.repoId, pull.id);
  const repoId = (pull) => (simulated ? pull.repo : pull.repoId);
  function change(pull) {
    const project = projects.find((item) => item.id === repoId(pull));
    return (
      <li key={pull.id}>
        <ProjectMark repo={project} jobs={jobs} />
        <div className="contribution-detail">
          <a className="contribution-title" href={pullPath(pull)}>
            {pull.title}
          </a>
          <div className="contribution-meta">
            <a href={projectPath(project)}>{project.name}</a>
            <span>#{simulated ? pull.id : pull.number} · merged</span>
            {pull.path && <code>{pull.path}</code>}
          </div>
        </div>
        <div className="contribution-links">
          <a href={pullPath(pull)}>View diff</a>
          {!simulated && (
            <a
              href={`${projectPath(project)}?view=versions&version=${pull.baseRevision + 1}`}
            >
              v{pull.baseRevision} → v{pull.baseRevision + 1}
            </a>
          )}
        </div>
      </li>
    );
  }
  return (
    <div className="contributions" aria-label="Contribution overview">
      <section aria-label="Created projects">
        <h2>
          Created projects <span className="count">{created.length}</span>
        </h2>
        {created.length ? (
          <ul className="contribution-list" tabIndex={0}>
            {created.map(({ project, pull }) => (
              <li key={project.id}>
                <ProjectMark repo={project} jobs={jobs} />
                <div className="contribution-detail">
                  <a className="contribution-title" href={projectPath(project)}>
                    {project.name}
                  </a>
                  <p>{project.description || project.desc}</p>
                  <span className="commons-meta">
                    {pull
                      ? `Initial implementation · PR #${pull.number}`
                      : "Scenario project · creation diff not recorded"}
                  </span>
                </div>
                <div className="contribution-links">
                  {pull ? (
                    <>
                      <a href={pullPath(pull)}>View first diff</a>
                      <a
                        href={`${projectPath(project)}?view=versions&version=1`}
                      >
                        v1
                      </a>
                    </>
                  ) : (
                    <a href={projectPath(project)}>View source</a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No initial implementation merged yet.</p>
        )}
      </section>
      <section aria-label="Improved projects">
        <h2>
          Improved other projects{" "}
          <span className="count">{new Set(improved.map(repoId)).size}</span>
        </h2>
        {improved.length ? (
          <ul className="contribution-list" tabIndex={0}>
            {improved.map(change)}
          </ul>
        ) : (
          <p className="muted">No changes merged into other projects yet.</p>
        )}
      </section>
      <section aria-label="Accepted pull requests">
        <h2>
          Accepted PRs <span className="count">{accepted.length}</span>
        </h2>
        {accepted.length ? (
          <ul className="contribution-list" tabIndex={0}>
            {accepted.map(change)}
          </ul>
        ) : (
          <p className="muted">No merged pull requests yet.</p>
        )}
      </section>
    </div>
  );
}
