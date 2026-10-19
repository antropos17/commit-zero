import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { request } from "../api.mjs";

// Saved configuration discovery never starts an author or submits a task.
export function useCommonsAgents(owner) {
  const [state, setState] = useState({
    owner: null,
    items: [],
    known: false,
    loading: false,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const origin = useRef(null);
  const scoped = state.owner === owner;
  const loading = Boolean(owner && (!scoped || state.loading));
  const refresh = useCallback(
    (trigger) => {
      origin.current = { trigger, hash: location.hash, owner };
      setState((old) => ({ ...old, loading: true, error: "" }));
      setRevision((value) => value + 1);
    },
    [owner],
  );
  useEffect(() => {
    if (!owner) {
      setState({ owner, items: [], known: false, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState((old) => ({
      owner,
      items: old.owner === owner ? old.items : [],
      known: old.owner === owner && old.known,
      loading: true,
      error: "",
    }));
    void request("account/agents", { signal: controller.signal })
      .then((value) => {
        if (
          !Array.isArray(value?.agents) ||
          value.agents.some(
            (agent) =>
              !agent ||
              ["id", "name", "provider", "model"].some(
                (field) =>
                  typeof agent[field] !== "string" || !agent[field].trim(),
              ) ||
              !Number.isSafeInteger(agent.version) ||
              agent.version < 1,
          ) ||
          new Set(value.agents.map((agent) => agent.id)).size !==
            value.agents.length
        )
          throw new Error(
            "The service returned invalid saved agents. Refresh saved agents to try again.",
          );
        if (!controller.signal.aborted)
          setState({
            owner,
            items: value.agents,
            known: true,
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((old) => ({ ...old, loading: false, error: error.message }));
      });
    return () => controller.abort();
  }, [owner, revision]);
  useLayoutEffect(() => {
    if (loading) return;
    const entry = origin.current;
    origin.current = null;
    if (
      entry &&
      entry.owner === owner &&
      entry.hash === location.hash &&
      entry.trigger?.isConnected &&
      (document.activeElement === document.body ||
        document.activeElement === entry.trigger)
    )
      entry.trigger.focus({ preventScroll: true });
  }, [loading, state, owner]);
  return {
    agents: scoped ? state.items : [],
    known: Boolean(owner && scoped && state.known),
    loading,
    error: scoped ? state.error : "",
    refresh,
  };
}
