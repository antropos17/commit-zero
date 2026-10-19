export async function request(
  path,
  { method = "GET", body, signal, etag } = {},
) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      signal: signal || AbortSignal.timeout(12000),
      headers: {
        ...(method === "GET" && etag ? { "If-None-Match": etag } : {}),
        ...(method !== "GET" ? { "X-Commit-Zero": "local-demo" } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw Object.assign(
      new Error(
        "Cannot reach the service. Check the connection and try again.",
      ),
      { status: 0 },
    );
  }
  if (response.status === 304) return null;
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.message || "The request could not be completed."),
      { status: response.status, details: data },
    );
  return data;
}
