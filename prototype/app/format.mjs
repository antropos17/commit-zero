export const checkLabel = (p) =>
  p.checks === "passed"
    ? "Checks passed"
    : p.checks === "failed"
      ? "Check failed"
      : "Checks pending";
