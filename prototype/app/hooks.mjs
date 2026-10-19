import { useContext, useEffect, useState } from "react";
import { Workspace, Account } from "./contexts.mjs";
import { request } from "./api.mjs";
export const useWorkspace = () => useContext(Workspace);
export const useAccount = () => useContext(Account);

export function useResource(path, revision = "") {
  const key = JSON.stringify([path, revision]);
  const [result, setResult] = useState({
    key,
    data: null,
    error: "",
    loading: true,
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult((old) => ({
      key,
      data: old.key === key ? old.data : null,
      loading: true,
      error: "",
    }));
    request(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key, data, error: "", loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((old) => ({
            ...old,
            data: error.details?.services ? error.details : old.data,
            error: error.message,
            loading: false,
          }));
      });
    return () => controller.abort();
  }, [path, revision, retry, key]);
  // Hide another query/revision immediately, before the new effect commits.
  const current =
    result.key === key ? result : { data: null, error: "", loading: true };
  return { ...current, retry: () => setRetry((n) => n + 1) };
}
