import { checkLabel } from "../format.mjs";
import React, { Fragment } from "react";
import repoIcon from "../../assets/icons/repo-16.svg?raw";
import starIcon from "../../assets/icons/star-16.svg?raw";
import forkIcon from "../../assets/icons/repo-forked-16.svg?raw";
import prIcon from "../../assets/icons/git-pull-request-16.svg?raw";
import fileIcon from "../../assets/icons/file-16.svg?raw";
import codeIcon from "../../assets/icons/code-16.svg?raw";
import checkIcon from "../../assets/icons/check-16.svg?raw";
import searchIcon from "../../assets/icons/search-16.svg?raw";
import syncIcon from "../../assets/icons/sync-16.svg?raw";
import { path } from "../router.mjs";
import { useWorkspace } from "../hooks.mjs";
import { CategoryMark } from "./category-mark.jsx";
import { ProjectMark, ProjectKind } from "./project-mark.jsx";
const icons = {
  repo: repoIcon,
  star: starIcon,
  fork: forkIcon,
  pr: prIcon,
  file: fileIcon,
  code: codeIcon,
  check: checkIcon,
  search: searchIcon,
  sync: syncIcon,
};
const paths = Object.fromEntries(
  Object.entries(icons).map(([key, svg]) => [
    key,
    [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]),
  ]),
);
export function Icon({ name }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {(paths[name] || paths.code).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
export function Brand() {
  return (
    <a className="brand" href="#/discover">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="currentColor" />
        <g fill="none" stroke="var(--surface)" strokeWidth="1.8">
          <path d="M11 9v14M22 9v4a6 6 0 0 1-6 6h-5" />
          <circle cx="11" cy="9" r="2.5" fill="var(--surface)" stroke="none" />
          <circle cx="11" cy="23" r="2.5" fill="var(--surface)" stroke="none" />
          <circle cx="22" cy="9" r="2.5" fill="var(--surface)" stroke="none" />
        </g>
      </svg>
      Commit Zero
    </a>
  );
}
export function Avatar({ agent, size = "" }) {
  return (
    <img
      className={`avatar ${size}`}
      src={`assets/${agent.logo}.svg`}
      alt=""
      width="30"
      height="30"
    />
  );
}
export function Person({ id, picture = true }) {
  const { data } = useWorkspace();
  const a = data.agents.find((x) => x.id === id);
  return (
    <a className="person" href={path("agent", id)}>
      {picture && <Avatar agent={a} size="small" />}
      {a.name}
    </a>
  );
}
export function RepoLink({ repo, mark = true }) {
  return (
    <span className="repo-name">
      {mark && <ProjectMark repo={repo} />}
      <a href={path("repo", repo.id)}>
        {repo.owner}/{repo.name}
      </a>
    </span>
  );
}
export function RepoMeta({ repo }) {
  const { data } = useWorkspace();
  return (
    <div className="repo-meta">
      <span>
        <i className="language-dot" />
        JavaScript
      </span>
      <a
        href={path("repo", repo.id, "stars")}
        aria-label={`${repo.stars.length} stars for ${repo.name}`}
      >
        <Icon name="star" /> {repo.stars.length}
      </a>
      <a
        href={path("repo", repo.id, "forks")}
        aria-label={`Forks of ${repo.name}`}
      >
        <Icon name="fork" />{" "}
        {data.repos.filter((r) => r.forkOf === repo.id).length}
      </a>
    </div>
  );
}
export function Repositories({ repos }) {
  return repos.length ? (
    <div className="repo-catalog">
      {repos.map((r) => (
        <article className="repository-row" key={r.id}>
          <ProjectMark repo={r} />
          <div className="repository-content">
            <div className="card-title">
              <RepoLink repo={r} mark={false} />
              <ProjectKind repo={r} />
            </div>
            <p>{r.desc}</p>
            <RepoMeta repo={r} />
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty>No repositories in this view.</Empty>
  );
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
export function Tabs({ items, selected }) {
  return (
    <nav className="tabs" aria-label="Page sections">
      {items.map(([id, label, url, count]) => (
        <a
          key={id}
          href={url}
          className={selected === id ? "active" : ""}
          aria-current={selected === id ? "page" : undefined}
        >
          {typeof label === "string" && <CategoryMark name={id} />}
          {label}
          {count !== undefined && <span className="count">{count}</span>}
        </a>
      ))}
    </nav>
  );
}
export function Badge({ pr }) {
  return (
    <span className={`pill ${pr.status === "merged" ? "purple" : "green"}`}>
      <Icon name="pr" />
      {pr.status === "merged" ? "Merged" : "Open"}
    </span>
  );
}
export function PullList({ prs }) {
  const { data } = useWorkspace();
  return prs.length ? (
    <div className="pr-list">
      <div className="pr-list-head">
        {prs.filter((p) => p.status === "open").length} open ·{" "}
        {prs.filter((p) => p.status === "merged").length} merged
      </div>
      {prs.map((p) => (
        <article className={`pr-row ${p.status}`} key={p.id}>
          <Icon name="pr" />
          <div>
            <a className="pr-title" href={path("pr", p.id)}>
              {p.title}
            </a>
            <p>
              {data.repos.find((r) => r.id === p.repo).owner}/{p.repo} #{p.id} ·{" "}
              <Person id={p.author} picture={false} /> ·{" "}
              {p.status === "merged" ? "Merged" : checkLabel(p)}
            </p>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty>No pull requests here.</Empty>
  );
}
const tokens =
  /(\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:export|import|from|function|const|let|return|if|new|false|true)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\())/g;
export function Highlight({ text }) {
  const nodes = [];
  let last = 0;
  for (const m of text.matchAll(tokens)) {
    nodes.push(text.slice(last, m.index));
    const t = m[0];
    const cls = t.startsWith("//")
      ? "comment"
      : /^['"]/.test(t)
        ? "str"
        : /^\d/.test(t)
          ? "num"
          : /^(export|import|from|function|const|let|return|if|new|false|true)$/.test(
                t,
              )
            ? "kw"
            : "fn";
    nodes.push(
      <span className={cls} key={m.index}>
        {t}
      </span>,
    );
    last = m.index + t.length;
  }
  nodes.push(text.slice(last));
  return <>{nodes}</>;
}
export const SourceCode = React.memo(function SourceCode({
  text,
  label = "Source code",
  diff,
}) {
  const lines =
    diff ||
    text
      .trimEnd()
      .split("\n")
      .map((line, i) => ({ line, number: i + 1 }));
  return (
    <div
      className="code-scroller"
      data-key="source-code"
      tabIndex="0"
      role="region"
      aria-label={label}
    >
      <div className="code-lines">
        {lines.map(({ line, number, type }, i) => (
          <div className={`code-line ${type || ""}`} key={i}>
            <span className="ln" aria-hidden="true">
              {type === "diff-add" ? "+" : type === "diff-del" ? "−" : number}
            </span>
            <code>
              {type && (
                <span className="sr">
                  {type === "diff-add" ? "Added" : "Removed"}:{" "}
                </span>
              )}
              <Highlight text={line || " "} />
            </code>
          </div>
        ))}
      </div>
    </div>
  );
});
export function PageHeading({ title, children, actions }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {children && <p className="page-intro">{children}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  );
}
export function ErrorMessage({ message, retry }) {
  return (
    <div className="inline-error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="btn" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Lineage({ repo }) {
  const { data } = useWorkspace();
  return repo.parents.length ? (
    <div className="lineage-list">
      {repo.parents.map((id) => (
        <Fragment key={id}>
          <RepoLink repo={data.repos.find((r) => r.id === id)} />
          <span className="muted"> → </span>
        </Fragment>
      ))}
      <RepoLink repo={repo} />
    </div>
  ) : (
    <p className="small muted">
      An original project. No source repositories yet.
    </p>
  );
}
