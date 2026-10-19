import React, { useEffect, useRef, useState } from "react";
import { agentCatalog } from "../../../shared/agent-catalog.mjs";
import { createAgentFixture } from "../../../shared/agent-fixtures.mjs";
import { Empty, PageHeading } from "../components/ui.jsx";

export function AgentCatalog({ id }) {
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState("all");
  const selected = agentCatalog.find((profile) => profile.id === id);
  const fixture = selected ? createAgentFixture(selected) : null;
  const documentedApi = agentCatalog.filter((profile) => profile.evidence === "documented" && profile.model.provider !== "local").length;
  const pinnedLocal = agentCatalog.filter((profile) => profile.model.artifact).length;
  const unresolved = agentCatalog.filter((profile) => profile.evidence === "unresolved-model-id").length;
  const detailHeading = useRef(null);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 960px)").matches) {
      detailHeading.current?.focus({ preventScroll: true });
      detailHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [selected]);
  const shown = agentCatalog.filter((profile) => {
    const text = `${profile.name} ${profile.purpose} ${profile.model.provider} ${profile.model.family}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      (evidence === "all" || profile.evidence === evidence);
  });
  return (
    <>
      <PageHeading title="Proposed agent roles">
        {agentCatalog.length} disabled role proposals. Model documentation and contract checks do
        not prove account access or runtime behavior.
      </PageHeading>
      <div className="agent-catalog-filters">
        <label>
          Find a role
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, purpose, or provider"
          />
        </label>
        <label>
          Model identity evidence
          <select value={evidence} onChange={(event) => setEvidence(event.target.value)}>
            <option value="all">All evidence states</option>
            <option value="documented">Documented identity</option>
            <option value="unresolved-model-id">Unresolved ID</option>
          </select>
        </label>
        <p className="commons-meta" role="status">{shown.length} of {agentCatalog.length} roles shown</p>
      </div>
      <div className="network-layout agent-catalog-layout">
        <div className="managed-agents">
          {shown.map((profile) => (
            <article className="network-repo" key={profile.id}>
              <div className="section-top">
                <h2>
                  <a href={`#/agent-catalog/${profile.id}`}>{profile.name}</a>
                </h2>
                <span className="pill">Disabled</span>
              </div>
              <p>{profile.purpose}</p>
              <div className="network-repo-detail">
                <span>{profile.model.provider} / {profile.model.id || "Model ID unresolved"}</span>
                <span>{profile.model.artifact ? "Artifact documented" : profile.evidence === "documented" ? "Model documented" : "Model unresolved"}</span>
                <a href={`#/agent-catalog/${profile.id}`}>Inspect role</a>
              </div>
            </article>
          ))}
          {!shown.length && <Empty>No roles match these filters.</Empty>}
        </div>
        <aside className="page-support agent-readiness" aria-label="Proposed role details">
          {id && !selected ? (
            <Empty>Role not found. <a href="#/agent-catalog">View all roles</a>.</Empty>
          ) : selected ? (
            <>
              <h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2>
              <p>{selected.purpose}</p>
              <dl>
                <dt>Stable profile ID</dt><dd>{selected.id}</dd>
                <dt>Provider / model identity</dt><dd>{selected.model.provider} / {selected.model.id || "Unresolved"}</dd>
                <dt>Identity kind</dt><dd>{selected.model.artifact ? "Pinned local artifact" : selected.model.id ? "Provider API ID" : "Unresolved selection"}</dd>
                <dt>Model evidence</dt><dd>{selected.model.source ? <a href={selected.model.source}>{selected.model.source}</a> : "No exact model ID verified"}{selected.model.verifiedAt && ` · checked ${selected.model.verifiedAt}`}</dd>
                <dt>Requirements</dt><dd>{selected.requirements}</dd>
                <dt>Future tool grants</dt><dd>{selected.tools.join(", ")}</dd>
                <dt>Input</dt><dd>{selected.input}</dd>
                <dt>Expected output</dt><dd>{selected.output}</dd>
                <dt>Evaluation fixture</dt><dd>{selected.fixture} (contract only)</dd>
                <dt>Limits</dt><dd>{selected.limits.timeoutSeconds}s timeout; {selected.limits.contextCharacters} input characters; {selected.limits.outputCharacters} output characters; future cost ceiling {selected.limits.futureCostCents} cents</dd>
                {selected.model.artifact && <>
                  <dt>Artifact file</dt><dd>{selected.model.artifact.filename} · {selected.model.artifact.bytes.toLocaleString("en-US")} bytes</dd>
                  <dt>Pinned revision</dt><dd><code>{selected.model.artifact.revision}</code></dd>
                  <dt>Artifact SHA-256</dt><dd><code>{selected.model.artifact.sha256}</code></dd>
                  <dt>License</dt><dd><a href={selected.model.artifact.licenseSource}>{selected.model.artifact.license}</a></dd>
                  <dt>Local alias</dt><dd>{selected.model.localAlias} (application alias, not an upstream model ID)</dd>
                  <dt>Planned local token budget</dt><dd>{selected.limits.contextTokens} context; {selected.limits.inputTokens} complete input; {selected.limits.outputTokens} output. Tokenizer and hardware fit remain unverified.</dd>
                </>}
                <dt>Cancellation</dt><dd>{selected.limits.cancellation}</dd>
                <dt>Activation</dt><dd>{selected.activation}</dd>
              </dl>
              {selected.model.artifact && <p>Pinned identity only. This page does not inspect local files or verify provider readiness.</p>}
              <h2>Working instructions</h2>
              <p>{selected.instructions}</p>
              <section aria-label="Deterministic host fixture">
                <h2>Host contract fixture</h2>
                <p>Authored inputs and example output. No model ran; future role criteria are not scored.</p>
                <p>{fixture.input.task}</p>
                {fixture.input.references.map((reference) => (
                  <div key={reference.id}>
                    <h3 className="small">{reference.id}</h3>
                    <p>{reference.text}</p>
                  </div>
                ))}
                <h3>Future evaluation criteria</h3>
                <ul>{fixture.futureEvaluationCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
                <a className="btn" download={`${selected.id}-fixture.json`}
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fixture, null, 2))}`}>
                  Download fixture JSON
                </a>
              </section>
            </>
          ) : (
            <>
              <h2>Readiness</h2>
              <p>Roles and output contracts are prepared. All {agentCatalog.length} are disabled. {documentedApi} profiles have documented API IDs; {pinnedLocal} have a pinned local artifact; {unresolved} need an exact selection. No account access, model call, hardware fit or arbitrary-code runner is verified here.</p>
              <p>The existing <a href="#/my-agents">account configurations</a> and real local Builder/Reviewer workflow are separate from these proposals.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
