import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWorkspace, useAccount } from "../hooks.mjs";
import { request } from "../api.mjs";
import { path } from "../router.mjs";
import {
  projectHistory,
  numberedPulls,
  taskHistory,
} from "../../../shared/commons-history.mjs";
import {
  Activity,
  CodeFiles,
  PullChanges,
  Versions,
  Forks,
  RecordedTime,
  actorNames,
  SourceMessage,
} from "./commons-panels.jsx";
import { ProjectMark } from "../components/project-mark.jsx";
import { Tasks } from "./commons-tasks.jsx";
import { revisionTag } from "../../../shared/revisions.mjs";
import { Projects, ProjectForm, Issues } from "./commons-projects.jsx";
import { cachedCommons, retainCommons } from "./commons-cache.mjs";
import { ProjectContributions } from "../components/project-contributions.jsx";
import { LocalProjectTimeline } from "../components/project-timeline.jsx";

export function Commons({
  repoId = "",
  embedded = false,
  initialView,
  initialVersion,
  initialPullId,
  initialTaskId,
}) {
  const { data } = useWorkspace();
  return (
    <CommonsRoom
      key={`${data.runId}/${repoId}`}
      runId={data.runId}
      repoId={repoId}
      embedded={embedded}
      initialView={initialView}
      initialVersion={initialVersion}
      initialPullId={initialPullId}
      initialTaskId={initialTaskId}
    />
  );
}
function CommonsRoom({
  runId,
  repoId,
  embedded,
  initialView,
  initialVersion,
  initialPullId,
  initialTaskId,
}) {
  const account = useAccount();
  const [data, setData] = useState(() => cachedCommons(runId)),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(!data);
  const [connectionError, setConnectionError] = useState("");
  const [provider, setProvider] = useState(null),
    [pending, setPending] = useState(false),
    [checkingProvider, setCheckingProvider] = useState(true),
    [providerError, setProviderError] = useState("");
  const [draft, setDraft] = useState(""),
    [task, setTask] = useState(
      "Find and fix one concrete edge-case bug. Preserve the public API and explain the change.",
    );
  const [target, setTarget] = useState(repoId || "safe-timer"),
    [view, setView] = useState(
      initialView || (repoId && !embedded ? "code" : "discussion"),
    );
  const [selectedVersion, setSelectedVersion] = useState(
    initialVersion == null ? null : Number(initialVersion),
  );
  const [focusedPull, setFocusedPull] = useState(initialPullId || "");
  const [selectedTask, setSelectedTask] = useState(initialTaskId || "");
  const [timelineTask, setTimelineTask] = useState("");
  const [sourceMessageId, setSourceMessageId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [sourcePrId, setSourcePrId] = useState("");
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState(
    () =>
      new URLSearchParams(location.hash.split("?")[1] || "").get("agent") || "",
  );
  useEffect(() => {
    if (!account.user) {
      setAgents([]);
      return;
    }
    const controller = new AbortController();
    request("account/agents", { signal: controller.signal })
      .then((value) => setAgents(value.agents))
      .catch(() => {});
    return () => controller.abort();
  }, [account.user?.id]);
  const taskInput = useRef(null);
  const chatLog = useRef(null);
  const followChat = useRef(true);
  const messageAnchor = useRef(null);
  const [messageWindowStart, setMessageWindowStart] = useState(null);
  useLayoutEffect(() => {
    const log = chatLog.current, anchor = messageAnchor.current;
    if (log && anchor) {
      log.scrollTop = anchor.top + log.scrollHeight - anchor.height;
      messageAnchor.current = null;
    }
  }, [messageWindowStart]);
  useEffect(() => {
    const log = chatLog.current;
    if (log && followChat.current) log.scrollTop = log.scrollHeight;
  }, [data?.version, view]);
  useEffect(() => {
    if (sourceMessageId) taskInput.current?.focus();
  }, [sourceMessageId]);
  useEffect(() => {
    setView(initialView || (repoId && !embedded ? "code" : "discussion"));
    setSelectedVersion(initialVersion == null ? null : Number(initialVersion));
    setFocusedPull(initialPullId || "");
    setSelectedTask(initialTaskId || "");
  }, [
    initialView,
    initialVersion,
    initialPullId,
    initialTaskId,
    repoId,
    embedded,
  ]);
  const [paused, setPaused] = useState(false);
  const alive = useRef(true);
  const latestVersion = useRef(null);
  const receive = useCallback((next) => {
    if (!next) return;
    retainCommons(next);
    latestVersion.current = Math.max(latestVersion.current ?? 0, next.version);
    if (alive.current)
      setData((old) => (!old || next.version >= old.version ? next : old));
  }, []);
  const refresh = useCallback(
    async (signal) => {
      const initialRead = latestVersion.current === null;
      if (initialRead) setLoading(true);
      try {
        const next = await request(`commons?runId=${runId}`, {
          signal,
          etag:
            latestVersion.current === null
              ? undefined
              : revisionTag("commons", runId, latestVersion.current),
        });
        receive(next);
      } finally {
        if (initialRead && !signal?.aborted && alive.current) setLoading(false);
      }
    },
    [runId, receive],
  );
  const checkProvider = useCallback(async (signal) => {
    setCheckingProvider(true);
    setProviderError("");
    try {
      const next = await request("commons/provider", { signal });
      if (!signal?.aborted && alive.current) setProvider(next);
    } catch (e) {
      if (!signal?.aborted && alive.current) {
        setProvider(null);
        setProviderError(e.message);
      }
    } finally {
      if (!signal?.aborted && alive.current) setCheckingProvider(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let timer;
    const load = async () => {
      try {
        await refresh(controller.signal);
        if (alive.current) setConnectionError("");
      } catch (e) {
        if (!controller.signal.aborted) setConnectionError(e.message);
      }
      if (!controller.signal.aborted && !paused) timer = setTimeout(load, 2500);
    };
    if (!paused) load();
    void checkProvider(controller.signal);
    return () => {
      alive.current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh, paused, checkProvider]);
  async function act(endpoint, body, onSuccess) {
    if (!data || pending) return;
    setPending(true);
    setError("");
    try {
      const next = await request(`commons/${endpoint}`, {
        method: "POST",
        body: { runId, version: data.version, ...body },
      });
      receive(next);
      if (alive.current) onSuccess?.(next);
    } catch (e) {
      if (alive.current) {
        setError(e.message);
        if (e.status === 409) await refresh().catch(() => {});
        if (endpoint === "jobs" && e.status === 503) void checkProvider();
      }
    } finally {
      if (alive.current) setPending(false);
    }
  }
  if (!data)
    return (
      <section aria-busy={loading}>
        <p role={!loading && (error || connectionError) ? "alert" : "status"}>
          {loading ? "Loading workspace…" : error || connectionError}
        </p>
        <button
          className="btn"
          disabled={loading}
          onClick={() => {
            setError("");
            setConnectionError("");
            void refresh().catch((e) => setError(e.message));
          }}
        >
          Retry
        </button>
      </section>
    );
  const current = data.projects.find((p) => p.id === repoId);
  if (repoId && !current) return <p>Project not found in this workspace.</p>;
  const events = data.events.filter((e) => !repoId || e.repoId === repoId);
  const messages = data.events.filter(
    (e) => e.type === "message" && e.repoId === repoId,
  );
  const messageStart = messageWindowStart === null
    ? Math.max(0, messages.length - 40)
    : Math.max(0, messages.findIndex((event) => event.id === messageWindowStart));
  const visibleMessages = messages.slice(messageStart);
  const allPulls = numberedPulls(data.projects);
  const prs = allPulls.filter((pr) => !repoId || pr.repoId === repoId);
  const running = data.jobs.find((job) => job.status === "running");
  const allJobs = taskHistory(data);
  const jobs = allJobs.filter((job) => !repoId || job.repoId === repoId);
  const activeTask = allJobs.find((job) => job.id === timelineTask);
  const sourceMessage = data.events.find(
    (event) => event.id === sourceMessageId,
  );
  const history = current ? projectHistory(current, data.events) : null;
  const selectedAgent = agents.find((agent) => agent.id === agentId);
  const linkedIssue = (
    data.projects.find((p) => p.id === target)?.issues || []
  ).find((issue) => issue.id === issueId);
  const tabs = current
    ? [
        ["code", "Code"],
        [
          "issues",
          `Issues (${(current.issues || []).filter((issue) => issue.status === "open").length})`,
        ],
        ["tasks", `Tasks (${jobs.length})`],
        ["changes", `Pull requests (${prs.length})`],
        ["discussion", "Chat"],
        ["versions", "Versions"],
        ["forks", `Forks (${current.forks.length})`],
        ["activity", "Timeline"],
      ]
    : [
        ["projects", "Projects"],
        ["discussion", "General chat"],
        ["tasks", `Tasks (${jobs.length})`],
        ["changes", `Pull requests (${prs.length})`],
        ["activity", "Timeline"],
      ];
  const activeView = tabs.some(([id]) => id === view) ? view : tabs[0][0];
  const workingTask =
    activeView === "tasks" && jobs.find((job) => job.id === selectedTask);
  const workingProject =
    workingTask &&
    data.projects.find((project) => project.id === workingTask.repoId);
  function revisePull(pr) {
    const original = allJobs.find((job) => job.id === pr.jobId);
    setSourcePrId(pr.id);
    setSourceMessageId(original?.sourceMessageId || "");
    setIssueId(original?.issueId || "");
    setTarget(pr.repoId);
    taskInput.current?.focus();
  }
  function showPull(id) {
    setFocusedPull(id);
    setView("changes");
  }
  function showTask(id) {
    setSelectedTask(id);
    setView("tasks");
    if (!embedded)
      location.hash = `${path("commons", repoId).slice(1)}?view=tasks&task=${encodeURIComponent(id)}`;
  }
  function showTaskTimeline(id) {
    setTimelineTask(id);
    setView("activity");
  }
  function showVersion(projectId, revision) {
    if (projectId !== repoId) {
      location.hash = `/commons/${encodeURIComponent(projectId)}?view=versions&version=${revision}`;
      return;
    }
    setSelectedVersion(revision);
    setView("versions");
  }
  const Heading = embedded ? "h2" : "h1";
  return (
    <div className="commons" data-view={activeView}>
      <div className={`commons-layout ${embedded ? "commons-embedded" : ""}`}>
        <div className="commons-main">
          <div className="commons-heading">
            <div className="commons-project-name">
              {current && <ProjectMark repo={current} jobs={data.jobs} />}
              <Heading>{current ? current.name : "General"}</Heading>
              {current && (
                <button
                  className="commons-version"
                  onClick={() => showVersion(repoId, current.revision)}
                >
                  v{current.revision}
                </button>
              )}
            </div>
            <button className="btn" onClick={() => setPaused(!paused)}>
              {paused ? "Resume updates" : "Pause updates"}
            </button>
          </div>
          <div className="commons-toolbar">
            <span className="commons-meta" role="status">
              {paused ? "Paused" : "Live"} · Local model · Syntax checks
              {running ? " · Working" : ""}
            </span>
            <div className="commons-actions">
              {current && (
                <span className="commons-meta">
                  {current.stars.length} stars · {current.forks.length} forks
                </span>
              )}
              {current && (
                <button
                  className="btn"
                  aria-pressed={current.stars.includes("operator")}
                  disabled={pending || current.archived}
                  onClick={() =>
                    act("stars", {
                      repoId,
                      starred: !current.stars.includes("operator"),
                    })
                  }
                >
                  {current.stars.includes("operator") ? "Unstar" : "Star"}
                </button>
              )}
              {running && (
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() => act("stop", { jobId: running.id })}
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          {!embedded && (
            <nav className="commons-channels" aria-label="Chat channels">
              <a href="#/commons" aria-current={!repoId ? "page" : undefined}>
                General
              </a>
              {data.projects.map((p) => (
                <div className="commons-channel" key={p.id}>
                  <ProjectMark repo={p} jobs={data.jobs} />
                  <a
                    href={path("commons", p.id)}
                    aria-current={repoId === p.id ? "page" : undefined}
                  >
                    <span>{p.name}</span>
                    <small>v{p.revision}</small>
                  </a>
                </div>
              ))}
            </nav>
          )}
          <div
            className="commons-views"
            role="group"
            aria-label="Project sections"
          >
            {tabs.map(([id, label]) => (
              <button
                className="btn"
                key={id}
                aria-pressed={activeView === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {connectionError && (
            <p className="inline-error" role="alert">
              Offline. Saved content retained. {connectionError}
            </p>
          )}
          {current?.archived && (
            <p role="status">
              Archived project. History and exports remain available.
            </p>
          )}
          <div className="commons-workbench">
            <div className="commons-content">
              {activeView === "projects" && (
                <Projects projects={data.projects} jobs={data.jobs} />
              )}
              {activeView === "issues" && current && (
                <Issues
                  project={current}
                  events={events}
                  jobs={allJobs}
                  pending={pending}
                  act={act}
                  onTask={(issue) => {
                    setIssueId(issue.id);
                    setSourcePrId("");
                    setTarget(current.id);
                    setTask(`Investigate and resolve issue #${issue.number}: ${issue.title}`);
                    taskInput.current?.focus();
                  }}
                />
              )}
              {activeView === "code" && current && (
                <>
                  <CodeFiles
                    files={current.files}
                    label={`v${current.revision}`}
                  />
                  <div className="commons-actions">
                    <a
                      className="btn"
                      href={`/api/commons/projects/${encodeURIComponent(current.id)}/export?runId=${runId}`}
                      download
                    >
                      Export project
                    </a>
                    <a
                      className="btn"
                      href={`/api/commons/projects/${encodeURIComponent(current.id)}/git?runId=${runId}`}
                      download
                    >
                      Export Git history
                    </a>
                    <button
                      className="btn"
                      disabled={pending || Boolean(running)}
                      onClick={() =>
                        act("project-state", {
                          repoId,
                          archived: !current.archived,
                        })
                      }
                    >
                      {current.archived ? "Restore project" : "Archive project"}
                    </button>
                  </div>
                  {current.origin && (
                    <p className="commons-meta">
                      Forked from{" "}
                      <a href={path("commons", current.origin.repoId)}>
                        {current.origin.repoId}
                      </a>{" "}
                      at v{current.origin.revision}
                    </p>
                  )}
                </>
              )}
              {activeView === "forks" && current && (
                <Forks forks={current.forks} />
              )}
              {activeView === "versions" && current && (
                <Versions
                  history={history}
                  selected={selectedVersion}
                  onSelect={setSelectedVersion}
                  onPull={showPull}
                />
              )}
              {activeView === "changes" && (
                <>
                  {!focusedPull && prs.length > 0 && (
                    <nav
                      className="commons-record-picker"
                      aria-label="Pull requests"
                    >
                      {prs.map((pr) => (
                        <button
                          className="btn"
                          key={pr.id}
                          onClick={() => showPull(pr.id)}
                          aria-pressed={pr.id === prs[0].id}
                        >
                          <strong>
                            #{pr.number} {pr.title}
                          </strong>
                          <span>
                            {pr.repoId} · {pr.status}
                          </span>
                        </button>
                      ))}
                    </nav>
                  )}
                  {focusedPull && (
                    <p className="commons-meta">
                      <a
                        href={`${path("commons", repoId)}?view=changes`}
                        onClick={() => setFocusedPull("")}
                      >
                        All pull requests
                      </a>
                    </p>
                  )}
                  {focusedPull &&
                  !prs.some((pull) => pull.id === focusedPull) ? (
                    <p role="status">Pull request not found in this project.</p>
                  ) : (
                    <PullChanges
                      prs={
                        focusedPull
                          ? prs.filter((pull) => pull.id === focusedPull)
                          : prs.slice(0, 1)
                      }
                      pending={pending}
                      act={act}
                      focusedId={focusedPull}
                      onVersion={showVersion}
                      jobs={allJobs}
                      onTask={showTask}
                      events={events}
                      onRevise={revisePull}
                    />
                  )}
                </>
              )}
              {activeView === "tasks" && (
                <>
                  {selectedTask && (
                    <button
                      className="commons-text-button"
                      onClick={() => {
                        setSelectedTask("");
                        if (!embedded)
                          location.hash = `${path("commons", repoId).slice(1)}?view=tasks`;
                      }}
                    >
                      All tasks
                    </button>
                  )}
                  {workingTask?.pull && (
                    <PullChanges
                      prs={[workingTask.pull]}
                      pending={pending}
                      act={act}
                      onVersion={showVersion}
                      events={data.events}
                      onRevise={revisePull}
                    />
                  )}
                  <Tasks
                    jobs={jobs.filter(
                      (job) => !selectedTask || job.id === selectedTask,
                    )}
                    onPull={showPull}
                    onTimeline={showTaskTimeline}
                    onVersion={showVersion}
                    onOpen={showTask}
                    focused={Boolean(selectedTask)}
                  />
                  {selectedTask && !workingTask && (
                    <p role="status">Task not found in this project.</p>
                  )}
                </>
              )}
              {activeView === "activity" && (
                <>
                  {activeTask && (
                    <>
                      <div className="commons-actions">
                        <strong>Task #{activeTask.number}</strong>
                        <button
                          className="commons-text-button"
                          onClick={() => showTask(activeTask.id)}
                        >
                          View task
                        </button>
                        <button
                          className="commons-text-button"
                          onClick={() => setTimelineTask("")}
                        >
                          All activity
                        </button>
                      </div>
                      <SourceMessage event={activeTask.sourceMessage} />
                    </>
                  )}
                  {current && !embedded && !activeTask ? (
                    <LocalProjectTimeline
                      project={current}
                      jobs={data.jobs}
                      events={data.events}
                      offline={connectionError}
                      paused={paused}
                    />
                  ) : (
                    <Activity
                      events={activeTask ? activeTask.events : events}
                      pulls={allPulls}
                      onPull={showPull}
                      onVersion={showVersion}
                    />
                  )}
                </>
              )}
              {activeView === "discussion" && (
                <section className="commons-chat" aria-label="Chat">
                  {messages.length > 40 && (
                    <div className="commons-history-controls">
                      <span className="small muted" role="status">
                        Showing {visibleMessages.length} of {messages.length} saved messages
                      </span>
                      {messageStart > 0 && (
                        <button className="commons-text-button" onClick={() => {
                          const log = chatLog.current;
                          messageAnchor.current = { top: log.scrollTop, height: log.scrollHeight };
                          followChat.current = false;
                          setMessageWindowStart(messages[Math.max(0, messageStart - 40)].id);
                        }}>
                          Show {Math.min(40, messageStart)} earlier messages
                        </button>
                      )}
                    </div>
                  )}
                  <div
                    className="commons-messages"
                    role="region"
                    tabIndex={0}
                    aria-label="Saved messages"
                    ref={chatLog}
                    onScroll={(event) => {
                      const log = event.currentTarget;
                      followChat.current =
                        log.scrollHeight - log.scrollTop - log.clientHeight <
                        48;
                      if (!followChat.current && messageWindowStart === null && visibleMessages.length)
                        setMessageWindowStart(visibleMessages[0].id);
                    }}
                  >
                    {!messages.length && (
                      <p className="commons-empty">No messages yet.</p>
                    )}
                    {visibleMessages.map((event) => (
                      <article key={event.id} className="commons-message">
                        <div className="commons-byline">
                          <strong>
                            {event.actorName || actorNames[event.actor]}
                          </strong>
                          <span>{event.inference ? "Model" : "Operator"}</span>
                          <RecordedTime at={event.at} />
                        </div>
                        <p>{event.text}</p>
                        <div className="commons-actions">
                          <button
                            className="commons-text-button"
                            disabled={pending}
                            onClick={() => {
                              setSourceMessageId(event.id);
                              if (!repoId && event.projectId)
                                setTarget(event.projectId);
                              if (sourceMessageId === event.id)
                                taskInput.current?.focus();
                            }}
                          >
                            Create task
                          </button>
                          {allJobs.some((job) => job.id === event.jobId) && (
                            <button
                              className="commons-text-button"
                              onClick={() => showTask(event.jobId)}
                            >
                              Task #
                              {
                                allJobs.find((job) => job.id === event.jobId)
                                  .number
                              }
                            </button>
                          )}
                          {event.prId && (
                            <button
                              className="commons-text-button"
                              onClick={() => showPull(event.prId)}
                            >
                              PR #
                              {
                                allPulls.find((p) => p.id === event.prId)
                                  ?.number
                              }
                            </button>
                          )}
                          {allJobs
                            .filter((job) => job.sourceMessageId === event.id)
                            .map((job) => (
                              <button
                                key={job.id}
                                className="commons-text-button"
                                onClick={() => showTask(job.id)}
                              >
                                Task #{job.number}
                              </button>
                            ))}
                        </div>
                      </article>
                    ))}
                  </div>
                  <form
                    className="commons-compose"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act("messages", { repoId, message: draft }, () =>
                        setDraft(""),
                      );
                    }}
                  >
                    <label htmlFor="commons-message">Message</label>
                    <textarea
                      id="commons-message"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Write a message…"
                    />
                    <div>
                      <span className="commons-meta">Local operator</span>
                      <button
                        className="btn"
                        disabled={pending || !draft.trim()}
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </section>
              )}
              {current && !embedded && activeView === "code" && (
                <LocalProjectTimeline
                  project={current}
                  jobs={data.jobs}
                  events={data.events}
                  offline={connectionError}
                  paused={paused}
                />
              )}
            </div>
            <aside
              className="commons-support"
              aria-label="Project actions and contributors"
            >
              {workingProject && (
                <LocalProjectTimeline
                  key={workingTask.id}
                  project={workingProject}
                  jobs={data.jobs}
                  events={data.events}
                  taskId={workingTask.id}
                  offline={connectionError}
                  paused={paused}
                />
              )}
              {activeView === "projects" && (
                <ProjectForm pending={pending} act={act} />
              )}
              {activeView === "forks" && current && (
                <ProjectForm source={current} pending={pending} act={act} />
              )}
              <section
                className="commons-start"
                aria-label="New task"
                hidden={activeView === "projects" || activeView === "forks"}
              >
                <h2>New task</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(
                      "jobs",
                      {
                        repoId: target,
                        task,
                        ...(sourceMessageId ? { sourceMessageId } : {}),
                        ...(issueId ? { issueId } : {}),
                        ...(sourcePrId ? { sourcePrId } : {}),
                        ...(selectedAgent
                          ? {
                              agentId: selectedAgent.id,
                              agentVersion: selectedAgent.version,
                            }
                          : {}),
                      },
                      (next) => {
                        setSourceMessageId("");
                        setIssueId("");
                        setSourcePrId("");
                        showTask(next.jobs.at(-1).id);
                      },
                    );
                  }}
                >
                  {!repoId && (
                    <>
                      <label htmlFor="commons-project">Project</label>
                      <select
                        id="commons-project"
                        value={target}
                        onChange={(e) => {
                          setTarget(e.target.value);
                          setIssueId("");
                          setSourcePrId("");
                          setSourceMessageId("");
                        }}
                      >
                        {data.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label htmlFor="commons-agent">Agent</label>
                  <select
                    id="commons-agent"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Workspace Builder</option>
                    {agents.map((agent) => (
                      <option value={agent.id} key={agent.id}>
                        {agent.name} · {agent.provider}/{agent.model}
                      </option>
                    ))}
                  </select>
                  {agentId && !selectedAgent && (
                    <p role="alert">
                      Sign in to the agent owner account and reload this page.
                    </p>
                  )}
                  {selectedAgent && (
                    <p className="commons-meta">
                      Uses configuration v{selectedAgent.version}. Its name,
                      instructions and allowed actions are retained with this
                      task in the local workspace. No provider charge; code is
                      parsed only.
                    </p>
                  )}
                  {linkedIssue && (
                    <p>
                      Issue #{linkedIssue.number}: {linkedIssue.title}{" "}
                      <button
                        type="button"
                        className="commons-text-button"
                        onClick={() => setIssueId("")}
                      >
                        Remove issue
                      </button>
                    </p>
                  )}
                  {sourcePrId && (
                    <p>
                      Revision of PR #
                      {allPulls.find((pr) => pr.id === sourcePrId)?.number}.
                      Previous code and review are included.{" "}
                      <button
                        type="button"
                        className="commons-text-button"
                        onClick={() => setSourcePrId("")}
                      >
                        Remove PR source
                      </button>
                    </p>
                  )}
                  {sourceMessage && (
                    <>
                      <SourceMessage event={sourceMessage} />
                      <button
                        type="button"
                        className="commons-text-button"
                        disabled={pending}
                        onClick={() => {
                          setSourceMessageId("");
                          taskInput.current?.focus({ preventScroll: true });
                        }}
                      >
                        Remove source
                      </button>
                    </>
                  )}
                  <label htmlFor="commons-task">Task</label>
                  <textarea
                    id="commons-task"
                    ref={taskInput}
                    rows={3}
                    maxLength={1000}
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                  />
                  <div className="commons-actions">
                    <button
                      className="btn green"
                      disabled={
                        pending ||
                        Boolean(running) ||
                        checkingProvider ||
                        Boolean(provider?.busy) ||
                        provider?.available !== true ||
                        !task.trim() ||
                        Boolean(current?.archived) ||
                        Boolean(agentId && !selectedAgent)
                      }
                    >
                      Run agents
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={checkingProvider || pending}
                      onClick={() => void checkProvider()}
                    >
                      {checkingProvider ? "Checking model" : "Check model"}
                    </button>
                    <span className="commons-meta" role="status">
                      {checkingProvider
                        ? "Checking local model."
                        : providerError
                          ? `Model status unavailable: ${providerError}`
                          : provider?.busy
                            ? "Local model is busy. Check again when it finishes."
                            : provider?.available
                            ? "Builder then Reviewer (2 calls max)"
                            : provider?.reason || "Model offline - npm run model:start"}
                    </span>
                  </div>
                </form>
              </section>
              {current && !embedded && (
                <ProjectContributions project={current} jobs={data.jobs} />
              )}
              <div className="commons-footnotes">
                <section className="commons-execution">
                  <h2>Execution</h2>
                  <p>
                    Builder and Reviewer share a local model. Syntax checks do
                    not run the code. Merges update this local copy only. Local
                    operator is not an authenticated account.
                  </p>
                  {current && !current.createdAt && (
                    <a href={path("repo", repoId)}>Original scenario</a>
                  )}
                </section>
                <a
                  className="commons-export"
                  href={`/api/commons?runId=${runId}`}
                  download={`commons-${runId}.json`}
                >
                  Export
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
