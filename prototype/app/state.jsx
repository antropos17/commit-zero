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
    [bookmarksKnown, setBookmarksKnown] = useState(false),
    [bookmarksLoading, setBookmarksLoading] = useState(false),
    [bookmarksError, setBookmarksError] = useState(""),
    [checked, setChecked] = useState(false);
  const currentUser = useRef(null),
    identityVersion = useRef(0),
    bookmarkVersion = useRef(0),
    bookmarkQueue = useRef(Promise.resolve());
  const installIdentity = useCallback((next) => {
    identityVersion.current++;
    bookmarkVersion.current++;
    bookmarkQueue.current = Promise.resolve();
    currentUser.current = next;
    setUser(next);
    setBookmarks([]);
    setBookmarksKnown(false);
    setBookmarksLoading(false);
    setBookmarksError("");
    setChecked(true);
  }, []);
  const refreshBookmarks = useCallback(async () => {
    const owner = currentUser.current?.id;
    if (!owner) return { applied: false };
    const identity = identityVersion.current,
      revision = ++bookmarkVersion.current;
    const isCurrent = () =>
      currentUser.current?.id === owner &&
      identityVersion.current === identity &&
      bookmarkVersion.current === revision;
    setBookmarksLoading(true);
    setBookmarksError("");
    try {
      const result = await request("account");
      if (!isCurrent()) return { applied: false };
      if (result.user?.id !== owner || !Array.isArray(result.bookmarks))
        throw new Error(
          "The account response does not match this session. Sign in again.",
        );
      setBookmarks(result.bookmarks);
      setBookmarksKnown(true);
      setBookmarksLoading(false);
      return { applied: true, ok: true };
    } catch (error) {
      if (!isCurrent()) return { applied: false };
      setBookmarksError(error.message);
      setBookmarksLoading(false);
      return { applied: true, ok: false };
    }
  }, []);
  useEffect(() => {
    let active = true;
    const identity = identityVersion.current;
    request("auth/session")
      .then((session) => {
        if (!active || identityVersion.current !== identity) return;
        installIdentity(session.user);
        if (session.user) void refreshBookmarks();
      })
      .catch(() => {
        if (active && identityVersion.current === identity) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [installIdentity, refreshBookmarks]);
  const authenticate = async (action, body) => {
    const result = await request(`auth/${action}`, { method: "POST", body });
    installIdentity(result.user);
    // Authentication succeeds independently of the optional saved-list read.
    void refreshBookmarks();
  };
  const logout = async () => {
    const identity = identityVersion.current;
    await request("auth/logout", { method: "POST" });
    if (identityVersion.current === identity) installIdentity(null);
  };
  const saveProfile = async (body) => {
    const identity = identityVersion.current,
      owner = currentUser.current?.id;
    const result = await request("account", { method: "PATCH", body });
    if (identityVersion.current !== identity || result.user?.id !== owner)
      return;
    currentUser.current = result.user;
    setUser(result.user);
  };
  const bookmark = (repo, saved) => {
    const identity = identityVersion.current,
      owner = currentUser.current?.id;
    const isCurrent = () => owner && identityVersion.current === identity &&
      currentUser.current?.id === owner;
    // Responses contain full lists without revisions. Serialize this session's
    // explicit writes so a delayed earlier response cannot undo a later list.
    const operation = bookmarkQueue.current.then(async () => {
      if (!isCurrent()) return { applied: false };
      const result = await request(
        `account/bookmarks/${encodeURIComponent(repo)}`,
        { method: "PUT", body: { saved } },
      );
      if (!isCurrent()) return { applied: false };
      // A read captured before this completed write must never replace its result.
      bookmarkVersion.current++;
      setBookmarks(result.bookmarks);
      setBookmarksKnown(true);
      setBookmarksLoading(false);
      setBookmarksError("");
      return { applied: true };
    });
    // Keep the caller's error, while allowing the next explicit save to proceed.
    bookmarkQueue.current = operation.catch(() => {});
    return operation;
  };
  return (
    <Account.Provider
      value={{
        user,
        checked,
        bookmarks,
        bookmarksKnown,
        bookmarksLoading,
        bookmarksError,
        refreshBookmarks,
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
