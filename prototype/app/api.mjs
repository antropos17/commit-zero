export async function request(
  path,
  { method = "GET", body, signal, etag } = {},
) {
  const deadline = AbortSignal.timeout(12000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      signal: requestSignal,
      headers: {
        ...(method === "GET" && etag ? { "If-None-Match": etag } : {}),
        ...(method !== "GET" ? { "X-Commit-Zero": "local-demo" } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 304) return null;
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.message || "The request could not be completed."),
        { status: response.status, details: data },
      );
    return data;
  } catch (error) {
    if (error.status !== undefined) throw error;
    const timedOut =
      error.name === "TimeoutError" ||
      requestSignal.reason?.name === "TimeoutError";
    if (error.name === "AbortError" && !timedOut) throw error;
    throw Object.assign(
      new Error(
        timedOut
          ? "The request timed out. Check the service and try again."
          : error.name === "SyntaxError"
            ? "The service returned an invalid JSON response. Try again."
            : "Cannot reach the service. Check the connection and try again.",
      ),
      { status: 0 },
    );
  }
}
