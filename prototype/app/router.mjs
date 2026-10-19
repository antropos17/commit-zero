import { useSyncExternalStore } from "react";
let current = location.hash || "#/discover";
let previous = current;
let pendingLink = null;
let intent = "history";
export const navigationIntent = () => intent;
const onLink = (event) => {
  pendingLink = null;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = event.target.closest?.('a[href^="#/"]');
  if (
    link &&
    !link.hasAttribute("download") &&
    (!link.target || link.target === "_self")
  )
    pendingLink = link.getAttribute("href");
};
document.addEventListener("click", onLink);
const listeners = new Set();
export const routeScroll = import.meta.hot?.data.routeScroll || new Map();
export const routeGroup = (value) => {
  const base = value.split("?")[0].split("/").slice(0, 3).join("/");
  const { segments, query } = parseRoute(value);
  if (segments[0] === "commons") {
    const detail =
      query.get("view") === "changes"
        ? "pull"
        : query.get("view") === "versions"
          ? "version"
          : query.get("view") === "tasks"
            ? "task"
            : null;
    if (detail && query.has(detail))
      return `${base}?${detail}=${encodeURIComponent(query.get(detail))}`;
  }
  return base;
};
window.history.scrollRestoration = "manual";
const onHashChange = () => {
  routeScroll.set(current, window.scrollY);
  previous = current;
  current = location.hash || "#/discover";
  intent = pendingLink === current ? "link" : "history";
  pendingLink = null;
  for (const listener of listeners) listener();
};
window.addEventListener("hashchange", onHashChange);
if (import.meta.hot)
  import.meta.hot.dispose((data) => {
    data.routeScroll = routeScroll;
    window.removeEventListener("hashchange", onHashChange);
    document.removeEventListener("click", onLink);
  });
export const previousRoute = () => previous;
// Update a filter URL without adding one history entry for every keystroke.
// replaceState does not emit hashchange, so notify the shared route store here.
export function replaceRoute(next) {
  if (next === current) return;
  const replaced = current;
  window.history.replaceState(window.history.state, "", next);
  onHashChange();
  routeScroll.delete(replaced);
  routeScroll.set(current, window.scrollY);
}
export function useRoute() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
export function parseRoute(raw) {
  const [pathname, query = ""] = raw.slice(1).split("?");
  try {
    return {
      segments: pathname.split("/").filter(Boolean).map(decodeURIComponent),
      query: new URLSearchParams(query),
    };
  } catch {
    return { segments: ["missing"], query: new URLSearchParams() };
  }
}
export const path = (kind, id, tab) =>
  `#/${kind}${id ? "/" + encodeURIComponent(id) : ""}${tab ? "/" + tab : ""}`;
