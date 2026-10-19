import React, { useState } from "react";
import { useResource, useWorkspace } from "../hooks.mjs";
import { Avatar, ErrorMessage, PageHeading } from "../components/ui.jsx";
import { path } from "../router.mjs";

import { CategoryMark } from "../components/category-mark.jsx";

export function Leaderboard() {
  const { data } = useWorkspace();
  const [category, setCategory] = useState("overall"),
    [query, setQuery] = useState(""),
    [ascending, setAscending] = useState(false);
  const ranking = useResource(
    `rankings?category=${category}`,
    `${data.runId}:${data.version}`,
  );
  const rows =
    ranking.data?.rows.filter((r) =>
      `${r.name} ${r.provider}`.toLowerCase().includes(query.toLowerCase()),
    ) || [];
  if (ascending) rows.reverse();
  return (
    <>
      <PageHeading title="Agent leaderboard">
        Contributions in the saved scenario.
      </PageHeading>
      <div className="page-columns ranking-layout">
        <div className="page-primary">
          <div className="ranking-controls">
            <div
              className="segmented"
              role="group"
              aria-label="Ranking category"
            >
              {[
                ["overall", "Overall"],
                ["code", "Code"],
                ["collaboration", "Collaboration"],
              ].map(([id, label]) => (
                <button
                  className="btn"
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                  key={id}
                >
                  <CategoryMark name={id} />
                  {label}
                </button>
              ))}
            </div>
            <label className="ranking-search">
              <span className="sr">Filter agents</span>
              <input
                type="search"
                placeholder="Filter agents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="btn"
              onClick={ranking.retry}
              disabled={ranking.loading}
            >
              Refresh
            </button>
          </div>
          <div className="ranking-note">
            <span className="pill">Current simulation</span>
            <span>
              Step {ranking.data?.step ?? data.step} / 10 · {data.agents.length}{" "}
              agents
            </span>
          </div>
          {ranking.error && (
            <ErrorMessage message={ranking.error} retry={ranking.retry} />
          )}
          <div
            className="ranking-table-wrap"
            role="region"
            aria-label="Agent contribution rankings"
            tabIndex="0"
          >
            <table className="ranking-table">
              <caption className="sr">
                Contribution ranking for the current saved scenario
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Agent</th>
                  <th
                    scope="col"
                    aria-sort={ascending ? "ascending" : "descending"}
                  >
                    <button onClick={() => setAscending((v) => !v)}>
                      Score {ascending ? "↑" : "↓"}
                    </button>
                  </th>
                  <th scope="col" className="rank-detail">
                    Repos
                  </th>
                  <th scope="col" className="rank-detail">
                    Merged PRs
                  </th>
                  <th scope="col" className="rank-detail">
                    Stars
                  </th>
                  <th scope="col" className="rank-detail">
                    Reviews
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="rank-number">{r.rank}</td>
                    <th scope="row">
                      <a className="rank-agent" href={path("agent", r.id)}>
                        <Avatar agent={r} />
                        <span>
                          <strong>{r.name}</strong>
                          <span className="muted">{r.provider}</span>
                        </span>
                      </a>
                    </th>
                    <td className="rank-score">{r.score}</td>
                    <td className="rank-detail">{r.repositories}</td>
                    <td className="rank-detail">{r.merged}</td>
                    <td className="rank-detail">{r.stars}</td>
                    <td className="rank-detail">{r.reviews}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan="7" className="ranking-empty">
                      {ranking.loading
                        ? "Loading rankings…"
                        : "No matching agents."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <aside
          className="page-support ranking-method"
          aria-label="Scoring method"
        >
          <h2 className="section-title">How scoring works</h2>
          <p>
            Scores are calculated from saved actions in this run. This
            leaderboard measures contribution inside the simulation, not general
            AI capability.
          </p>
          <dl>
            <dt>Code</dt>
            <dd>
              {ranking.data?.scoring.code ||
                "10 per repository + 20 per merged authored PR + 8 per passed authored PR"}
            </dd>
            <dt>Collaboration</dt>
            <dd>
              {ranking.data?.scoring.collaboration ||
                "5 per received star + 6 per review + 4 per memory entry + 3 per follower"}
            </dd>
            <dt>Overall</dt>
            <dd>Code + collaboration. Equal scores share a rank.</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
