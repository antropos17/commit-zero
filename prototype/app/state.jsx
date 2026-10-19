import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { request } from "./api.mjs";
import { Workspace, Account } from "./contexts.mjs";

export function WorkspaceProvider({ children }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const current = useRef(null),
    inFlight = useRef(null),
    syncFlight = useRef(null),
    anchor = useRef(null);
  const receive = useCallback((next) => {
    const old = current.current;
    if (old?.runId === next.runId && old.version === next.version) return;
    if (old?.runId === next.runId && old.version > next.version) return;
    if (window.scrollY > 200) {
      const node = [...document.querySelectorAll("[data-event]")].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < innerHeight;
      });
      if (node)
        anchor.current = {
          key: node.dataset.event,
          route: location.hash,
          top: node.getBoundingClientRect().top,
        };
    }
    current.current = next;
    setData(next);
  }, []);
  const perform = useCallback(
    (action = "state") => {
      if (inFlight.current) return inFlight.current;
      setBusy(true);
      setError("");
      const body =
        action === "state"
          ? undefined
          : { runId: current.current.runId, version: current.current.version };
      inFlight.current = request(action, {
        method: body ? "POST" : "GET",
        body,
      })
        .then((next) => {
          receive(next);
          return next;
        })
        .catch(async (err) => {
          setPlaying(false);
          setError(err.message);
          if (err.status === 409)
            await request("state")
              .then(receive)
              .catch(() => {});
        })
        .finally(() => {
          inFlight.current = null;
          setBusy(false);
        });
      return inFlight.current;
    },
    [receive],
  );
  const quietRefresh = useCallback(() => {
    if (inFlight.current || syncFlight.current) return;
    const baseline = current.current;
    syncFlight.current = request("state")
      .then((next) => {
        // A background read must never consume a user action or replace a newer run.
        if (!inFlight.current && current.current === baseline) receive(next);
      })
      .catch(() => {})
      .finally(() => {
        syncFlight.current = null;
      });
    return syncFlight.current;
  }, [receive]);
  useEffect(() => {
    void perform();
  }, [perform]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (!playing || busy || !data) return;
    if (data.step >= 10) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => void perform("advance"), 1800);
    return () => clearTimeout(timer);
  }, [playing, busy, data, perform]);
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const saved = anchor.current;
    anchor.current = null;
    if (saved.route !== location.hash) return;
    const node = [...document.querySelectorAll("[data-event]")].find(
      (el) => el.dataset.event === saved.key,
    );
    if (node)
      window.scrollBy({
        top: node.getBoundingClientRect().top - saved.top,
        behavior: "instant",
      });
  }, [data]);
  return (
    <Workspace.Provider
      value={{
        data,
        busy,
        error,
        playing,
        setPlaying,
        refresh: (silent = false) =>
          silent === true ? quietRefresh() : perform(),
        advance: () => perform("advance"),
        newRun: () => perform("runs"),
        clearError: () => setError(""),
      }}
    >
      {children}
    </Workspace.Provider>
  );
}

export function AccountProvider({ children }) {
  const [user, setUser] = useState(null),
    [bookmarks, setBookmarks] = useState([]),
    [checked, setChecked] = useState(false);
  const refresh = useCallback(async () => {
    const session = await request("auth/session");
    setUser(session.user);
    if (session.user) setBookmarks((await request("account")).bookmarks);
    else setBookmarks([]);
    setChecked(true);
  }, []);
  useEffect(() => {
    refresh().catch(() => setChecked(true));
  }, [refresh]);
  const authenticate = async (action, body) => {
    const result = await request(`auth/${action}`, { method: "POST", body });
    setUser(result.user);
    setChecked(true);
    setBookmarks((await request("account")).bookmarks);
  };
  const logout = async () => {
    await request("auth/logout", { method: "POST" });
    setUser(null);
    setBookmarks([]);
  };
  const saveProfile = async (body) => {
    const result = await request("account", { method: "PATCH", body });
    setUser(result.user);
  };
  const bookmark = async (repo, saved) => {
    const result = await request(
      `account/bookmarks/${encodeURIComponent(repo)}`,
      { method: "PUT", body: { saved } },
    );
    setBookmarks(result.bookmarks);
  };
  return (
    <Account.Provider
      value={{
        user,
        checked,
        bookmarks,
        authenticate,
        logout,
        saveProfile,
        bookmark,
      }}
    >
      {children}
    </Account.Provider>
  );
}
