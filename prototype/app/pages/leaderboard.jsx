import React, { useLayoutEffect, useRef, useState } from "react";
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
  const refreshControl = useRef(null),
    retryOrigin = useRef(null);
  useLayoutEffect(() => {
    if (ranking.loading) return;
    const origin = retryOrigin.current;
    retryOrigin.current = null;
    if (origin && document.activeElement === document.body)
      (origin.isConnected ? origin : refreshControl.current)?.focus({
        preventScroll: true,
      });
  }, [ranking.loading, ranking.data, ranking.error]);
  function refreshRanking(event) {
    if (ranking.loading) return;
    retryOrigin.current = event.currentTarget;
    ranking.retry();
  }
  const candidate = ranking.data;
  const snapshot =
    candidate?.runId === data.runId &&
    candidate?.version === data.version &&
    candidate?.category === category &&
    Array.isArray(candidate.rows) &&
    candidate.rows.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        typeof row.provider === "string" &&
        Number.isFinite(row.score),
    )
      ? candidate
      : null;
  const error =
    ranking.error ||
    (candidate && !snapshot
      ? "Ranking data could not be matched to this scenario and category. Refresh the workspace and try again."
      : "");
  const rows =
    snapshot?.rows.filter((r) =>
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
              ref={refreshControl}
              aria-controls="contribution-rankings"
              onClick={refreshRanking}
              disabled={ranking.loading}
            >
              Refresh
            </button>
          </div>
          <div className="ranking-note">
            <span className="pill">Current simulation</span>
            <span>
              Step {snapshot?.step ?? data.step} / 10 · {data.agents.length}{" "}
              agents
            </span>
          </div>
          {error && <ErrorMessage message={error} retry={refreshRanking} />}
          {snapshot && (ranking.loading || error) && (
            <p className="small muted" role="status">
              {ranking.loading
                ? "Refreshing rankings. Showing the last available rankings."
                : "Showing the last available rankings."}
            </p>
          )}
          <div
            id="contribution-rankings"
            className="ranking-table-wrap"
            role="region"
            aria-label="Agent contribution rankings"
            aria-busy={ranking.loading}
            tabIndex="0"
          >
            <table className="ranking-table">
              <caption className="sr">
                {category} contribution ranking for the current saved scenario
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
                        : error
                          ? "Rankings unavailable."
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
              {snapshot?.scoring?.code ||
                "10 per repository + 20 per merged authored PR + 8 per passed authored PR"}
            </dd>
            <dt>Collaboration</dt>
            <dd>
              {snapshot?.scoring?.collaboration ||
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
