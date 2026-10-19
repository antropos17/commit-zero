import { numberedPulls } from "./commons-history.mjs";

const localActions = {
  message: "posted a message",
  started: "started a task",
  fork: "created a retained fork",
  star: "starred the project",
  unstar: "removed a star",
  completed: "finished model calls",
  failed: "task failed",
  stopped: "stopped the task",
  "pull-state": "changed PR state",
  comment: "commented",
  proposal: "proposed a change",
  "proposal-note": "explained the change",
  review: "reviewed the PR",
  merge: "merged the PR",
  copy: "copied source",
  "project-created": "created the project",
  "project-fork": "forked the project",
};

export function localProjectTimeline(project, jobs, events, taskId = "") {
  const pulls = new Map(
    numberedPulls([project]).map((pull) => [pull.id, pull]),
  );
  const scopedJobs = new Map(
    jobs
      .map((job, index) => ({ ...job, number: index + 1 }))
      .filter((job) => job.repoId === project.id)
      .map((job) => [job.id, job]),
  );
  const receipts = new Map(
    events
      .filter(
        (event) =>
          event.repoId === project.id && event.inference && event.jobId,
      )
      .map((event) => [
        JSON.stringify([event.jobId, event.actor]),
        event.inference,
      ]),
  );
  return events
    .filter(
      (event) =>
        (event.repoId === project.id ||
          (!event.repoId &&
            event.id === scopedJobs.get(taskId)?.sourceMessageId)) &&
        (localActions[event.type] || event.type === "check") &&
        (!taskId ||
          event.jobId === taskId ||
          pulls.get(event.prId)?.jobId === taskId ||
          event.id === scopedJobs.get(taskId)?.sourceMessageId),
    )
    .map((event) => {
      const pull = pulls.get(event.prId);
      const job =
        scopedJobs.get(event.jobId || pull?.jobId) ||
        (event.id === scopedJobs.get(taskId)?.sourceMessageId
          ? scopedJobs.get(taskId)
          : null) ||
        [...scopedJobs.values()].find(
          (item) => item.sourceMessageId === event.id,
        );
      const isModel = ["builder", "reviewer"].includes(event.actor);
      const response = job?.responses?.find(
        (item) => item.actor === event.actor,
      );
      const receipt = receipts.get(JSON.stringify([event.jobId, event.actor]));
      const evidence =
        receipt || response || (event.actor === "builder" ? job : null);
      const model =
        isModel &&
        job?.provenance === "local_model" &&
        evidence?.provenance === "local_model"
          ? evidence.model
          : null;
      let action = localActions[event.type];
      if (event.type === "check")
        action =
          event.check?.passed === true
            ? "syntax passed"
            : event.check?.passed === false
              ? "syntax failed"
              : "checked syntax";
      if (event.type === "review" && typeof pull?.review?.approve === "boolean")
        action = pull.review.approve ? "approved the PR" : "requested changes";
      return {
        id: event.id,
        sequence: event.sequence,
        at: event.at,
        actor: event.actor,
        model,
        action,
        task: job ? { id: job.id, number: job.number } : null,
        text: ["message", "failed", "stopped", "comment"].includes(event.type)
          ? event.text
          : null,
        forkId: event.forkId,
        pull,
        file: event.type === "proposal" ? pull?.path : null,
        version: event.type === "merge" && pull ? pull.baseRevision + 1 : null,
      };
    })
    .sort((a, b) => b.sequence - a.sequence);
}

export function scenarioProjectTimeline(repoId, events, pulls, runId) {
  const allowed = new Set([
    "create",
    "fork",
    "pr",
    "commit",
    "check",
    "review",
    "approve",
    "merge",
  ]);
  return events
    .filter((event) => event.repo === repoId && allowed.has(event.type))
    .map((event) => ({
      id: event.id || `${runId}:${event.sequence}`,
      at: event.recordedAt,
      actor: event.actor,
      action:
        {
          pr: "opened the PR",
          commit: "updated the patch",
          approve: "approved the PR",
          merge: "merged the PR",
          review: "reviewed the PR",
          create: "created the project",
          fork: "forked the project",
        }[event.type] || event.text,
      pull: pulls.find((pull) => pull.repo === repoId && pull.id === event.pr),
    }));
}
