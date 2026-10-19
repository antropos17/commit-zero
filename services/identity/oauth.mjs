import { randomBytes, createHash } from "node:crypto";
import { httpError } from "../base.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const providers = {
  github: {
    name: "GitHub",
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    profile: "https://api.github.com/user",
    scope: "read:user",
  },
  google: {
    name: "Google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profile: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid profile",
  },
};
export function oauthConfig(env = process.env) {
  const origin = env.OAUTH_ORIGIN || "http://127.0.0.1:4173";
  const url = new URL(origin);
  // This build is local-only. A public deployment needs its own access policy.
  if (
    url.origin !== origin ||
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("OAUTH_ORIGIN must be a local HTTP origin without a path.");
  return {
    origin,
    providers: Object.fromEntries(
      Object.keys(providers).map((id) => [
        id,
        {
          clientId: env[`${id.toUpperCase()}_CLIENT_ID`] || "",
          clientSecret: env[`${id.toUpperCase()}_CLIENT_SECRET`] || "",
        },
      ]),
    ),
  };
}
function browserToken(request, id) {
  return (
    (request.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`cz_oauth_${id}=`))
      ?.split("=")[1] || ""
  );
}
const bindingCookie = (id, value, age = 600) =>
  `cz_oauth_${id}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/oauth/${id}/callback; Max-Age=${age}`;

export function registerOAuth(
  app,
  db,
  store,
  sessionCookie,
  { config = oauthConfig(), transport = fetch } = {},
) {
  const available = (id) =>
    Boolean(
      config.providers[id]?.clientId && config.providers[id]?.clientSecret,
    );
  app.get("/api/auth/providers", async () => ({
    providers: Object.entries(providers).map(([id, p]) => ({
      id,
      name: p.name,
      available: available(id),
      reason: available(id) ? null : "Not configured on this server.",
    })),
  }));
  const params = {
    type: "object",
    required: ["provider"],
    properties: { provider: { enum: Object.keys(providers) } },
  };
  app.post(
    "/api/auth/oauth/:provider/start",
    {
      schema: {
        params,
        body: {
          type: "object",
          additionalProperties: false,
          properties: { next: { enum: ["profile", "agents"] } },
          required: ["next"],
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const id = request.params.provider;
      if (!available(id))
        throw httpError(503, "OAuth provider is not configured.");
      // The redirect origin is configuration, never derived from forwarded headers.
      const browserOrigin =
        request.headers["x-cz-browser-origin"] || request.headers.origin;
      if (browserOrigin && browserOrigin !== config.origin)
        throw httpError(400, "Open the configured OAuth origin to sign in.");
      const state = random(),
        browser = random(),
        verifier = random();
      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM oauth_attempts WHERE expires_at <= now()");
        await tx.query("INSERT INTO oauth_attempts VALUES($1,$2,$3,$4,$5,$6)", [
          digest(state),
          digest(browser),
          id,
          verifier,
          request.body.next,
          new Date(Date.now() + 600000),
        ]);
      });
      const url = new URL(providers[id].authorize);
      url.search = new URLSearchParams({
        client_id: config.providers[id].clientId,
        redirect_uri: `${config.origin}/api/auth/oauth/${id}/callback`,
        response_type: "code",
        scope: providers[id].scope,
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      reply.header("Set-Cookie", bindingCookie(id, browser));
      return { authorizationUrl: url.href };
    },
  );
  app.get(
    "/api/auth/oauth/:provider/callback",
    {
      schema: {
        params,
        querystring: {
          type: "object",
          properties: {
            state: { type: "string", maxLength: 128 },
            code: { type: "string", maxLength: 2048 },
            error: { type: "string", maxLength: 256 },
          },
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const id = request.params.provider,
        { state = "", code, error } = request.query;
      reply.header("Referrer-Policy", "no-referrer");
      const browser = browserToken(request, id);
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(state) ||
        !/^[A-Za-z0-9_-]{43}$/.test(browser)
      )
        return reply.redirect("/#/login?oauth=invalid", 303);
      const attempt = (
        await db.query(
          "DELETE FROM oauth_attempts WHERE state_hash=$1 AND browser_hash=$2 AND provider=$3 AND expires_at>now() RETURNING *",
          [digest(state), digest(browser), id],
        )
      ).rows[0];
      reply.header("Set-Cookie", bindingCookie(id, "", 0));
      if (!attempt) return reply.redirect("/#/login?oauth=invalid", 303);
      if (error) return reply.redirect("/#/login?oauth=cancelled", 303);
      if (!code || !available(id))
        return reply.redirect("/#/login?oauth=failed", 303);
      try {
        const fetchJson = async (url, options) => {
          const response = await transport(url, {
            ...options,
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error("Provider request failed");
          return response.json();
        };
        const token = await fetchJson(providers[id].token, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: config.providers[id].clientId,
            client_secret: config.providers[id].clientSecret,
            code,
            code_verifier: attempt.verifier,
            redirect_uri: `${config.origin}/api/auth/oauth/${id}/callback`,
          }).toString(),
        });
        if (
          typeof token.access_token !== "string" ||
          !token.access_token ||
          token.error
        )
          throw new Error("No access token");
        // Resolve identity directly at the provider on every login. Never trust browser profile data,
        // link by email, decode an unverified ID token, or retain provider credentials.
        const profile = await fetchJson(providers[id].profile, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: "application/json",
            "User-Agent": "Commit-Zero",
          },
        });
        const subject =
          id === "github"
            ? Number.isSafeInteger(profile.id) && profile.id > 0
              ? String(profile.id)
              : ""
            : profile.sub;
        if (typeof subject !== "string" || !subject || subject.length > 255)
          throw new Error("Missing subject");
        const displayName = String(
          profile.name || profile.login || providers[id].name + " observer",
        )
          .trim()
          .slice(0, 80);
        const user = await store.external(
          id,
          subject,
          displayName.length >= 2
            ? displayName
            : providers[id].name + " observer",
        );
        const session = await store.issue(user);
        reply.header("Set-Cookie", sessionCookie(session));
        return reply.redirect(
          attempt.destination === "agents" ? "/#/my-agents/new" : "/#/profile",
          303,
        );
      } catch {
        // Never place provider tokens, codes, errors, or profile payloads in logs/URLs.
        return reply.redirect("/#/login?oauth=failed", 303);
      }
    },
  );
}
