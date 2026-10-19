// Reconstruct exact snapshots from retained merge evidence. No invented commits,
// dates or release numbers; vN is the persisted project revision, not SemVer.
export function projectHistory(project, events) {
  const merged = project.prs
    .filter((pr) => pr.status === "merged")
    .sort((a, b) => a.baseRevision - b.baseRevision);
  const unavailable = {
    versions: [],
    error:
      "Version history is incomplete. Export the workspace to inspect its records.",
  };
  if (merged.length !== project.revision) return unavailable;
  const files = { ...project.files };
  const versions = [];
  for (let index = merged.length - 1; index >= 0; index--) {
    const pr = merged[index];
    const receipts = events.filter(
      (e) => e.type === "merge" && e.repoId === project.id && e.prId === pr.id,
    );
    if (
      pr.baseRevision !== index ||
      receipts.length !== 1 ||
      files[pr.path] !== pr.after
    )
      return unavailable;
    versions.push({
      revision: index + 1,
      title: pr.title,
      prId: pr.id,
      number: project.prs.findIndex((item) => item.id === pr.id) + 1,
      author: "builder",
      mergedBy: receipts[0].actor,
      at: receipts[0].at,
      hash: pr.hash,
      files: { ...files },
    });
    if (pr.before === null) delete files[pr.path];
    else files[pr.path] = pr.before;
  }
  versions.push({
    revision: 0,
    title: "Initial snapshot",
    author: "system",
    at: null,
    files,
  });
  return { versions, error: "" };
}

export function numberedPulls(projects) {
  return projects.flatMap((p) =>
    p.prs.map((pr, index) => ({ ...pr, repoId: p.id, number: index + 1 })),
  );
}

// Job status describes execution, not acceptance. A completed call can still
// produce a rejected or unmerged patch. Join only retained job-specific evidence.
export function taskHistory(state, repoId = "") {
  const pulls = numberedPulls(state.projects);
  return state.jobs
    .map((job, index) => {
      const events = state.events.filter((event) => event.jobId === job.id);
      const pull = pulls.find(
        (pr) => pr.jobId === job.id && pr.repoId === job.repoId,
      );
      const terminal = events.findLast((event) =>
        ["completed", "failed", "stopped"].includes(event.type),
      );
      const responses = job.responses || [];
      const phase =
        job.status === "running"
          ? pull
            ? "Reviewer working"
            : responses.length
              ? "Checking proposal"
              : "Builder working"
          : {
              completed: "Calls finished",
              failed: "Failed",
              cancelled: "Stopped",
              interrupted: "Interrupted",
            }[job.status] || job.status;
      const outcome = pull
        ? {
            merged: `Merged · v${pull.baseRevision + 1}`,
            approved: "Awaiting operator merge",
            "changes-requested": "Changes requested",
            open: "Awaiting review",
          }[pull.status] || pull.status
        : "No pull request";
      return {
        ...job,
        number: index + 1,
        events,
        pull,
        fork: state.projects
          .find((project) => project.id === job.repoId)
          ?.forks?.find((fork) => fork.jobId === job.id),
        sourcePull: pulls.find(
          (pr) => pr.id === job.sourcePrId && pr.repoId === job.repoId,
        ),
        phase,
        outcome,
        finishedAt: job.status === "running" ? null : terminal?.at,
        reason: ["failed", "cancelled", "interrupted"].includes(job.status)
          ? terminal?.text
          : "",
        responseCount: responses.length,
        issue: state.projects
          .find((project) => project.id === job.repoId)
          ?.issues?.find((issue) => issue.id === job.issueId),
        sourceMessage: state.events.find(
          (event) =>
            event.id === job.sourceMessageId &&
            event.type === "message" &&
            (!event.repoId || event.repoId === job.repoId),
        ),
      };
    })
    .filter((job) => !repoId || job.repoId === repoId);
}

export function eventLabel(event, pr) {
  const pull = pr ? `#${pr.number}` : "";
  return (
    {
      message: "commented",
      started: "started a task",
      star: "starred the project",
      fork: "created a fork",
      copy: "copied a file",
      proposal: `opened PR ${pull}`,
      check: event.check?.passed
        ? "passed syntax checks"
        : "failed syntax checks",
      review: "reviewed",
      merge: `merged PR ${pull}`,
      completed: "completed the task",
      stopped: "stopped the task",
      failed: "task failed",
      "project-created": "created a project",
      "project-fork": "forked a project",
      "project-state": "changed project state",
      "issue-opened": "opened an issue",
      "issue-state": "changed issue state",
      "pull-state": "changed pull request state",
      "proposal-note": "explained the proposal",
      comment: "commented",
      unstar: "removed a star",
    }[event.type] || event.type
  );
}
