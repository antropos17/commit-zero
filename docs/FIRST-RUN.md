# First run and recovery

Commit Zero is a local application. It binds its gateway to loopback and retains
workspace and account data on this machine. The included repository example is
deterministic; a fresh Commons workspace has no completed model tasks.

## Start and inspect without a model

1. Install Node.js 24.11 or newer within Node 24, npm and Git. Run `npm ci`,
   `npm run doctor`, then `npm run dev` in the cloned repository.
2. Open `http://127.0.0.1:4173/`. Use **Repositories**, **Pull requests** and
   **Timeline** to inspect the saved example. Its activity is simulated and is
   labelled separately from actual Commons and Language lab work.
3. Open **Agent workspace**. Create a project and issue, add a chat message, and
   prepare a task. These actions persist locally and require no model call.
4. Open **Proposed roles** to inspect disabled candidate profiles. They cannot
   start tasks or spend provider credits. [Role evidence](AGENT-CATALOG.md).

For a disposable, model-free reproduction of conflict, review, cancellation and
recovery, run `npm run simulate:commons -- --seed 17` in a separate terminal.
It uses isolated fixture actors and does not modify a saved user run.
[Simulation scope](SIMULATIONS.md).

The [PR diff capture](media/scenario-pr-2026-10-19.png) is an actual Chrome
capture after completing the deterministic ten-step example in disposable
services. Conversation, checks and changed files remain inspectable after merge.
Use **Next step** with Enter or Space to continue from the same control. At the
last step, focus returns to content. **New run** preserves the completed run's
export. **Pause cycle** stops future scheduled steps; a step already sent to the
service can finish. A failed step never advances the view optimistically, and
**Retry** refreshes the saved state without repeating the write.
At narrow widths, focus the code region and use arrow keys or swipe sideways to
read complete lines. Scenario checks are predefined results, not executed code.

## Enable reviewed local proposals

On Windows x64 with PowerShell 7, Vulkan-compatible hardware and sufficient
RAM/VRAM for the documented 7B model, use `npm run model:setup` once and keep
`npm run model:start` running in a second terminal. Check the hardware, disk,
download and provider details in [Language lab setup](LANGUAGE-LAB.md#start-on-windows).
Return to the Commons task form and choose **Check model**. An available provider
enables **Run agents** for a nonempty task; a busy or unavailable provider leaves
the draft intact. A failed health request is displayed separately. Task execution
still requires explicit action and a second server-side readiness check.

The Builder proposes one bounded JavaScript file and the Reviewer evaluates the
exact patch in a separate local call. Inspect the retained source, parser result,
review and receipts before deciding whether to merge. A parse pass and approval
do not establish runtime correctness. [Complete workflow](COMMONS.md).

## Diagnose common stops

| Observation | Check and recovery |
| --- | --- |
| Gateway does not open | Run `npm run doctor`; check the terminal that runs `npm run dev`. Port 4173 must be free for this project. Do not remove a database lock to force startup. |
| Workspace unavailable after the page opens | The initial workspace request failed. Restore the local service, then use **Try again**. The settled error is not busy. Retry restores keyboard entry unless you choose another control or route while waiting. |
| Need diagnostics while workspace data is unavailable | Open **Environment**; service checks and execution requirements remain accessible. **Refresh workspace** in the toolbar retries the snapshot; **Refresh health** separately updates service status. |
| Service health cannot be loaded or refreshed | Use **Refresh health** or the inline **Try again**. Failure stops the checking indicator. A retained result is marked as the last available health until a successful refresh replaces it. |
| Rankings are unavailable | Restore the service and select **Try again** or **Refresh**. A failed category read never reuses scores from another category. Same-category refresh failures label the last available rows; an empty search is separate. |
| Rankings do not match the saved scenario | Another client may have changed the run or revision. Use **Refresh workspace** in the toolbar, then retry rankings if needed. Mismatched rows stay hidden. |
| A request times out or returns invalid JSON | The browser reports a recoverable error. Restore the service and retry the read; a failed write is never retried automatically. Ordinary UI requests have a 12-second active-browser-time deadline, including body reads, alongside route cancellation. |
| External sign-in options are unknown or failed to load | Use **Refresh sign-in options** in the account page. The local username/password draft stays in place. Unknown or malformed provider data never enables external sign-in. Configured options still require a real OAuth flow; this read does not verify account access. |
| Commons cannot reach the service | Restore the local gateway, then use **Retry**. The error settles without a busy announcement; Retry is disabled while its request is pending. Background polling can also recover once the service returns. |
| Built UI is older than source | `npm start` serves `dist`; run `npm run build` after source changes, or use `npm run dev` for development. |
| **Run agents** is disabled | Check that the task has text, the project is active, no task is running, and **Check model** reports available. Start the local provider if it is offline. |
| Model health request fails | Check gateway and provider terminals, then select **Check model** again. The draft remains in the form. |
| Project address is already in use | The form retains its name and description; choose another address and submit again. No duplicate project is created. |
| Saving a scenario repository is rate limited | The repository shows a persistent message beside **Save**. Wait briefly and select **Save** again; a failed request does not add a bookmark. |
| Saved repositories are unavailable after sign-in | Your sign-in succeeded. Restore the service and select **Refresh saved repositories** on **My profile**. An unknown list is not shown as empty; a previously loaded list remains visible if refresh fails. |
| Saving several repositories while navigating | Saves from this page session finish in order. The busy button and Saving status persist until that repository's action finishes. A failed save is not retried automatically; another explicitly requested save can proceed. Signing out cancels saves that have not yet been sent. Use **Refresh saved repositories** to reconcile changes from another tab. |
| Task fails or is cancelled | Inspect its retained timeline and raw receipt. Retry by explicitly starting a new task; a restarted server does not silently retry jobs. |
| Provider setup is unavailable | Continue exploring the deterministic example and model-free Commons forms. Do not interpret these as actual model contributions. |

`npm run diagnostics` reports workspace storage use and bounded diagnostic cleanup;
it preserves databases, backups and verification receipts. For code changes, follow
the focused and full gates in [development](DEVELOPMENT.md). Public hosted service
and arbitrary generated-code execution are outside the current release scope;
see [release boundaries](RELEASE.md).

The [narrow bookmark error capture](media/bookmark-rate-limit-2026-10-19.png)
comes from a real Chrome run against disposable services with one routed HTTP
429 fixture. It shows the visible recovery message; the fixture then retried
against the local service and received HTTP 200. It is not a production load
test or evidence of a model run.

The [initial unavailable-workspace capture](media/workspace-unavailable-2026-10-19.png)
comes from an actual Chrome run with one routed HTTP 503 on the initial state
read. The same test reaches the real local service with HTTP 200 after keyboard
Retry, verifies focus returns to main and keeps all navigation visible. It uses
disposable services and starts no model work.

The [saved-list failure capture](media/account-unavailable-2026-10-19.png) shows
an actual Chrome registration against disposable identity services, followed by
one routed HTTP 503 for the optional list. Registration still succeeds; keyboard
Refresh then receives HTTP 200. Separate held-response fixtures check that a
completed bookmark write and a different user's list cannot be overwritten by
an older read. No retained account data or model activity is used.

The [service-health failure capture](media/service-health-unavailable-2026-10-19.png)
is an actual Chrome viewport after a routed connection failure. The
[narrow dark capture](media/service-health-last-known-2026-10-19.png) follows a
real HTTP 200 from disposable services, then a routed HTTP 503; retained `ok`
rows are explicitly qualified as the last available result. The browser test
recovers through the real health handler, checks keyboard focus and preserves
the exact scenario step without reset/advance requests. These captures establish
neither a production outage nor code-sandbox/model qualification.

An unexpected page render failure leaves the header and permanent navigation
available. Use **Try this page again** to repeat the page's initial reads, or
open **Environment** to inspect services. A later visit also clears the failed
page state. Errors outside the page can still require **Reload workspace**.
The [actual narrow recovery capture](media/page-error-contained-2026-10-19.png)
uses a deliberately malformed Language lab read in disposable services. The
fixture then recovers through the real read handler, retains the shell search
draft and checks unchanged scenario revision and zero write/model requests.
