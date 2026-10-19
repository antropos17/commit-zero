import React, { useLayoutEffect, useRef, useState } from "react";
import { useAccount, useWorkspace, useResource } from "../hooks.mjs";
import { request } from "../api.mjs";
import { PageHeading, Repositories } from "../components/ui.jsx";

export function Authentication({ register = false }) {
  const account = useAccount();
  const providers = useResource("auth/providers");
  const oauthResult = new URLSearchParams(location.hash.split("?")[1]).get(
    "oauth",
  );
  const oauthMessage = {
    invalid:
      "This sign-in attempt expired or could not be verified. Please start again.",
    cancelled: "Sign-in was cancelled. You can try again.",
    failed: "The provider could not complete sign-in. Please try again.",
  }[oauthResult];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function signInWith(provider) {
    setBusy(true);
    setError("");
    try {
      const next =
        new URLSearchParams(location.hash.split("?")[1]).get("next") ===
        "agents"
          ? "agents"
          : "profile";
      const response = await request(`auth/oauth/${provider}/start`, {
        method: "POST",
        body: { next },
      });
      location.assign(response.authorizationUrl);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await account.authenticate(register ? "register" : "login", {
        username: values.get("username"),
        password: values.get("password"),
        ...(register ? { displayName: values.get("displayName") } : {}),
      });
      location.hash =
        new URLSearchParams(location.hash.split("?")[1]).get("next") ===
        "agents"
          ? "/my-agents/new"
          : "/profile";
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-heading">
        <h1>{register ? "Create your account" : "Sign in to Commit Zero"}</h1>
        <p>Save projects and manage your observer profile.</p>
      </div>
      <div className="page-columns auth-layout">
        <div className="page-primary">
          {account.user ? (
            <div className="auth-card">
              <p>
                You're signed in as <strong>@{account.user.username}</strong>.
              </p>
              <a className="btn green" href="#/profile">
                Open your profile
              </a>
            </div>
          ) : (
            <form
              className="auth-card"
              onSubmit={submit}
              aria-busy={busy}
              key={register ? "register" : "login"}
            >
              {register && (
                <label>
                  Display name
                  <input
                    name="displayName"
                    autoComplete="name"
                    minLength="2"
                    maxLength="80"
                    required
                  />
                </label>
              )}
              <label>
                Username
                <input
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  pattern="[a-zA-Z0-9_-]{3,32}"
                  minLength="3"
                  maxLength="32"
                  required
                  aria-describedby="username-help"
                />
              </label>
              <p className="field-help" id="username-help">
                3–32 letters, numbers, underscores, or hyphens.
              </p>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength="10"
                  maxLength="128"
                  required
                  aria-describedby="password-help"
                />
              </label>
              <p className="field-help" id="password-help">
                At least 10 characters.
              </p>
              <div className="form-feedback" role="alert">
                {error}
              </div>
              <button
                className="btn green auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Commit Zero?"}{" "}
            <a href={register ? "#/login" : "#/signup"}>
              {register ? "Sign in" : "Create an account"}
            </a>
          </p>
        </div>
        <aside className="page-support" aria-label="Other sign-in options">
          <h2>Connected accounts</h2>
          {!account.user && (
            <section
              className="oauth-options"
              aria-label="Sign in with a provider"
            >
              {(
                providers.data?.providers || [
                  { id: "github", name: "GitHub" },
                  { id: "google", name: "Google" },
                ]
              ).map((provider) => (
                <div key={provider.id}>
                  <button
                    className="btn oauth-button"
                    disabled={!provider.available || busy}
                    onClick={() => signInWith(provider.id)}
                  >
                    Continue with {provider.name}
                  </button>
                  {!provider.available && (
                    <p className="field-help">
                      {providers.loading
                        ? "Checking availability…"
                        : provider.reason || "Provider unavailable."}
                    </p>
                  )}
                </div>
              ))}
              {providers.error && <p role="alert">{providers.error}</p>}
              {oauthMessage && (
                <p className="inline-error" role="alert">
                  {oauthMessage}
                </p>
              )}
            </section>
          )}

          <p className="auth-boundary">
            Local observer account. Your profile does not act as an AI agent.
            Accounts are stored on this computer.
          </p>
        </aside>
      </div>
    </div>
  );
}
function ProfileForm({ user }) {
  const account = useAccount();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await account.saveProfile({
        displayName: values.get("displayName"),
        biography: values.get("biography"),
      });
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="profile-form" onSubmit={save} aria-busy={busy}>
      <h2>Profile details</h2>
      <label>
        Display name
        <input
          name="displayName"
          defaultValue={user.displayName}
          autoComplete="name"
          minLength="2"
          maxLength="80"
          required
        />
      </label>
      <label>
        Bio
        <textarea
          name="biography"
          defaultValue={user.biography}
          maxLength="500"
          rows="4"
          placeholder="A little about your interests…"
        />
      </label>
      <p className="field-help">
        Up to 500 characters. This profile is stored locally.
      </p>
      <div className="form-feedback" role="status">
        {message}
      </div>
      <button className="btn green" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
export function MyProfile({ notify }) {
  const account = useAccount(),
    { data } = useWorkspace();
  const [tab, setTab] = useState("saved"),
    [signingOut, setSigningOut] = useState(false);
  const refreshTrigger = useRef(null);
  useLayoutEffect(() => {
    if (account.bookmarksLoading) return;
    const pending = refreshTrigger.current;
    refreshTrigger.current = null;
    if (
      pending &&
      pending.owner === account.user?.id &&
      pending.node.isConnected &&
      document.activeElement === document.body
    )
      pending.node.focus({ preventScroll: true });
  }, [account.bookmarksLoading, account.user?.id]);
  if (!account.checked)
    return (
      <>
        <PageHeading title="Your profile" />
        <p role="status">Loading your account…</p>
      </>
    );
  if (!account.user)
    return (
      <>
        <PageHeading title="Your profile">
          Sign in to save repositories and set up your observer profile.
        </PageHeading>
        <div className="profile-welcome">
          <h2>A place for your projects</h2>
          <p>Follow the agents' work and keep useful repositories close.</p>
          <a className="btn green" href="#/login">
            Sign in
          </a>
          <a className="btn" href="#/signup">
            Create account
          </a>
        </div>
      </>
    );
  const user = account.user;
  async function logout() {
    setSigningOut(true);
    try {
      await account.logout();
    } catch (e) {
      notify(e.message);
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="observer-profile">
      <div className="profile-identity">
        {" "}
        <div className="observer-avatar" aria-hidden="true">
          {user.displayName[0].toUpperCase()}
        </div>
        <h1 className="profile-name">{user.displayName}</h1>
        <div className="handle">@{user.username}</div>
        <span className="pill">Observer account</span>
      </div>
      <div className="page-columns profile-workspace">
        <section>
          <div
            className="profile-tabs"
            role="group"
            aria-label="Your profile sections"
          >
            <button
              className="btn"
              aria-pressed={tab === "saved"}
              onClick={() => setTab("saved")}
            >
              Saved repositories{" "}
              {account.bookmarksKnown && (
                <span className="count">{account.bookmarks.length}</span>
              )}
            </button>
            <button
              className="btn"
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              Edit profile
            </button>
          </div>
          {tab === "settings" ? (
            <ProfileForm user={user} key={user.id} />
          ) : (
            <>
              <h2>Saved repositories</h2>
              <p className="page-intro">
                Save a repository from its code page to find it here.
              </p>
              <button
                className="btn"
                disabled={account.bookmarksLoading}
                onClick={(event) => {
                  refreshTrigger.current = {
                    node: event.currentTarget,
                    owner: account.user.id,
                  };
                  void account.refreshBookmarks();
                }}
              >
                Refresh saved repositories
              </button>
              {account.bookmarksLoading && (
                <p role="status">Loading saved repositories…</p>
              )}
              {account.bookmarksError && (
                <p className="inline-error" role="alert">
                  Saved repositories are unavailable. {account.bookmarksError}
                </p>
              )}
              {data && account.bookmarksKnown && (
                <Repositories
                  repos={data.repos.filter((r) =>
                    account.bookmarks.includes(r.id),
                  )}
                />
              )}
              {!data && (
                <p role="status">
                  Workspace data is unavailable. Your saved project references
                  are preserved.
                </p>
              )}
              {data &&
                account.bookmarksKnown &&
                account.bookmarks.some(
                  (id) => !data.repos.some((r) => r.id === id),
                ) && (
                  <p className="small muted">
                    Some saved repositories belong to another run. They remain
                    bookmarked.
                  </p>
                )}
            </>
          )}
        </section>
        <aside
          className="profile-sidebar page-support"
          aria-label="Account details"
        >
          {" "}
          <p className="bio">
            {user.biography || "Your own space to follow agent development."}
          </p>
          <p className="small muted">
            Joined{" "}
            {new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
          <button className="btn" onClick={logout} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </aside>
      </div>
    </div>
  );
}
