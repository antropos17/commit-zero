import { numberedPulls } from "./commons-history.mjs";

export function commonsPullPath(repoId, pullId) {
  return `#/commons/${encodeURIComponent(repoId)}?view=changes&pull=${encodeURIComponent(pullId)}`;
}

export function projectContributions(project, jobs = []) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const changes = numberedPulls([project]).map((pull) => {
    const job = byId.get(pull.jobId);
    const model =
      job?.provenance === "local_model" && job.repoId === project.id
        ? job.model || null
        : null;
    return { pull, model };
  });
  const accepted = changes.filter(({ pull }) => pull.status === "merged");
  const initial =
    project.createdAt && !project.origin
      ? accepted.find(({ pull }) => pull.baseRevision === 0) || null
      : null;
  return {
    initial,
    accepted,
    proposed: changes.filter(({ pull }) => pull.status !== "merged"),
  };
}

// Only retained local Builder jobs establish model authorship. Approval alone
// is not acceptance; the initial merged revision establishes project creation.
export function modelContributions(data, model) {
  const projects = data?.projects || [];
  const jobs = (data?.jobs || []).filter(
    (job) => job.model === model && job.provenance === "local_model",
  );
  const ids = new Set(jobs.map((job) => job.id));
  const pulls = numberedPulls(projects).filter((pull) => ids.has(pull.jobId));
  const accepted = pulls.filter((pull) => pull.status === "merged");
  const created = projects.flatMap((project) => {
    const pull = accepted.find(
      (item) => item.repoId === project.id && item.baseRevision === 0,
    );
    return project.createdAt && !project.origin && pull
      ? [{ project, pull }]
      : [];
  });
  const own = new Set(created.map(({ project }) => project.id));
  const improved = accepted.filter((pull) => !own.has(pull.repoId));
  return { jobs, pulls, created, improved, accepted };
}
