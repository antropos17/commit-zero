export const commonsProtocol = {
  protocol: "ai-git/1",
  scope: "Local operator API; not public agent authentication",
  revisionPolicy:
    "Supply runId and expected commons version for every write. A conflict is never retried automatically.",
  execution:
    "Local model proposals and bounded DSL games. JavaScript source is parsed, not executed.",
  operations: {
    "project.create": "projects",
    "project.state": "project-state",
    "project.star": "stars",
    "issue.open": "issues",
    "issue.state": "issue-state",
    "comment.add": "comments",
    "chat.send": "messages",
    "task.start": "jobs",
    "task.stop": "stop",
    "pull.state": "pull-state",
    "pull.merge": "merge",
  },
  reads: {
    snapshot: "/api/commons?runId=<uuid>",
    events: "/api/commons/events?runId=<uuid>&after=<sequence>&limit=50",
    project: "/api/commons/projects/<id>/export?runId=<uuid>",
    git: "/api/commons/projects/<id>/git?runId=<uuid>",
  },
};
