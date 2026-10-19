import React from "react";
import { useWorkspace } from "../hooks.mjs";
import { path } from "../router.mjs";

// Original project identities, drawn on a 32-unit grid. Filled game silhouettes
// and open library geometry stay recognizable without color or a badge frame.
const marks = {
  orbit: (
    <>
      <path
        d="M16 5a11 11 0 1 0 11 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle cx="24" cy="8" r="4" />
      <circle cx="16" cy="16" r="2.5" />
    </>
  ),
  "vector-kit": (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 7 10 18L26 7M6 7h20" />
      <path d="M3 4h6v6H3ZM23 4h6v6h-6ZM13 22h6v6h-6Z" fill="var(--surface)" />
    </g>
  ),
  tower: <path d="M11 3h11v6H11ZM7 12h16v6H7ZM4 21h24v7H4Z" />,
  "safe-timer": (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter">
      <path d="M12 4H4v24h24V4h-8M12 2h8M16 2v6M16 11v7h7" />
      <path d="m8 22 3 3 4-4" />
    </g>
  ),
  reaction: <path d="M3 14h6l5-11h4v15l3-4h8v4h-6l-5 11h-4V14l-3 4H3Z" />,
  "orbit-lab": (
    <>
      <path
        d="M15 5A11 11 0 1 0 27 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M21 3h8v8h-8ZM8 17h6v-6h4v10H8Z" />
    </>
  ),
  "orbital-garden": (
    <>
      <path d="M16 19C8 19 4 15 4 8c8 0 12 4 12 11ZM16 12c0-6 4-9 12-9 0 6-4 9-12 9Z" />
      <path d="M16 12v16" fill="none" stroke="currentColor" strokeWidth="3" />
    </>
  ),
};

export function projectKind(repo) {
  if (
    repo.game ||
    repo.kind === "game" ||
    ["orbit", "tower", "reaction", "orbit-lab", "orbital-garden"].includes(
      repo.id,
    )
  )
    return "Game";
  return repo.kind === "library" ||
    repo.topics?.includes("library") ||
    ["safe-timer", "vector-kit"].includes(repo.id)
    ? "Library"
    : "Project";
}

export function ProjectKind({ repo }) {
  return (
    <span className="project-kind">
      {projectKind(repo)}
      {repo.forkOf ? " · Fork" : ""}
    </span>
  );
}

export function ProjectMark({ repo, jobs = [] }) {
  const workspace = useWorkspace();
  // Only the first accepted implementation of a new, empty project establishes
  // its model author. Later reviewers/contributors never replace that identity.
  const initialPull =
    repo.createdAt && !repo.origin
      ? repo.prs?.find(
          (pull) => pull.status === "merged" && pull.baseRevision === 0,
        )
      : null;
  const job = initialPull && jobs.find((item) => item.id === initialPull.jobId);
  const scenarioRepo = !repo.createdAt
    ? workspace?.data?.repos.find((item) => item.id === repo.id)
    : null;
  const agent =
    scenarioRepo &&
    workspace?.data?.agents.find((item) => item.id === scenarioRepo.owner);
  const author =
    job?.provenance === "local_model"
      ? {
          label: `First implementation: ${job.model} · Local model`,
          logo: null,
          href: path("model", job.model),
        }
      : agent
        ? {
            label: `Scenario creator: ${agent.name} · Simulated`,
            logo: agent.logo,
            href: path("agent", agent.id),
          }
        : null;
  const drawing = Object.hasOwn(marks, repo.id) ? marks[repo.id] : null;
  return (
    <span className="project-mark">
      <svg
        className="project-symbol"
        viewBox="0 0 32 32"
        width="32"
        height="32"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        {drawing || (
          <text
            x="16"
            y="23"
            textAnchor="middle"
            fontSize="20"
            fontWeight="600"
          >
            {(repo.name || "?").slice(0, 2).toUpperCase()}
          </text>
        )}
      </svg>
      {author && (
        <a
          className="project-model-mark"
          href={author.href}
          aria-label={`Open model profile: ${author.label}`}
          title={author.label}
        >
          {author.logo ? (
            <img
              src={`assets/${author.logo}.svg`}
              width="16"
              height="16"
              alt=""
            />
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
        </a>
      )}
    </span>
  );
}
