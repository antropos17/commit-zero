import React from "react";

// Original Commit Zero wayfinding marks. A shared 20-unit grid keeps the
// silhouette readable at UI sizes; action/file icons remain upstream Octicons.
const marks = {
  commons: (
    <>
      <path d="M3 3h14v10H9l-4 4v-4H3Z" />
      <path d="M6 6h8M6 9h5" />
    </>
  ),
  discover: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m13 7-2 4-4 2 2-4Z" />
    </>
  ),
  timeline: (
    <>
      <path d="M5 3v14M9 5h7M9 10h5M9 15h7" />
      <circle cx="5" cy="5" r="1" />
      <circle cx="5" cy="10" r="1" />
      <circle cx="5" cy="15" r="1" />
    </>
  ),
  lab: (
    <>
      <path d="M7 3h6M8 3v5l-4 7a1.4 1.4 0 0 0 1.2 2h9.6a1.4 1.4 0 0 0 1.2-2l-4-7V3M6 12h8" />
      <path d="M9 14.5h2" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <path d="M3 8h14M11 8v9" />
    </>
  ),
  repos: (
    <>
      <path d="M5 3h11v14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 14h13M7 3v7l2-1 2 1V3" />
    </>
  ),
  pulls: (
    <>
      <circle cx="5" cy="4" r="2" />
      <circle cx="5" cy="16" r="2" />
      <circle cx="15" cy="16" r="2" />
      <path d="M5 6v8M15 14V8a4 4 0 0 0-4-4H9m2-2L9 4l2 2" />
    </>
  ),
  agents: (
    <>
      <rect x="7" y="7" width="6" height="6" rx="1" />
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="16" cy="4" r="1.5" />
      <circle cx="4" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
      <path d="m5 5 2 2m6 0 2-2M5 15l2-2m6 0 2 2" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M3 17V9h4v8m0 0V3h6v14m0 0v-6h4v6M2 17h16" />
    </>
  ),
  "my-agents": (
    <>
      <rect x="3" y="6" width="10" height="10" rx="1" />
      <path d="M6 9h4M6 13h2M10 3h7v10M14 6h3M14 10h3" />
    </>
  ),
  sandbox: (
    <>
      <path d="m10 2 7 4v8l-7 4-7-4V6ZM3 6l7 4 7-4M10 10v8M6.5 4l7 4" />
    </>
  ),
  history: (
    <>
      <path d="M3 8a7 7 0 1 1 0 5M3 3v5h5M10 6v4l3 2" />
    </>
  ),
  profile: (
    <>
      <circle cx="10" cy="6" r="3" />
      <path d="M4 17v-2a6 6 0 0 1 12 0v2Z" />
    </>
  ),
  knowledge: (
    <>
      <path d="M10 5v12M10 5C8 3 5 3 2 3v12c3 0 6 0 8 2 2-2 5-2 8-2V3c-3 0-6 0-8 2Z" />
    </>
  ),
  code: <path d="m6 5-4 5 4 5m8-10 4 5-4 5M11 3 9 17" />,
  collaboration: (
    <>
      <path d="M7 3H3v4m0-4 6 6m4 8h4v-4m0 4-6-6M13 3h4v4m0-4-6 6M7 17H3v-4m0 4 6-6" />
    </>
  ),
  issues: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  lineage: (
    <>
      <circle cx="5" cy="4" r="2" />
      <circle cx="15" cy="4" r="2" />
      <circle cx="10" cy="16" r="2" />
      <path d="M5 6v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6M10 10v4" />
    </>
  ),
  stars: (
    <path d="m10 2 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8Z" />
  ),
  conversation: <path d="M3 3h14v11H8l-5 3ZM6 7h8M6 10h5" />,
  files: (
    <>
      <path d="M5 2h7l4 4v12H5ZM12 2v5h4M8 11h5M8 14h3" />
    </>
  ),
  checks: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m6 10 3 3 5-6" />
    </>
  ),
  game: (
    <>
      <path d="M6 5h8a3 3 0 0 1 3 3l1 6a2 2 0 0 1-3 2l-3-3H8l-3 3a2 2 0 0 1-3-2l1-6a3 3 0 0 1 3-3Z" />
      <path d="M5 9h4M7 7v4" />
      <circle cx="13" cy="8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  timing: (
    <>
      <circle cx="10" cy="11" r="6" />
      <path d="M8 2h4M10 2v3m5 1 2-2M10 8v4l2 1" />
    </>
  ),
  geometry: (
    <>
      <path d="m4 15 6-11 6 11ZM4 15h12" />
      <rect x="2.5" y="13.5" width="3" height="3" fill="var(--surface)" />
      <rect x="8.5" y="2.5" width="3" height="3" fill="var(--surface)" />
      <rect x="14.5" y="13.5" width="3" height="3" fill="var(--surface)" />
    </>
  ),
  canvas: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <path d="M3 13 8 8l4 4 2-2 3 3" />
      <circle cx="13" cy="6" r="1" />
    </>
  ),
  "one-button": (
    <>
      <rect x="4" y="4" width="12" height="12" rx="4" />
      <circle cx="10" cy="10" r="2" />
    </>
  ),
};
const aliases = {
  home: "overview",
  projects: "repos",
  changes: "pulls",
  memory: "knowledge",
  overall: "leaderboard",
  forks: "lineage",
  library: "knowledge",
};

export function CategoryMark({ name }) {
  const key = Object.hasOwn(aliases, name) ? aliases[name] : name;
  if (!Object.hasOwn(marks, key)) return null;
  const drawing = marks[key];
  return (
    <svg
      className="category-mark"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
}
