import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAccount, useWorkspace } from "./hooks.mjs";
import {
  parseRoute,
  path,
  previousRoute,
  navigationIntent,
  routeGroup,
  routeScroll,
  useRoute,
} from "./router.mjs";
import { Brand, Icon, PageHeading, PullList } from "./components/ui.jsx";
import { GamePreview } from "./components/game.jsx";
import {
  AgentProfile,
  Agents,
  Environment,
  History,
  Issue,
  NotFound,
  Overview,
  PullRequest,
  Repository,
  RepositoryDirectory,
  Search,
} from "./pages/workspace.jsx";
import { Leaderboard } from "./pages/leaderboard.jsx";
import { Authentication, MyProfile } from "./pages/account.jsx";
import { Discover, MyAgents } from "./pages/network.jsx";
import { Timeline } from "./pages/timeline.jsx";
import { Laboratory } from "./pages/laboratory.jsx";
import { CategoryMark } from "./components/category-mark.jsx";
import { ProjectMark } from "./components/project-mark.jsx";
import { Commons } from "./pages/commons.jsx";
import { ModelProfile } from "./pages/model-profile.jsx";
import { AgentCatalog } from "./pages/agent-catalog.jsx";
const navigation = [
  ["discover", "Discover"],
  ["commons", "Agent workspace"],
  ["timeline", "Timeline"],
  ["lab", "Language lab"],
  ["home", "Overview"],
  ["repos", "Repositories"],
  ["pulls", "Pull requests"],
  ["agents", "Agents"],
  ["leaderboard", "Leaderboard"],
  ["my-agents", "Your agents"],
  ["agent-catalog", "Proposed roles"],
  ["sandbox", "Environment"],
  ["history", "Run history"],
  ["profile", "My profile"],
];
const selectedNavigation = (kind) =>
  ({
    repo: "repos",
    issue: "repos",
    pr: "pulls",
    agent: "agents",
    model: "agents",
  })[kind] || kind;
function useTheme() {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("commit-zero-theme", theme);
    } catch {
      /* Session appearance still works. */
    }
  }, [theme]);
  useEffect(() => {
    const handler = (e) => {
      if (
        e.key === "commit-zero-theme" &&
        ["light", "dark"].includes(e.newValue)
      )
        setTheme(e.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return [theme, setTheme];
}
function Page({ route, preview, notify }) {
  const { data } = useWorkspace();
  const { segments, query } = parseRoute(route),
    [kind = "home", id, tab, file] = segments;
  switch (kind) {
    case "commons":
      return (
        <Commons
          repoId={id}
          initialView={query.get("view")}
          initialVersion={query.get("version")}
          initialPullId={query.get("pull")}
          initialTaskId={query.get("task")}
        />
      );
    case "lab":
      return <Laboratory id={id} />;
    case "timeline":
      return <Timeline agent={query.get("agent") || ""} />;
    case "discover":
      return <Discover view={query.get("view")} preview={preview} />;
    case "my-agents":
      return <MyAgents id={id} repository={query.get("repo") || ""} />;
    case "agent-catalog":
      return <AgentCatalog id={id} />;
    case "home":
      return <Overview preview={preview} />;
    case "repos":
      return (
        <RepositoryDirectory
          type={query.get("type")}
          query={query.get("q") || ""}
        />
      );
    case "repo":
      return (
        <Repository
          key={`${data.runId}/${id}`}
          id={id}
          tab={tab}
          file={file}
          preview={preview}
          notify={notify}
        />
      );
    case "agents":
      return <Agents />;
    case "agent":
      return <AgentProfile id={id} tab={tab} />;
    case "model":
      return <ModelProfile key={`${data.runId}/${id}`} id={id} />;
    case "pulls":
      return (
        <>
          <PageHeading title="Pull requests">
            Changes, discussions, and code reviews across the workspace.
          </PageHeading>
          <PullList prs={data.prs} />
        </>
      );
    case "pr":
      return <PullRequest id={id} tab={tab} />;
    case "issue":
      return <Issue id={id} />;
    case "search":
      return <Search query={query.get("q") || ""} />;
    case "history":
      return <History />;
    case "sandbox":
      return <Environment />;
    case "leaderboard":
      return <Leaderboard />;
    case "login":
      return <Authentication key="login" />;
    case "signup":
      return <Authentication key="signup" register />;
    case "profile":
      return <MyProfile notify={notify} />;
    default:
      return <NotFound />;
  }
}
export function App() {
  const workspace = useWorkspace(),
    account = useAccount(),
    route = useRoute();
  const { data, busy, error, playing } = workspace;
  const { segments, query } = parseRoute(route),
    kind = segments[0] || "home",
    selected = selectedNavigation(kind);
  const [theme, setTheme] = useTheme(),
    [search, setSearch] = useState(
      kind === "search" ? query.get("q") || "" : "",
    ),
    [preview, setPreview] = useState(null),
    [toast, setToast] = useState("");
  const main = useRef(null);
  const handledRoute = useRef(null);
  const operationOrigin = useRef(null);
  useLayoutEffect(() => {
    if (busy) return;
    const pending = operationOrigin.current;
    operationOrigin.current = null;
    if (pending && location.hash === pending.hash &&
        (document.activeElement === document.body || document.activeElement === pending.trigger))
      (pending.trigger.isConnected && !pending.trigger.disabled ? pending.trigger : main.current)?.focus({ preventScroll: true });
  }, [busy, data, error]);
  function refreshWorkspace(event) {
    operationOrigin.current = { trigger: event.currentTarget, hash: location.hash };
    workspace.setPlaying(false);
    void workspace.refresh();
  }
  const notify = useCallback((message) => setToast(message), []);
  useEffect(() => {
    if (
      ["lab", "commons", "model"].includes(kind) ||
      (kind === "repo" && segments[2] === "chat")
    )
      workspace.setPlaying(false);
  }, [kind, workspace.setPlaying]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useLayoutEffect(() => {
    if (handledRoute.current === route) return;
    const initialRoute = handledRoute.current === null;
    handledRoute.current = route;
    const previous = previousRoute();
    // Catalog filters change the address while the reader is still editing.
    // Preserve the input, caret and reading position for that same-page update.
    if (
      !initialRoute &&
      kind === "repos" &&
      parseRoute(previous).segments[0] === "repos"
    )
      return;
    if (kind === "search") setSearch(query.get("q") || "");
    const top =
      routeGroup(previous) === routeGroup(route)
        ? routeScroll.get(previous) || 0
        : navigationIntent() === "link"
          ? 0
          : routeScroll.get(route) || 0;
    window.scrollTo({ top, left: 0, behavior: "instant" });
    main.current?.focus({ preventScroll: true });
    document.title = `${navigation.find(([id]) => id === selected)?.[1] || "Workspace"} · Commit Zero`;
  }, [route]);
  function submitSearch(event) {
    event.preventDefault();
    location.hash = `/search?q=${encodeURIComponent(search.trim())}`;
  }
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          main.current.focus();
        }}
      >
        Skip to content
      </a>
      <header>
        <div className="header-inner">
          <Brand />
          <form id="search-form" role="search" onSubmit={submitSearch}>
            <label className="sr" htmlFor="search-input">
              Search agents, repositories, and pull requests
            </label>
            <input
              id="search-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a project or agent…"
            />
            <button type="submit" aria-label="Search">
              <Icon name="search" />
            </button>
          </form>
          <select
            id="theme-select"
            aria-label="Color theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <div className="header-account">
            <a className="btn" href={account.user ? "#/profile" : "#/login"}>
              {account.user ? "My profile" : "Sign in"}
            </a>
          </div>
        </div>
      </header>
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Workspace navigation">
          <nav className="global-nav" aria-label="Main navigation">
            {[
              [
                "Workspace",
                ["discover", "commons", "repos", "pulls", "agents"],
              ],
              ["Explore", ["timeline", "lab", "home", "leaderboard"]],
              ["Manage", ["my-agents", "agent-catalog", "sandbox", "history", "profile"]],
            ].map(([group, ids]) => {
              const items = ids.map((id) =>
                navigation.find(([key]) => key === id),
              );
              const links = items.map(([id, label]) => (
                <a
                  key={id}
                  href={
                    ["commons", "model"].includes(kind) && id === "pulls"
                      ? "#/commons?view=changes"
                      : `#/${id}`
                  }
                  data-nav={id}
                  aria-current={selected === id ? "page" : undefined}
                >
                  <CategoryMark name={id} />
                  {label}
                  {data && id === "repos" && (
                    <span className="count">{data.repos.length}</span>
                  )}
                  {data &&
                    id === "pulls" &&
                    !["commons", "model"].includes(kind) && (
                      <span className="count">
                        {data.prs.filter((p) => p.status === "open").length}
                      </span>
                    )}
                </a>
              ));
              return (
                <section
                  className="navigation-group"
                  key={group}
                  aria-label={group}
                >
                  <h2>{group}</h2>
                  <div className="navigation-links">{links}</div>
                </section>
              );
            })}
          </nav>
          {!["commons", "model"].includes(kind) && (
            <div id="workspace-directory">
              <section className="directory-section">
                <h2>
                  Repositories{" "}
                  {data && <span className="count">{data.repos.length}</span>}
                </h2>
                {data?.repos.map((r) => (
                  <div
                    className="directory-link"
                    key={r.id}
                    title={`${r.owner}/${r.name}`}
                  >
                    <ProjectMark repo={r} />
                    <a href={path("repo", r.id)}>
                      {r.owner}/{r.name}
                    </a>
                  </div>
                ))}
              </section>
            </div>
          )}
        </aside>
        <div className="workspace">
          {!["lab", "commons", "model"].includes(kind) &&
            !(kind === "repo" && segments[2] === "chat") && (
              <section className="demo-bar" aria-label="Scenario controls">
                <div className="environment-status">
                  <b>Simulation</b>
                  <span
                    id="connection"
                    data-status={
                      error ? "offline" : busy || !data ? "loading" : "online"
                    }
                  >
                    <span className="connection-dot" aria-hidden="true" />
                    <span id="connection-label" role="status">
                      {error
                        ? "Connection unavailable"
                        : busy || !data
                          ? "Syncing…"
                          : "Saved to PostgreSQL"}
                    </span>
                  </span>
                </div>
                <div className="playback">
                  <span id="playback-status" role="status">
                    {data ? `Step ${data.step} / 10` : error ? "Unavailable" : "Loading…"}
                  </span>
                  <button
                    id="playback-toggle"
                    disabled={!data || (busy && !playing) || Boolean(error)}
                    title={playing ? "Pause future steps. The current step can finish." : undefined}
                    onClick={(event) => {
                      if (playing) {
                        if (busy) operationOrigin.current = { trigger: event.currentTarget, hash: location.hash };
                        workspace.setPlaying(false);
                        return;
                      }
                      if (data.step === 10) {
                        operationOrigin.current = { trigger: event.currentTarget, hash: location.hash };
                        void workspace.newRun().then((next) => {
                          if (next && next.runId !== data.runId) {
                            routeScroll.delete("#/home");
                            location.hash = "/home";
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }
                        });
                        return;
                      }
                      workspace.setPlaying(!playing);
                    }}
                  >
                    {playing ? "Pause cycle" : data?.step === 10 ? "New run" : "Play cycle"}
                  </button>
                  <button
                    id="playback-next"
                    disabled={
                      !data || busy || Boolean(error) || data.step === 10
                    }
                    onClick={(event) => {
                      operationOrigin.current = { trigger: event.currentTarget, hash: location.hash };
                      workspace.setPlaying(false);
                      void workspace.advance();
                    }}
                  >
                    Next step
                  </button>
                  <button
                    id="sync"
                    aria-label="Refresh workspace"
                    title="Refresh workspace"
                    disabled={busy}
                    onClick={refreshWorkspace}
                  >
                    <Icon name="sync" />
                  </button>
                </div>
              </section>
            )}
          <main
            id="main"
            data-page={kind}
            ref={main}
            tabIndex="-1"
            aria-busy={busy || (!data && !error)}
          >
            {data ||
            ["login", "signup", "profile", "my-agents", "sandbox"].includes(kind) ? (
              <Page route={route} preview={setPreview} notify={notify} />
            ) : (
              <section className="loading-workspace">
                <h1>{error ? "Workspace unavailable" : "Loading workspace"}</h1>
                <p>
                  {error ||
                    "Connecting to your saved projects and agent activity."}
                </p>
                {error && (
                  <button className="btn" onClick={refreshWorkspace}>
                    Try again
                  </button>
                )}
              </section>
            )}
          </main>
          <footer>
            <span>Commit Zero</span>
            <nav aria-label="Footer links">
              <a href="#/leaderboard">Leaderboard</a>
              <a href="#/sandbox">Service health</a>
              <a href="/api/export" download>
                Export data
              </a>
              <span>
                {["commons", "model"].includes(kind) ||
                (kind === "repo" && segments[2] === "chat")
                  ? "Local collaboration records"
                  : kind === "lab"
                    ? "Local experiment records"
                    : "Simulated agent activity"}
              </span>
            </nav>
          </footer>
        </div>
      </div>
      {preview && (
        <GamePreview
          key={preview.id}
          project={preview}
          theme={theme}
          onClose={() => setPreview(null)}
        />
      )}
      <div id="toast" role="status">
        {toast}
      </div>
      {error && data && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button className="btn" onClick={refreshWorkspace} disabled={busy}>
            Retry
          </button>
        </div>
      )}
    </>
  );
}
