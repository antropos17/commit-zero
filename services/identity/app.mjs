import { connectDatabase } from "../../server/database.mjs";
import { createBase, httpError } from "../base.mjs";
import { IdentityStore } from "./store.mjs";
import { registerAgentRoutes } from "./agents.mjs";
import { registerOAuth } from "./oauth.mjs";
const migrations = new URL("./migrations/", import.meta.url);
export const identityDatabase = (options = {}) =>
  connectDatabase({
    url: process.env.IDENTITY_DATABASE_URL || null,
    directory: process.env.IDENTITY_DATABASE_DIR || "runtime/identity",
    migrations,
    ...options,
  });
const cookieName = "cz_session";
const tokenOf = (request) =>
  (request.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
const cookie = (token, age = 604800) =>
  `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}`;
const profileFields = {
  displayName: { type: "string", minLength: 2, maxLength: 80, pattern: "\\S" },
  biography: { type: "string", maxLength: 500 },
};
const credentials = {
  username: { type: "string", pattern: "^[a-zA-Z0-9_-]{3,32}$" },
  password: { type: "string", minLength: 10, maxLength: 128 },
};
const body = (properties, required = Object.keys(properties)) => ({
  body: { type: "object", additionalProperties: false, properties, required },
});

export async function createIdentityApp({ db, oauth } = {}) {
  db ||= await identityDatabase();
  const app = await createBase();
  const store = new IdentityStore(db);
  app.addHook("onClose", () => db.close());
  const requireUser = async (request) => {
    const user = await store.session(tokenOf(request));
    if (!user) throw httpError(401, "Sign in to continue.");
    return user;
  };
  registerAgentRoutes(app, db, requireUser);
  registerOAuth(app, db, store, cookie, oauth);
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return { status: "ok", service: "identity", database: db.mode };
  });
  app.get("/api/auth/session", async (request) => ({
    user: await store.session(tokenOf(request)),
  }));
  for (const action of ["register", "login"])
    app.post(
      `/api/auth/${action}`,
      {
        schema: body(
          action === "register"
            ? { ...credentials, displayName: profileFields.displayName }
            : credentials,
        ),
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        const user = await store[action](request.body);
        const token = await store.issue(user);
        reply.header("Set-Cookie", cookie(token));
        return { user };
      },
    );
  app.post("/api/auth/logout", async (request, reply) => {
    await store.logout(tokenOf(request));
    reply.header("Set-Cookie", cookie("", 0));
    return { user: null };
  });
  app.get("/api/account", async (request) => {
    const user = await requireUser(request);
    return { user, bookmarks: await store.bookmarks(user.id) };
  });
  app.patch(
    "/api/account",
    { schema: body(profileFields) },
    async (request) => ({
      user: await store.update((await requireUser(request)).id, request.body),
    }),
  );
  app.put(
    "/api/account/bookmarks/:repo",
    {
      schema: {
        ...body({ saved: { type: "boolean" } }),
        params: {
          type: "object",
          required: ["repo"],
          properties: {
            repo: { type: "string", pattern: "^[a-z0-9-]{1,80}$" },
          },
        },
      },
    },
    async (request) => ({
      bookmarks: await store.bookmark(
        (await requireUser(request)).id,
        request.params.repo,
        request.body.saved,
      ),
    }),
  );
  return app;
}
