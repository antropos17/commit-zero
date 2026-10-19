# Local GitHub and Google sign-in

The identity service implements authorization-code sign-in for GitHub and Google.
No OAuth applications or credentials were supplied for this workspace. Provider
buttons stay disabled until both credentials for that provider are configured.
Local username/password accounts remain usable. Automated tests use a mocked
provider transport; they do not qualify a real provider login.

On the account page, **Refresh sign-in options** rereads this server's provider
configuration without reloading the local username/password draft. Failed or
malformed discovery shows unknown availability and keeps external buttons
disabled; it does not remove the local form or navigation. The refresh has scoped
busy state and restores keyboard entry while respecting another selected input.
A failed local sign-in or provider start also preserves the draft and its control.
This UI recovery is tested in disposable services; the configured-only fixture
and denied start do not establish actual GitHub/Google account access.

## Configure the local preview

1. Create an OAuth application in your own GitHub/Google account using the settings
   below. Complete any provider terms and consent configuration yourself.
2. If `.env` does not exist, copy `.env.example` to `.env`. If it already exists,
   preserve it and add only the missing settings. Never paste secrets into chat or
   commit them. The file is ignored by Git.
3. Set `OAUTH_ORIGIN=http://127.0.0.1:4173` and the chosen provider's
   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` or
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Stop the existing project server before starting another one on the same port.
   Build and start explicitly with the environment file:

   ```sh
   npm run build
   node --env-file=.env server/index.mjs
   ```

5. Open `http://127.0.0.1:4173/#/login`. The configured button becomes available.
   Sign in, confirm the displayed profile, reload, sign out, and sign in again to
   verify that the same provider subject retains its account and saved data.

`npm start` does not automatically load `.env`. The supervisor passes its process
environment to the child services. Use the exact configured host and port;
`localhost` and `127.0.0.1` have separate cookies. This build accepts only local
HTTP origins, without a trailing slash or path. Internet deployment requires a
separate TLS, cookie, authorization and deployment review.

## Provider settings

| Setting | GitHub OAuth App | Google OAuth client |
| --- | --- | --- |
| Application type | OAuth App | Web application |
| Homepage / JavaScript origin | `http://127.0.0.1:4173` | `http://127.0.0.1:4173` |
| Callback / authorized redirect URI | `http://127.0.0.1:4173/api/auth/oauth/github/callback` | `http://127.0.0.1:4173/api/auth/oauth/google/callback` |
| Requested scopes | `read:user` | `openid profile` |

GitHub: Settings → Developer settings → OAuth Apps → New OAuth App. Configure
the homepage and callback, then obtain the client ID and generate a client secret.
This is sign-in only; repository permissions are not requested.

Google Cloud: select/create a project, configure the OAuth consent screen and
audience in Google Auth Platform, then create a Web application client. Register
the exact redirect URI. For an External application in Testing, add the intended
Google account as a test user. No Gmail or Drive access is requested.

If choosing `localhost` or another local port, change `OAUTH_ORIGIN`, the listener
port, and the registered redirect URIs together. Do not use a production secret
for an unrelated development application.

## Identity and failure behavior

- Authorization uses random state, a browser-binding HttpOnly SameSite=Lax cookie,
  a ten-minute persisted single-use attempt, and PKCE S256. State and browser
  binding are stored as hashes. Callbacks use fixed same-origin destinations.
- The server exchanges the code and fetches the current profile directly from
  the provider. Accounts are keyed by `(provider, immutable subject)`. A matching
  email, display name or username never automatically links existing accounts.
  GitHub, Google and local-password identities therefore remain separate.
- Provider access tokens are not stored. The app issues its own revocable,
  expiring session. Provider-only accounts cannot use password login.
- Callback cancellation, expired/mismatched state and provider failures return
  a safe login message. Codes, tokens and raw provider errors are not echoed.
- The gateway preserves redirects, separate Set-Cookie headers and no-referrer
  callback policy. HTTP-only local cookies deliberately omit Secure.
- `GET /api/auth/providers` reports readiness without revealing credentials.
  A disabled button means credentials are missing, not a simulated login.

The integration suite covers browser/state binding, PKCE, replay rejection,
expiry, provider separation, repeated-account lookup, provider failures and
cookie/redirect forwarding. A successful real GitHub/Google callback remains an
explicit manual acceptance step after configuration.

References: [GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps),
[Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
