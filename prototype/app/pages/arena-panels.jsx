import React, { useState } from "react";
const percent = (n) => `${(n * 100).toFixed(1)}%`;
export function ArenaRules({ game }) {
  return (
    <section className="arena-rules">
      <h3 className="section-title">
        {game.name} · {game.phaseLength}-round phases
      </h3>
      <p>{game.description}</p>
      <p>
        Energy {game.energyCap} · recharge {game.recharge} · 24 simultaneous
        rounds
      </p>
      <p>
        {game.actions
          .map((a, i) => `${a}: ${game.costs[i]} energy`)
          .join(" · ")}
      </p>
      <div className="arena-matrices">
        {game.payoffs.map((matrix, p) => (
          <table key={p}>
            <caption>Phase {p + 1} · own action × opponent</caption>
            <thead>
              <tr>
                <th scope="col">Action</th>
                {game.actions.map((a) => (
                  <th key={a} scope="col">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {game.actions.map((a, i) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  {game.actions.map((b, j) => (
                    <td key={b}>
                      {matrix[i * 3 + j] > 0 ? "+" : ""}
                      {matrix[i * 3 + j]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}
export function ArenaProgress({ run, generations }) {
  const last = generations.at(-1);
  return (
    <section
      className="lab-results arena-progress"
      aria-label="Arena evolution"
    >
      <h2>Rules evolve. Strategies stay distinct.</h2>
      <p>
        Three strategist roles compete across every active rule set. New
        programs need a higher paired control score, no training regression, and
        at least 12% behavioral distance from the other policies.
      </p>
      {last && (
        <>
          <div className="arena-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Games</th>
                  <th scope="col">Matches</th>
                  <th scope="col">Min. distance</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((g) => (
                  <tr key={g.generation}>
                    <th scope="row">G{g.generation}</th>
                    <td>{g.games}</td>
                    <td>{g.matches}</td>
                    <td>{percent(g.diversity.minimum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Latest tournament · G{last.generation}</h3>
          <div className="arena-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Strategy</th>
                  <th scope="col">W / D / L</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {last.rows.map((r) => (
                  <tr key={r.player}>
                    <th scope="row">
                      {r.player + 1}. {r.name}
                    </th>
                    <td>
                      {r.wins} / {r.draws} / {r.losses}
                    </td>
                    <td>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="arena-distances">
            {last.diversity.pairs.map((p) => (
              <p key={`${p.a}-${p.b}`}>
                Agent {p.a + 1} ↔ {p.b + 1}
                <meter
                  min="0"
                  max="1"
                  value={p.distance}
                  aria-label={`Behavioral distance between agents ${p.a + 1} and ${p.b + 1}`}
                />
                <strong>{percent(p.distance)}</strong>
              </p>
            ))}
          </div>
          <p className="muted">
            Distance compares action probabilities on{" "}
            {last.diversity.probesPerStrategy} common states. Different names
            and random match outcomes do not count. Finite tests cannot
            guarantee permanent diversity or general strength.
          </p>
        </>
      )}
      {!!run.summary.routingResults?.length && (
        <section aria-label="Specialist selection">
          <h3>Saved specialists and learned selection</h3>
          <p>
            Programs are written by the local model. An empirical selector
            learns from executed matches using rules and past opponent moves.
            Unseen rules use the baseline. Saved specialists remain available
            even when the combined selector fails its promotion checks.
          </p>
          <div className="arena-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Agent / round</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Strong games</th>
                  <th scope="col">Control points</th>
                  <th scope="col">Selector</th>
                </tr>
              </thead>
              <tbody>
                {run.summary.routingResults.map((r) => (
                  <tr key={`${r.generation}-${r.player}`}>
                    <th scope="row">
                      {r.player + 1} / G{r.generation}
                    </th>
                    <td>{r.specialists}</td>
                    <td>
                      {[...new Set(r.strengths.flat())].join(", ") ||
                        "None qualified"}
                    </td>
                    <td>
                      {r.before} → {r.after}
                    </td>
                    <td>{r.accepted ? "Installed" : "Baseline retained"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div
        className="arena-rule-grid"
        role="region"
        tabIndex={0}
        aria-label="Game rule tables"
      >
        {run.summary.games?.map((g) => (
          <ArenaRules key={g.name} game={g} />
        ))}
      </div>
      {[
        "model-revision-v2",
        "model-revision-v3",
        "model-revision-v4",
        "model-revision-v5",
      ].includes(run.summary.learningProtocol) && (
        <section aria-label="Unseen evaluation">
          <h3>Unseen games and opponents</h3>
          <p>
            Strategies are frozen before these tests. Results compare the
            starting and final code on identical matches. Test opponents and
            rules are generated by the host for evaluation; they are never
            offered as strategy candidates.
          </p>
          {!run.summary.transfer && (
            <p>
              {run.status === "running"
                ? "Waiting for all model revisions to finish."
                : "No completed unseen evaluation is available."}
            </p>
          )}
          {run.summary.transfer?.map((item) => (
            <div key={item.player}>
              <h4>Strategist {item.player + 1}</h4>
              <TransferTable results={item.results} />
              {item.proposalResults && (
                <section>
                  <h3 className="section-title">
                    Rejected proposal on the same unseen tests
                  </h3>
                  <p>
                    This proposal was not installed. These results do not change
                    the completed selection.
                  </p>
                  <TransferTable results={item.proposalResults} />
                </section>
              )}
            </div>
          ))}
          <p className="muted">
            A finite transfer test can expose regressions; it does not prove
            general intelligence or universal strength.
          </p>
        </section>
      )}
      <p>
        {run.summary.calls || 0} model calls ·{" "}
        {run.summary.usage?.completion || 0} output tokens ·{" "}
        {run.summary.archive || 0} archived opponents
      </p>
    </section>
  );
}
const transferLabels = {
  "new-games": "New games",
  "new-opponents": "New opponents",
  "both-new": "Both new",
};
function TransferTable({ results }) {
  return (
    <div className="arena-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Test</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Matches / version</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.scope}>
              <th scope="row">{transferLabels[r.scope]}</th>
              <td>{r.before}</td>
              <td>{r.after}</td>
              <td>{r.matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ArenaArtifact({ content }) {
  const [step, setStep] = useState(0);
  if (content.learned?.retained)
    return (
      <section aria-label="Saved specialist evidence">
        <h3>Specialists · strategist {content.player + 1}</h3>
        <p>{content.learned.interpretation}</p>
        <p>
          Combined selector: {content.evaluation.before.points} →{" "}
          {content.evaluation.after.points} control points.{" "}
          {content.evaluation.reason}
        </p>
        {content.learned.retained.map((expert, i) => (
          <section key={i}>
            <h3 className="section-title">
              Specialist {i + 1} · {expert.strategy.name}
            </h3>
            <pre>{JSON.stringify(expert.strategy, null, 2)}</pre>
            <p>
              Original model response: {expert.source.runId} /{" "}
              {expert.source.artifact}
            </p>
            {expert.strengths.map((s) => (
              <p key={s.key}>
                {s.game}: control {s.control[0]} → {s.control[1]}; training{" "}
                {s.training[0]} → {s.training[1]}.
              </p>
            ))}
          </section>
        ))}
      </section>
    );
  if (content.version === 2 && content.cases)
    return (
      <div>
        <h3>Executed loss review · strategist {content.player + 1}</h3>
        <p>
          {content.losses} losses across {content.matches} training matches.{" "}
          {content.trainingPoints} points.
        </p>
        <p className="muted">{content.interpretation}</p>
        {content.cases.map((c) => (
          <section key={`${c.game}-${c.seed}-${c.seat}`}>
            <h4>
              {c.game} · score {c.score} · against {c.opponent}
            </h4>
            {c.mistakes.map((m) => (
              <p key={m.round}>
                Round {m.round}, phase {m.phase}: energy {m.energy}, chose{" "}
                {m.actions[m.chosen].name}, payoff {m.payoff}. Best affordable
                action against the revealed move would gain {m.regret}{" "}
                additional points.
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  if (content.diagnosis && content.strategy)
    return (
      <div>
        <h3>Model-authored revision</h3>
        <p>{content.diagnosis}</p>
        <p>Evidence: {content.evidence}</p>
        <p>Hypothesis: {content.hypothesis}</p>
        <pre className="lab-policy-after">
          {JSON.stringify(content.strategy.score)}
        </pre>
        <p className="muted">
          Model interpretation; executable checks determine whether this
          proposal is installed.
        </p>
      </div>
    );
  if (content.results?.[0]?.scope)
    return (
      <div>
        <h3>Unseen evaluation · strategist {content.player + 1}</h3>
        <TransferTable
          results={content.results.map((r) => ({
            scope: r.scope,
            before: r.before.points,
            after: r.after.points,
            matches: r.before.matches,
          }))}
        />
      </div>
    );
  if (content.engine !== "resource-arena-v1")
    return content.payoffs ? <ArenaRules game={content} /> : null;
  if (content.evaluation)
    return (
      <div>
        <h3>
          {content.evaluation.accepted ? "Promoted" : "Retained incumbent"} ·
          strategist {content.player + 1}
        </h3>
        <p>{content.analysis}</p>
        <p className="muted">Candidate: {content.candidateProvenance}</p>
        <pre className="lab-policy-before">
          −{" "}
          {JSON.stringify({
            score: content.previous.score,
            temperature: content.previous.temperature,
          })}
        </pre>
        <pre className="lab-policy-after">
          +{" "}
          {JSON.stringify({
            score: content.candidate.score,
            temperature: content.candidate.temperature,
          })}
        </pre>
        <p>
          Control points: {content.evaluation.before.points} →{" "}
          {content.evaluation.after.points} /{" "}
          {content.evaluation.after.matches * 2}. Minimum distance:{" "}
          {percent(content.evaluation.diversity.minimum)}.
        </p>
        <p>{content.evaluation.reason}</p>
      </div>
    );
  if (!content.rounds) return null;
  const round = content.rounds[step],
    game = content.gameRules;
  return (
    <div className="lab-replay">
      <h3>{content.game} · simultaneous replay</h3>
      <p>
        Round {step + 1} / 24 · phase {round.phase + 1} · cumulative score{" "}
        {round.score}
      </p>
      <div className="arena-duel">
        {content.players.map((p, i) => (
          <div key={p}>
            <strong>Strategist {p + 1}</strong>
            <h3>{game.actions[round.actions[i]]}</h3>
            <p>
              Energy {round.before[i]} → {round.after[i]}
            </p>
            <p>
              Action chance {percent(round.probabilities[i][round.actions[i]])}
            </p>
          </div>
        ))}
      </div>
      <label>
        Replay round
        <input
          aria-label="Arena replay round"
          type="range"
          min="0"
          max="23"
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
      </label>
      <div className="lab-controls">
        <button
          className="btn"
          disabled={!step}
          onClick={() => setStep((s) => s - 1)}
        >
          Previous round
        </button>
        <button
          className="btn"
          disabled={step === 23}
          onClick={() => setStep((s) => s + 1)}
        >
          Next round
        </button>
      </div>
      <p>
        Round payoff for strategist {content.players[0] + 1}: {round.payoff}.
        Match result:{" "}
        {content.winner === null
          ? "draw"
          : `strategist ${content.players[content.winner] + 1} wins`}
        .
      </p>
      <ArenaRules game={game} />
    </div>
  );
}
