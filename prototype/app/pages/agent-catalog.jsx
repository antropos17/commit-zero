import React from "react";
import { agentCatalog } from "../../../shared/agent-catalog.mjs";
import { Empty, PageHeading } from "../components/ui.jsx";

export function AgentCatalog({ id }) {
  const selected = agentCatalog.find((profile) => profile.id === id);
  return (
    <>
      <PageHeading title="Proposed agent roles">
        Eighteen disabled role proposals. Model documentation and contract checks do
        not prove account access or runtime behavior.
      </PageHeading>
      <div className="network-layout agent-catalog-layout">
        <div className="managed-agents">
          {agentCatalog.map((profile) => (
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
                <span>{profile.evidence === "documented" ? "Model documented" : "Model unresolved"}</span>
                <a href={`#/agent-catalog/${profile.id}`}>Inspect role</a>
              </div>
            </article>
          ))}
        </div>
        <aside className="page-support agent-readiness" aria-label="Proposed role details">
          {id && !selected ? (
            <Empty>Role not found. <a href="#/agent-catalog">View all roles</a>.</Empty>
          ) : selected ? (
            <>
              <h2>{selected.name}</h2>
              <p>{selected.purpose}</p>
              <dl>
                <dt>Stable profile ID</dt><dd>{selected.id}</dd>
                <dt>Provider / model ID</dt><dd>{selected.model.provider} / {selected.model.id || "Unresolved"}</dd>
                <dt>Model evidence</dt><dd>{selected.model.source ? <a href={selected.model.source}>{selected.model.source}</a> : "No exact model ID verified"}{selected.model.verifiedAt && ` · checked ${selected.model.verifiedAt}`}</dd>
                <dt>Requirements</dt><dd>{selected.requirements}</dd>
                <dt>Future tool grants</dt><dd>{selected.tools.join(", ")}</dd>
                <dt>Input</dt><dd>{selected.input}</dd>
                <dt>Expected output</dt><dd>{selected.output}</dd>
                <dt>Evaluation fixture</dt><dd>{selected.fixture} (contract only)</dd>
                <dt>Limits</dt><dd>{selected.limits.timeoutSeconds}s timeout; {selected.limits.contextCharacters} input characters; {selected.limits.outputCharacters} output characters; future cost ceiling {selected.limits.futureCostCents} cents</dd>
                <dt>Cancellation</dt><dd>{selected.limits.cancellation}</dd>
                <dt>Activation</dt><dd>{selected.activation}</dd>
              </dl>
              <h2>Working instructions</h2>
              <p>{selected.instructions}</p>
            </>
          ) : (
            <>
              <h2>Readiness</h2>
              <p>Roles and output contracts are prepared. All 18 are disabled. Twelve model IDs are documented; six need an exact API ID or local artifact selection. No hosted adapter, account access, model call, or arbitrary-code runner is verified here.</p>
              <p>The existing <a href="#/my-agents">account configurations</a> and real local Builder/Reviewer workflow are separate from these proposals.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
