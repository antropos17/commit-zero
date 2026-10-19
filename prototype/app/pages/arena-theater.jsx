import React, { useEffect, useId, useState } from "react";
import { request } from "../api.mjs";
import { liveMatch, frameAt } from "../arena-spectator.mjs";

function RuleCycle({ game, phase }) {
  const marker = useId().replaceAll(":", "");
  const points = [
      [160, 38],
      [274, 172],
      [46, 172],
    ],
    matrix = game.payoffs[phase];
  return (
    <div className="spectator-rules">
      <h3>Phase {phase + 1} · active counters</h3>
      <svg
        viewBox="0 0 320 215"
        role="img"
        aria-label={`Phase ${phase + 1} counter rules for ${game.name}`}
      >
        <defs>
          <marker
            id={marker}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
          </marker>
        </defs>
        {[0, 1, 2].flatMap((a) =>
          [0, 1, 2]
            .filter((b) => matrix[a * 3 + b] > 0)
            .map((b) => {
              const [x, y] = points[a],
                [xx, yy] = points[b],
                dx = xx - x,
                dy = yy - y;
              return (
                <g key={`${a}-${b}`}>
                  <path
                    d={`M${x + dx * 0.22} ${y + dy * 0.22} L${x + dx * 0.78} ${y + dy * 0.78}`}
                    stroke="currentColor"
                    fill="none"
                    markerEnd={`url(#${marker})`}
                  />
                  <text
                    x={
                      (x + xx) / 2 +
                      (a === 0 || b === 0 ? (x + xx > 320 ? 12 : -12) : 0)
                    }
                    y={(y + yy) / 2 - 8}
                    textAnchor="middle"
                  >
                    +{matrix[a * 3 + b]}
                  </text>
                </g>
              );
            }),
        )}
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="21" />
            <text
              className="spectator-node-label"
              x={x}
              y={y + 5}
              textAnchor="middle"
            >
              {["A", "B", "C"][i]}
            </text>
          </g>
        ))}
      </svg>
      <div className="spectator-legend">
        {game.actions.map((a, i) => (
          <span key={a}>
            <b>{["A", "B", "C"][i]}</b> {a} <small>cost {game.costs[i]}</small>
          </span>
        ))}
      </div>
      <p className="muted">
        Arrows point to the action beaten. Rules switch every {game.phaseLength}{" "}
        rounds.
      </p>
    </div>
  );
}
function Competitor({ match, frame, side }) {
  const game = match.gameRules,
    r = frame.round,
    chosen = r?.actions[side];
  return (
    <div className={`spectator-agent spectator-side-${side}`}>
      <div className="spectator-identity">
        <span aria-hidden="true">{match.players[side] + 1}</span>
        <div>
          <h3>Strategist {match.players[side] + 1}</h3>
          <p>{match.strategyNames?.[side] || match.strategies?.[side]?.name}</p>
        </div>
      </div>
      {r?.selections?.[side] && (
        <p className="spectator-caption">
          <strong>
            {r.selections[side].index
              ? `Specialist ${r.selections[side].index}`
              : "Baseline"}
          </strong>
          {" · "}
          {r.selections[side].name}
          <br />
          {r.selections[side].reason}
        </p>
      )}
      <div className="spectator-choice">
        <span
          className="spectator-action-token"
          data-action={chosen ?? "none"}
          aria-hidden="true"
        >
          {chosen === undefined ? "—" : ["A", "B", "C"][chosen]}
        </span>
        <strong>{chosen === undefined ? "Ready" : game.actions[chosen]}</strong>
        <span>
          {r
            ? `${(r.probabilities[side][chosen] * 100).toFixed(1)}% action probability`
            : "Waiting for simultaneous reveal"}
        </span>
      </div>
      <div className="spectator-energy">
        <div>
          <strong>Energy</strong>
          <span>
            {frame.energy[side]} / {game.energyCap}
          </span>
        </div>
        <div
          className="spectator-cells"
          role="meter"
          aria-label={`Strategist ${match.players[side] + 1} energy`}
          aria-valuemin={0}
          aria-valuemax={game.energyCap}
          aria-valuenow={frame.energy[side]}
        >
          {Array.from({ length: game.energyCap }, (_, i) => (
            <span key={i} data-filled={i < frame.energy[side]} />
          ))}
        </div>
        <p>
          {r
            ? `${r.before[side]} − ${game.costs[chosen]} cost + ${game.recharge} recharge (cap ${game.energyCap})`
            : "Full starting energy"}
        </p>
      </div>
      <div className="spectator-actions">
        {game.actions.map((a, i) => (
          <div key={a} className={chosen === i ? "is-chosen" : ""}>
            <b>{["A", "B", "C"][i]}</b>
            <span>{a}</span>
            <small>
              {r
                ? `${Math.round(r.probabilities[side][i] * 100)}%`
                : `${game.costs[i]} energy`}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ArenaTheater({ run, connectionError }) {
  const matches = run.events.filter(
    (e) => e.kind === "match" && e.data.artifact?.startsWith("arena-match-"),
  );
  const broadcast = liveMatch(run);
  const [mode, setMode] = useState(
      run.status === "running" ? "live" : "replay",
    ),
    [selection, setSelection] = useState(""),
    [recording, setRecording] = useState(null),
    [frozen, setFrozen] = useState(null),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const selected = selection || matches[0]?.data.artifact;
  useEffect(() => {
    if (mode !== "replay" || !selected) return;
    const controller = new AbortController();
    setRecording(null);
    setError("");
    setStep(0);
    setPlaying(false);
    request(`lab/runs/${run.id}/artifacts/${selected}`, {
      signal: controller.signal,
    })
      .then((item) => {
        if (!controller.signal.aborted) setRecording(item.content);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [mode, selected, run.id]);
  useEffect(() => {
    if (
      !playing ||
      mode !== "replay" ||
      !recording ||
      step >= recording.rounds.length
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden)
        setStep((s) => Math.min(recording.rounds.length, s + 1));
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, mode, recording, speed, step]);
  const match = mode === "live" ? frozen || broadcast : recording;
  const shown = mode === "live" ? match?.rounds.length || 0 : step;
  const frame = match ? frameAt(match, shown) : null;
  const finished = match && shown === 24;
  const status =
    mode === "replay"
      ? matches.length
        ? "Recorded match"
        : "No recordings"
      : frozen
        ? run.status === "running"
          ? "View paused · server continues"
          : `View paused · run ${run.status}`
        : connectionError
          ? "Updates unavailable"
          : run.status !== "running"
            ? `Broadcast ended · ${run.status}`
            : !broadcast || broadcast.complete
              ? "Between live matches"
              : "Live · server execution";
  function seek(n) {
    setPlaying(false);
    setStep(n);
  }
  return (
    <section
      className="arena-theater"
      aria-label="Visual arena"
      data-motion={(mode === "live" && !frozen) || (playing && !finished)}
    >
      <header className="spectator-heading">
        <div>
          <h2>Visual arena</h2>
          <p className="spectator-status" role="status">
            {status}
          </p>
        </div>
        <div className="spectator-modes">
          <button
            className="btn"
            aria-pressed={mode === "live"}
            onClick={() => {
              setMode("live");
              setFrozen(null);
              setPlaying(false);
            }}
          >
            Follow live
          </button>
          {mode === "live" && broadcast && (
            <button
              className="btn"
              onClick={() => setFrozen((f) => (f ? null : broadcast))}
            >
              {frozen ? "Resume live" : "Freeze view"}
            </button>
          )}
          <button
            className="btn"
            aria-pressed={mode === "replay"}
            disabled={!matches.length}
            onClick={() => setMode("replay")}
          >
            Recordings ({matches.length})
          </button>
        </div>
      </header>
      {mode === "live" &&
        run.status === "running" &&
        (!broadcast || broadcast.complete) && (
          <p className="spectator-caption">
            <strong>{run.events.at(-1)?.actor}</strong> ·{" "}
            {run.events.at(-1)?.message}
          </p>
        )}
      {mode === "replay" && matches.length > 0 && (
        <label className="spectator-match-picker">
          Match
          <select
            aria-label="Arena match"
            value={selected || ""}
            onChange={(e) => setSelection(e.target.value)}
          >
            {matches.map((e, i) => (
              <option key={e.data.artifact} value={e.data.artifact}>
                {e.data.artifact.startsWith("arena-match-trial-")
                  ? "Selector trial"
                  : `G${e.data.generation}`}{" "}
                · {e.data.game || e.message.split(":")[0]} ·{" "}
                {e.data.players
                  ? e.data.players.map((p) => `Agent ${p + 1}`).join(" vs ")
                  : "Recorded"}{" "}
                · #{i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {!match ? (
        <div className="spectator-empty">
          <h3>
            {mode === "live"
              ? run.status === "running"
                ? "Waiting for the arena"
                : "No active broadcast"
              : matches.length
                ? "Loading recorded match…"
                : "No recorded matches"}
          </h3>
          <p>
            {mode === "live"
              ? run.events.at(-1)?.message
              : matches.length
                ? "Fetching the original server trace."
                : "This run has no saved match. Inspect its timeline for the outcome."}
          </p>
          <p className="muted">
            Featured matches reveal both actions together. The remaining
            tournament matches run at full speed and are available as
            recordings.
          </p>
        </div>
      ) : (
        <>
          <div className="spectator-score">
            <div>
              <span>Agent {match.players[0] + 1}</span>
              <strong>
                {frame.score > 0 ? "+" : ""}
                {frame.score}
              </strong>
            </div>
            <div>
              <h3>{match.game}</h3>
              <p>
                {match.trial
                  ? "Selector trial · outside tournament"
                  : `Generation ${match.generation}`}{" "}
                · round {shown} / 24
              </p>
              <span className="spectator-phase">
                Phase {frame.phase + 1}
                {shown > 1 && match.rounds[shown - 2]?.phase !== frame.phase
                  ? " · rules changed"
                  : ""}
              </span>
            </div>
            <div>
              <span>Agent {match.players[1] + 1}</span>
              <strong>
                {-frame.score > 0 ? "+" : ""}
                {-frame.score || 0}
              </strong>
            </div>
          </div>
          <div className="spectator-court">
            <Competitor match={match} frame={frame} side={0} />
            <RuleCycle game={match.gameRules} phase={frame.phase} />
            <Competitor match={match} frame={frame} side={1} />
          </div>
          <div
            className="spectator-outcome"
            aria-live={playing ? "off" : "polite"}
          >
            {finished ? (
              <strong>
                {frame.score === 0
                  ? "Match drawn"
                  : `Strategist ${match.players[frame.score > 0 ? 0 : 1] + 1} wins`}{" "}
                · final net score {frame.score}
              </strong>
            ) : (
              <strong>
                {frame.round
                  ? frame.round.payoff === 0
                    ? "Both actions resolve to a tie"
                    : `Strategist ${match.players[frame.round.payoff > 0 ? 0 : 1] + 1} gains ${Math.abs(frame.round.payoff)} points`
                  : "Both strategies choose from the same pre-round state"}
              </strong>
            )}
          </div>
          <div className="spectator-rounds" aria-label="Executed rounds">
            {Array.from({ length: 24 }, (_, i) => {
              const r = match.rounds[i];
              return (
                <button
                  key={i}
                  className={
                    r
                      ? `round-${r.payoff > 0 ? "left" : r.payoff < 0 ? "right" : "draw"}`
                      : ""
                  }
                  aria-label={`Round ${i + 1}${r ? `: ${match.gameRules.actions[r.actions[0]]} vs ${match.gameRules.actions[r.actions[1]]}` : ""}`}
                  aria-current={shown === i + 1 ? "step" : undefined}
                  disabled={!r || mode === "live"}
                  onClick={() => seek(i + 1)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          {mode === "replay" ? (
            <div className="spectator-controls">
              <button
                className="btn primary"
                disabled={!recording}
                onClick={() => {
                  if (finished) setStep(0);
                  setPlaying((p) => !p || finished);
                }}
              >
                {playing && !finished ? "Pause" : "Play recording"}
              </button>
              <button
                className="btn"
                disabled={!step}
                onClick={() => seek(step - 1)}
              >
                Previous
              </button>
              <button
                className="btn"
                disabled={finished}
                onClick={() => seek(step + 1)}
              >
                Next
              </button>
              <label>
                Speed
                <select
                  aria-label="Playback speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[0.5, 1, 2].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="spectator-scrubber">
                Round {step}
                <input
                  type="range"
                  aria-label="Visual arena round"
                  min="0"
                  max="24"
                  value={step}
                  onChange={(e) => seek(Number(e.target.value))}
                />
              </label>
            </div>
          ) : (
            <p className="muted">
              {connectionError
                ? "Connection lost; showing the last received state."
                : run.status === "running"
                  ? "Following persisted rounds; updates arrive every second."
                  : `This run is ${run.status}. Start or continue an experiment for a live broadcast.`}
            </p>
          )}
          <p className="spectator-caption">
            {mode === "replay"
              ? "Playback of an executed match. Controls change only the view."
              : "One featured match per game and generation is executed round by round."}{" "}
            Signed scores are net points; energy is shown after cost and
            recharge.
          </p>
        </>
      )}
    </section>
  );
}
