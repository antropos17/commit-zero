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
| Workspace unavailable after the page opens | The initial workspace request failed. Restore the local service, then use **Try again**. The settled error is not marked busy; keyboard retry returns focus to the main content after success. |
| Built UI is older than source | `npm start` serves `dist`; run `npm run build` after source changes, or use `npm run dev` for development. |
| **Run agents** is disabled | Check that the task has text, the project is active, no task is running, and **Check model** reports available. Start the local provider if it is offline. |
| Health request fails | Check gateway and provider terminals, then select **Check model** again. The draft remains in the form. |
| Project address is already in use | The form retains its name and description; choose another address and submit again. No duplicate project is created. |
| Saving a scenario repository is rate limited | The repository shows a persistent message beside **Save**. Wait briefly and select **Save** again; a failed request does not add a bookmark. |
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
