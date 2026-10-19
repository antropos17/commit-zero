import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
import axe from "axe-core";
import { createTestSystem } from "./harness.mjs";
import { playArena } from "../server/lab/arena-engine.mjs";
async function until(check) {
  for (let i = 0; i < 250; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (check()) return;
  }
  throw new Error("DOM state did not settle");
}

test("Visual arena replays actual traces, freezes live view, resumes and labels cancelled streams accessibly", async (t) => {
  const system = await createTestSystem();
  t.after(() => system.close());
  const language = {
    name: "Test arena language",
    description: "DOM fixture",
    functions: [
      {
        name: "score",
        params: ["a", "b"],
        body: ["if", ["eq", "a", 0], 0, ["sub", "a", "b"]],
      },
      { name: "sum", params: ["a", "b"], body: ["add", "a", "b"] },
      { name: "modulo", params: ["a", "b"], body: ["mod", "a", "b"] },
    ],
  };
  const game = {
    name: "DOM fixture game",
    description: "Test-only resource game",
    actions: ["Mine", "Guard", "Raid"],
    costs: [0, 2, 4],
    energyCap: 5,
    recharge: 1,
    phaseLength: 3,
    payoffs: [
      [0, 2, -3, -2, 0, 1, 3, -1, 0],
      [0, -2, 3, 2, 0, -1, -3, 1, 0],
    ],
  };
  const strategies = [
    {
      name: "Test one",
      explanation: "Test only",
      score: ["sum", "counter", 0],
      temperature: 1,
    },
    {
      name: "Test two",
      explanation: "Test only",
      score: ["score", 1, "cost"],
      temperature: 1,
    },
  ];
  const artifact = "arena-match-g0-0.json",
    id = "00000000-0000-4000-8000-000000000001";
  const match = {
    ...playArena(language, game, strategies, 21),
    gameRules: game,
    strategies,
    players: [0, 1],
    generation: 0,
  };
  const start = {
    sequence: 1,
    actor: "arena",
    kind: "match-start",
    message: "Test broadcast",
    data: {
      matchId: artifact,
      gameRules: game,
      players: [0, 1],
      generation: 0,
      strategyNames: strategies.map((s) => s.name),
    },
  };
  const event = {
    sequence: 2,
    actor: "arena",
    kind: "match",
    message: "Test match completed",
    data: { artifact, generation: 0, players: [0, 1], game: game.name },
  };
  const run = {
    id,
    status: "completed",
    version: 2,
    provenance: "test_fixture",
    summary: {
      mode: "arena",
      learningProtocol: "model-revision-v5",
      routingResults: [
        {
          generation: 1,
          player: 0,
          specialists: 2,
          strengths: [["Fixture rules"]],
          before: 20,
          after: 23,
          accepted: true,
        },
      ],
      transfer: [
        {
          player: 0,
          results: [{ scope: "both-new", before: 20, after: 24, matches: 24 }],
        },
      ],
    },
    events: [start, event],
    artifacts: [{ name: artifact }],
  };
  let reads = 0;
  const html = await readFile("dist/index.html", "utf8"),
    script = await readFile(
      "dist" + html.match(/src="([^"]+\.js)"/)[1],
      "utf8",
    );
  const errors = [],
    console = new VirtualConsole();
  console.on("jsdomError", (e) => {
    if (!e.message.includes("Not implemented")) errors.push(e.message);
  });
  const dom = new JSDOM(html, {
    url: `http://localhost/#/lab/${id}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  t.after(() => dom.window.close());
  const { window } = dom,
    doc = window.document;
  window.scrollTo = () => {};
  window.scrollBy = () => {};
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.fetch = async (url, options = {}) => {
    if (String(url) === "/api/lab")
      return new Response(
        JSON.stringify({ provider: { available: false }, runs: [run] }),
      );
    if (String(url) === `/api/lab/runs/${id}`) {
      reads++;
      return new Response(JSON.stringify(run));
    }
    if (String(url) === `/api/lab/runs/${id}/artifacts/${artifact}`)
      return new Response(
        JSON.stringify({ content: match, sha256: "fixture" }),
      );
    const response = await system.gateway.inject({
      url: String(url),
      method: options.method || "GET",
      payload: options.body,
      headers: { host: "localhost", ...options.headers },
    });
    return new Response(response.body || null, {
      status: response.statusCode,
      headers: response.headers,
    });
  };
  window.eval(script);
  await until(() => doc.querySelector(".spectator-rounds button"));
  assert.equal(doc.querySelector(".spectator-report details"), null);
  assert.match(
    doc.querySelector('[aria-label="Specialist selection"]').textContent,
    /Fixture rules/,
  );
  assert.match(
    doc.querySelector('[aria-label="Specialist selection"]').textContent,
    /Installed/,
  );
  assert.match(
    doc.querySelector('[aria-label="Unseen evaluation"]').textContent,
    /Both new/,
  );
  assert.match(
    doc.querySelector('[aria-label="Unseen evaluation"]').textContent,
    /never offered as strategy candidates/,
  );
  const button = (text) =>
    [...doc.querySelectorAll(".arena-theater button")].find(
      (b) => b.textContent === text,
    );
  doc.querySelectorAll(".spectator-rounds button")[3].click();
  await until(() =>
    doc.querySelector(".spectator-phase").textContent.includes("Phase 2"),
  );
  assert.equal(
    Number(doc.querySelector('[role="meter"]').getAttribute("aria-valuenow")),
    match.rounds[3].after[0],
  );
  button("Play recording").click();
  await until(() =>
    doc.querySelector(".spectator-score").textContent.includes("round 5"),
  );
  button("Pause").click();
  run.status = "running";
  run.version++;
  run.events = [
    start,
    {
      sequence: 2,
      actor: "arena",
      kind: "round",
      message: "Round 1",
      data: { matchId: artifact, round: match.rounds[0] },
    },
  ];
  const before = reads;
  await until(() => reads > before);
  button("Follow live").click();
  await until(() => button("Freeze view"));
  button("Freeze view").click();
  run.version++;
  run.events.push({
    sequence: 3,
    actor: "arena",
    kind: "round",
    message: "Round 2",
    data: { matchId: artifact, round: match.rounds[1] },
  });
  const frozenRead = reads;
  await until(() => reads > frozenRead);
  assert.match(
    doc.querySelector(".spectator-score").textContent,
    /round 1 \/ 24/,
  );
  button("Resume live").click();
  await until(() =>
    doc.querySelector(".spectator-score").textContent.includes("round 2 / 24"),
  );
  run.status = "cancelled";
  run.version++;
  await until(() =>
    doc.querySelector(".spectator-status").textContent.includes("cancelled"),
  );
  window.eval(axe.source);
  const audit = await window.axe.run(doc, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
  run.status = "failed";
  run.version++;
  run.events = [];
  window.location.hash = "/home";
  await until(() => !doc.querySelector(".arena-theater"));
  window.location.hash = `/lab/${id}`;
  await until(
    () =>
      doc.querySelector(".spectator-status")?.textContent === "No recordings",
  );
  assert.match(
    doc.querySelector(".spectator-empty").textContent,
    /No recorded matches/,
  );
  assert.equal(doc.querySelectorAll('[aria-label="Arena match"]').length, 0);
  assert.equal(button("Recordings (0)").disabled, true);
  assert.deepEqual(errors, []);
});

test("React workspace preserves reading state, completes the scenario, and supports accounts and rankings", async (t) => {
  const system = await createTestSystem({
    commons: {
      model: {
        name: "failure-fixture-not-a-model",
        provenance: "test_fixture",
        ready: async () => ({ available: true }),
        generate: async () => {
          throw new Error("Fixture generation failed. No model was called.");
        },
      },
    },
    lab: {
      model: {
        name: "fixture",
        provenance: "test_fixture",
        ready: async () => ({
          available: false,
          reason: "Offline test fixture.",
        }),
      },
    },
  });
  t.after(() => system.close());
  const html = await readFile("dist/index.html", "utf8");
  const entry = html.match(/src="([^"]+\.js)"/)[1];
  const script = await readFile("dist" + entry, "utf8");
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (e) => {
    if (!e.message.includes("Not implemented")) errors.push(e.message);
  });
  const dom = new JSDOM(html, {
    url: "http://localhost/#/home",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const { window } = dom,
    doc = window.document;
  t.after(() => window.close());
  let offline = false,
    cookie = "",
    position = 0;
  Object.defineProperty(window, "scrollY", { get: () => position });
  window.scrollTo = (options, y) => {
    position = typeof options === "object" ? options.top : y;
  };
  window.scrollBy = ({ top }) => {
    position += top;
  };
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  let contributionFixture = null;
  window.fetch = async (url, options = {}) => {
    if (offline) throw new Error("offline");
    if (
      contributionFixture &&
      String(url).startsWith("/api/commons?") &&
      (!options.method || options.method === "GET")
    ) {
      return Response.json(contributionFixture);
    }
    const result = await system.gateway.inject({
      url: String(url),
      method: options.method || "GET",
      payload: options.body,
      headers: { host: "localhost", cookie, ...options.headers },
    });
    if (result.headers["set-cookie"])
      cookie = String(result.headers["set-cookie"]).split(";")[0];
    return new Response(result.body || null, {
      status: result.statusCode,
      headers: result.headers,
    });
  };
  async function assertAccessible() {
    if (!window.axe) window.eval(axe.source);
    const result = await window.axe.run(doc, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(result.violations),
    );
  }
  window.eval(script);
  await until(
    () => doc.querySelector("h1")?.textContent === "Workspace overview",
  );
  assert.equal(doc.documentElement.lang, "en");
  assert.equal(/[А-Яа-яЁё]/.test(doc.body.textContent), false);
  const source = doc.querySelector(".code-scroller"),
    line = source.querySelector("code");
  source.scrollLeft = 140;
  const steps = doc.querySelector(".cycle-details .step-list");
  assert.ok(steps);
  await until(() => Boolean(doc.querySelector("[data-event]")));
  const event = doc.querySelector("[data-event]"),
    link = event.querySelector("a");
  link.focus();
  const range = doc.createRange();
  range.selectNodeContents(line);
  window.getSelection().addRange(range);
  const selected = window.getSelection().toString();
  position = 320;
  const navigation = doc.querySelector(".global-nav");
  assert.equal(navigation.querySelectorAll("a").length, 14);
  assert.equal(navigation.querySelector("details, select"), null);
  doc.querySelector("#sync").click();
  await until(() => !doc.querySelector("#sync").disabled);
  assert.equal(doc.querySelector(".code-scroller"), source);
  assert.equal(source.scrollLeft, 140);
  assert.equal(window.getSelection().toString(), selected);
  assert.equal(doc.activeElement, link);
  assert.equal(doc.querySelector(".cycle-details .step-list"), steps);
  assert.equal(position, 320);
  assert.equal(doc.querySelector(".global-nav"), navigation);
  doc.querySelector("#playback-next").click();
  await until(
    () => doc.querySelector("#playback-status").textContent === "Step 1 / 10",
  );
  assert.equal(
    doc.querySelector('[data-event="' + event.dataset.event + '"]'),
    event,
  );
  assert.equal(doc.querySelector(".code-scroller"), source);
  assert.equal(source.scrollLeft, 140);
  assert.equal(position, 320);
  const theme = doc.querySelector("#theme-select");
  theme.value = "dark";
  theme.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => doc.documentElement.dataset.theme === "dark");
  assert.equal(doc.querySelector(".code-scroller"), source);
  assert.equal(window.localStorage.getItem("commit-zero-theme"), "dark");
  doc.querySelector('.global-nav a[data-nav="agents"]').click();
  await until(() => doc.querySelector("h1")?.textContent === "Agents");
  assert.equal(position, 0);
  window.location.hash = "/home";
  await until(
    () => doc.querySelector("h1")?.textContent === "Workspace overview",
  );
  assert.equal(position, 320);
  const returningSource = doc.querySelector(".code-scroller");
  offline = true;
  doc.querySelector("#playback-next").click();
  await until(() => Boolean(doc.querySelector(".workspace-error")));
  assert.ok(doc.querySelector(".activity-feed"));
  assert.equal(doc.querySelector(".code-scroller"), returningSource);
  offline = false;
  doc.querySelector(".workspace-error button").click();
  await until(() => !doc.querySelector(".workspace-error"));
  for (let i = 1; i < 10; i++) {
    doc.querySelector("#playback-next").click();
    await until(
      () =>
        doc.querySelector("#playback-status").textContent ===
        `Step ${i + 1} / 10`,
    );
  }
  window.location.hash = "/agent/gemini/memory";
  await until(() => Boolean(doc.querySelector(".memory-item")));
  assert.match(
    doc.querySelector(".memory-item").textContent,
    /Pull request #12/,
  );
  window.location.hash = "/repo/orbit";
  await until(() => Boolean(doc.querySelector(".file-list")));
  assert.match(doc.querySelector(".code-lines").textContent, /Math.max/);
  const scenarioCredits = doc.querySelector(
    '[aria-label="Project model contributions"]',
  );
  assert.match(scenarioCredits.textContent, /Created byChatGPT/);
  assert.match(scenarioCredits.textContent, /Claude.*1 merged PR/s);
  assert.equal(
    scenarioCredits
      .querySelector(".project-contributor a")
      .getAttribute("href"),
    "#/agent/claude",
  );
  assert.equal(
    scenarioCredits
      .querySelector(".project-change-list a")
      .getAttribute("href"),
    "#/pr/12/files",
  );
  assert.equal(scenarioCredits.querySelectorAll("img").length, 2);
  assert.equal(scenarioCredits.querySelectorAll("a a").length, 0);
  const scenarioTimeline = doc.querySelector(
    '[aria-label="Project live timeline"]',
  );
  assert.match(scenarioTimeline.textContent, /Scenario/);
  assert.match(scenarioTimeline.textContent, /ChatGPT.*merged the PR/s);
  assert.ok(scenarioTimeline.querySelector('a[href="#/pr/12/files"]'));
  assert.ok(scenarioTimeline.querySelector('a[href="#/agent/claude"] img'));
  assert.equal(
    doc.querySelector(".code-scroller").getAttribute("role"),
    "region",
  );
  const hash = window.location.hash;
  doc.querySelector(".skip").click();
  assert.equal(window.location.hash, hash);
  assert.equal(doc.activeElement, doc.querySelector("main"));
  assert.match(
    doc.querySelector(".file-list a[aria-current]").textContent,
    /orbit.js/,
  );
  doc.querySelector('a[href="#/repo/orbit/activity"]').click();
  await until(() => doc.querySelectorAll(".code-lines").length === 0);
  assert.equal(
    doc.querySelectorAll('[aria-label="Project live timeline"]').length,
    1,
  );
  assert.match(
    doc.querySelector(".project-live-timeline").textContent,
    /Scenario/,
  );
  window.location.hash = "/pr/12/files";
  await until(() => Boolean(doc.querySelector(".diff-add")));
  assert.match(doc.querySelector(".diff-add .sr").textContent, /Added/);
  assert.match(doc.querySelector(".diff-del .sr").textContent, /Removed/);
  window.location.hash = "/leaderboard";
  await until(
    () => doc.querySelectorAll(".ranking-table tbody tr").length === 3,
  );
  assert.match(
    doc.querySelector(".ranking-method").textContent,
    /simulation, not general AI capability/,
  );
  await assertAccessible();
  window.location.hash = "/repos?type=library&q=timer";
  await until(() => doc.querySelectorAll(".repository-row").length === 1);
  assert.equal(
    doc.querySelector(".repository-row .repo-name").textContent,
    "claude/safe-timer",
  );
  const catalogInput = doc.querySelector("#repository-filter");
  assert.equal(catalogInput.value, "timer");
  catalogInput.focus();
  position = 210;
  const historyLength = window.history.length;
  const setInput = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  setInput.call(catalogInput, "vector");
  catalogInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => window.location.hash === "#/repos?type=library&q=vector");
  assert.equal(doc.querySelector("#repository-filter"), catalogInput);
  assert.equal(doc.activeElement, catalogInput);
  assert.equal(position, 210);
  assert.equal(window.history.length, historyLength);
  assert.equal(
    doc.querySelector(".repository-row .repo-name").textContent,
    "chatgpt/vector-kit",
  );
  window.location.hash = "/repo/vector-kit";
  await until(() => Boolean(doc.querySelector(".repo-header")));
  window.history.back();
  await until(() => Boolean(doc.querySelector("#repository-filter")));
  assert.equal(doc.querySelector("#repository-filter").value, "vector");
  assert.equal(
    doc.querySelector('.repository-types [aria-pressed="true"]').textContent,
    "Libraries1",
  );
  assert.equal(position, 210);
  await assertAccessible();
  window.location.hash = "/repos?type=unknown&q=%3Ctag%3E%26%3F";
  await until(
    () => doc.querySelector("#repository-filter")?.value === "<tag>&?",
  );
  assert.equal(
    doc.querySelector('.repository-types [aria-pressed="true"]').textContent,
    "All0",
  );
  assert.equal(doc.querySelector(".empty tag"), null);
  doc.querySelector(".empty button").click();
  await until(() => window.location.hash === "#/repos");
  assert.equal(doc.querySelector("#repository-filter").value, "");
  assert.equal(doc.querySelectorAll(".repository-row").length, 7);
  assert.equal(doc.querySelectorAll("a a").length, 0);
  position = 260;
  doc
    .querySelector(
      '.repository-row .project-model-mark[href="#/agent/chatgpt"]',
    )
    .click();
  await until(
    () => doc.querySelector(".profile-name")?.textContent === "ChatGPT",
  );
  assert.equal(position, 0);
  doc.querySelector('a[href="#/agent/chatgpt/forks"]').click();
  await until(() => window.location.hash.endsWith("/forks"));
  doc.querySelector('a[href="#/agent/chatgpt/pulls"]').click();
  await until(() => window.location.hash.endsWith("/pulls"));
  await assertAccessible();
  doc.querySelector('.global-nav a[data-nav="repos"]').click();
  await until(() => Boolean(doc.querySelector("#repository-filter")));
  assert.equal(
    position,
    0,
    "Fresh link opens the page at the top, not its stale offset",
  );
  position = 260;
  doc
    .querySelector(
      '.repository-row .project-model-mark[href="#/agent/chatgpt"]',
    )
    .click();
  await until(() => Boolean(doc.querySelector(".profile-name")));
  window.history.back();
  await until(() => Boolean(doc.querySelector("#repository-filter")));
  assert.equal(position, 260, "Back restores the reading position");
  window.location.hash = "/signup";
  await until(() => Boolean(doc.querySelector(".auth-card input")));
  await until(() =>
    doc.querySelector(".oauth-options")?.textContent.includes("Not configured"),
  );
  assert.equal(doc.querySelectorAll(".oauth-button:disabled").length, 2);
  await assertAccessible();
  const form = doc.querySelector(".auth-card");
  form.elements.username.value = "react_observer";
  form.elements.password.value = "A-local-test-password";
  form.elements.displayName.value = "React Observer";
  form.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => Boolean(doc.querySelector(".observer-profile")));
  assert.equal(doc.querySelector("h1").textContent, "React Observer");
  window.location.hash = "/discover";
  await until(() => Boolean(doc.querySelector(".network-story")));
  await assertAccessible();
  window.location.hash = "/discover?view=knowledge";
  await until(() =>
    doc
      .querySelector(".network-tabs a[aria-current]")
      ?.textContent.includes("Shared knowledge"),
  );
  assert.match(
    doc.querySelector(".network-layout").textContent,
    /Read the lesson/,
  );
  window.location.hash = "/timeline";
  await until(() => doc.querySelectorAll(".timeline-event").length > 5);
  await assertAccessible();
  const actorSelect = doc.querySelector(".timeline-filters select");
  actorSelect.value = "gemini";
  actorSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(
    () =>
      doc.querySelectorAll(".timeline-event").length > 0 &&
      [...doc.querySelectorAll(".timeline-actor")].every(
        (e) => e.textContent === "Gemini",
      ),
  );
  const pause = doc.querySelector(".timeline-status button");
  pause.click();
  await until(() => pause.textContent === "Resume updates");
  assert.equal(pause.getAttribute("aria-pressed"), null);
  assert.match(
    doc.querySelector(".timeline-status").textContent,
    /Updates paused/,
  );
  window.location.hash = "/agent/claude";
  await until(() =>
    Boolean(doc.querySelector('[aria-label="Contribution overview"]')),
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Improved projects"] li').length,
    1,
  );
  assert.equal(
    doc
      .querySelector('[aria-label="Improved projects"] .contribution-title')
      .getAttribute("href"),
    "#/pr/12/files",
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Created projects"] li').length,
    2,
  );
  assert.equal(doc.querySelectorAll("a a").length, 0);
  await assertAccessible();
  window.location.hash = "/agent/claude/timeline";
  await until(
    () =>
      doc.querySelectorAll(".timeline-event").length > 0 &&
      [...doc.querySelectorAll(".timeline-actor")].every(
        (e) => e.textContent === "Claude",
      ),
  );
  assert.equal(doc.querySelectorAll(".timeline-filters select").length, 2);
  await assertAccessible();
  window.location.hash = "/my-agents/new?repo=chatgpt%2Forbit";
  await until(() => Boolean(doc.querySelector(".agent-setup")));
  await assertAccessible();
  const setup = doc.querySelector(".agent-setup");
  setup.elements.name.value = "Edge Case";
  setup.elements.mission.value = "Find timing bugs in the Orbit project.";
  setup.elements.model.value = "test-model-id";
  assert.equal(setup.elements.repository.value, "chatgpt/orbit");
  setup.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => doc.querySelector("h1")?.textContent === "Edge Case");
  assert.match(
    doc.querySelector(".agent-readiness").textContent,
    /Not running/,
  );
  assert.match(
    [...doc.querySelectorAll(".agent-readiness a")]
      .find((a) => a.textContent === "Create agent task")
      .getAttribute("href"),
    /^#\/commons\?agent=/,
  );
  [...doc.querySelectorAll("button")]
    .find((b) => b.textContent === "Check model readiness")
    .click();
  await until(() =>
    doc
      .querySelector(".agent-readiness")
      .textContent.includes("Local model is ready for proposal tasks"),
  );
  const savedConfiguration = (
    await (await window.fetch("/api/account/agents")).json()
  ).agents[0];
  const changedElsewhere = await window.fetch(
    `/api/account/agents/${savedConfiguration.id}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-commit-zero": "local-demo",
      },
      body: JSON.stringify({
        ...Object.fromEntries(
          [
            "name",
            "mission",
            "instructions",
            "provider",
            "model",
            "repository",
            "dailyBudgetCents",
            "maxMinutes",
            "capabilities",
            "version",
          ].map((key) => [key, savedConfiguration[key]]),
        ),
        mission: "A mission changed in another browser tab.",
      }),
    },
  );
  assert.equal(changedElsewhere.status, 200);
  const editingAgent = doc.querySelector(".agent-setup");
  editingAgent.elements.mission.value =
    "Keep my unsaved mission visible after a conflict.";
  editingAgent.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() =>
    doc
      .querySelector(".agent-setup .form-feedback")
      .textContent.includes("another tab"),
  );
  assert.equal(
    editingAgent.elements.mission.value,
    "Keep my unsaved mission visible after a conflict.",
  );
  assert.ok(
    [...doc.querySelectorAll("button")].some(
      (b) => b.textContent === "Reload saved configuration",
    ),
  );
  window.location.hash = "/my-agents";
  await until(() => Boolean(doc.querySelector(".managed-agents")));
  assert.match(doc.querySelector(".managed-agents").textContent, /Edge Case/);
  await assertAccessible();
  window.location.hash = "/agent-catalog";
  await until(() => doc.querySelector("h1")?.textContent === "Proposed agent roles");
  assert.equal(doc.querySelectorAll(".agent-catalog-layout article").length, 18);
  assert.match(doc.querySelector(".agent-catalog-layout").textContent, /All 18 are disabled/);
  window.location.hash = "/agent-catalog/fable-architect";
  await until(() => doc.querySelector(".agent-readiness h2")?.textContent === "Fable Architect");
  assert.match(doc.querySelector(".agent-readiness").textContent, /claude-fable-5-1/);
  assert.equal(doc.querySelector(".agent-readiness button"), null);
  await assertAccessible();
  window.location.hash = "/repo/orbit";
  await until(() => Boolean(doc.querySelector(".repo-header")));
  const save = [...doc.querySelectorAll(".repo-header button")].find(
    (b) => b.textContent === "Save",
  );
  save.click();
  await until(() => save.textContent === "Saved");
  window.location.hash = "/profile";
  await until(() => Boolean(doc.querySelector(".repo-catalog")));
  assert.match(
    doc.querySelector(".repo-catalog").textContent,
    /chatgpt\/orbit/,
  );
  [...doc.querySelectorAll(".profile-tabs button")]
    .find((b) => b.textContent === "Edit profile")
    .click();
  await until(() => Boolean(doc.querySelector(".profile-form")));
  await assertAccessible();
  const profile = doc.querySelector(".profile-form");
  profile.elements.displayName.value = "Updated React Observer";
  profile.elements.biography.value = "Saved through the identity service.";
  profile.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => doc.querySelector("h1").textContent === "Updated React Observer",
  );
  [...doc.querySelectorAll("button")]
    .find((b) => b.textContent === "Sign out")
    .click();
  await until(() => Boolean(doc.querySelector(".profile-welcome")));
  window.location.hash = "/login";
  await until(() => Boolean(doc.querySelector(".auth-card input")));
  const login = doc.querySelector(".auth-card");
  login.elements.username.value = "react_observer";
  login.elements.password.value = "A-local-test-password";
  login.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => doc.querySelector("h1")?.textContent === "Updated React Observer",
  );
  window.location.hash = "/search?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E";
  await until(() => doc.querySelector("h1")?.textContent.startsWith("Search"));
  assert.equal(doc.querySelector("main img[onerror]"), null);
  window.location.hash = "/sandbox";
  await until(() => Boolean(doc.querySelector(".service-list")));
  assert.match(doc.querySelector(".service-list").textContent, /identity/);
  window.location.hash = "/home";
  await until(
    () => doc.querySelector("h1")?.textContent === "Workspace overview",
  );
  window.eval(axe.source);
  const result = await window.axe.run(doc, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  assert.equal(result.violations.length, 0, JSON.stringify(result.violations));
  window.location.hash = "/repo/orbital-garden";
  await until(() => Boolean(doc.querySelector(".code-lines")));
  position = 640;
  doc.querySelector("#playback-toggle").click();
  await until(
    () =>
      doc.querySelector("h1")?.textContent === "Workspace overview" &&
      doc.querySelector("#playback-status").textContent === "Step 0 / 10",
  );
  assert.equal(position, 0);
  window.location.hash = "/lab";
  await until(() => Boolean(doc.querySelector(".lab-empty")));
  assert.equal(doc.querySelector("#playback-toggle"), null);
  assert.match(
    doc.querySelector(".lab-readiness").textContent,
    /Local model offline/,
  );
  assert.equal(
    [...doc.querySelectorAll("button")].find(
      (b) => b.textContent === "Start local experiment",
    ).disabled,
    true,
  );
  await assertAccessible();
  window.location.hash = "/commons";
  await until(() => Boolean(doc.querySelector("#commons-message")));
  assert.equal(doc.querySelector("#playback-toggle"), null);
  const chatInput = doc.querySelector("#commons-message");
  Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  ).set.call(chatInput, "<img src=x onerror=alert(1)> retained draft");
  chatInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => !doc.querySelector(".commons-compose button").disabled);
  [...doc.querySelectorAll(".commons-heading button")]
    .find((b) => b.textContent === "Pause updates")
    .click();
  await until(
    () =>
      doc.querySelector(".commons-heading button").textContent ===
      "Resume updates",
  );
  const chatRun = (
    await system.gateway.inject({
      url: "/api/state",
      headers: { host: "localhost" },
    })
  ).json().runId;
  const chatVersion = (
    await system.gateway.inject({
      url: "/api/commons?runId=" + chatRun,
      headers: { host: "localhost" },
    })
  ).json().version;
  await system.gateway.inject({
    url: "/api/commons/messages",
    method: "POST",
    headers: { host: "localhost", "x-commit-zero": "local-demo" },
    payload: {
      runId: chatRun,
      version: chatVersion,
      repoId: "safe-timer",
      message: "Project-only fixture note",
    },
  });
  chatInput.focus();
  doc
    .querySelector(".commons-compose")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(() =>
    doc
      .querySelector(".commons .inline-error")
      ?.textContent.includes("Workspace changed"),
  );
  assert.equal(doc.querySelector("#commons-message"), chatInput);
  assert.equal(chatInput.value, "<img src=x onerror=alert(1)> retained draft");
  assert.equal(doc.activeElement, chatInput);
  assert.equal(
    doc
      .querySelector(".commons-messages")
      .textContent.includes("Project-only fixture note"),
    false,
  );
  doc
    .querySelector(".commons-compose")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(() => chatInput.value === "");
  assert.match(
    doc.querySelector(".commons-messages").textContent,
    /retained draft/,
  );
  assert.equal(
    doc.querySelectorAll('.commons img[src="x"], .commons img[onerror]').length,
    0,
  );
  assert.ok(doc.querySelector(".commons .project-model-mark img"));
  await assertAccessible();
  window.location.hash = "/repo/safe-timer/chat";
  await until(() =>
    doc
      .querySelector(".commons-messages")
      ?.textContent.includes("Project-only fixture note"),
  );
  assert.equal(
    doc
      .querySelector(".commons-messages")
      .textContent.includes("retained draft"),
    false,
  );
  assert.equal(doc.querySelector("#playback-toggle"), null);
  await assertAccessible();
  const projectSection = (label) =>
    [...doc.querySelectorAll(".commons-views button")].find(
      (b) => b.textContent === label,
    );
  projectSection("Versions").click();
  await until(() =>
    Boolean(doc.querySelector('[aria-label="Project versions"]')),
  );
  assert.match(
    doc.querySelector('[aria-label="Project versions"]').textContent,
    /v0.*Initial snapshot/s,
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Project versions"] > li').length,
    1,
  );
  assert.match(doc.querySelector(".commons-code").textContent, /safeDelta/);
  projectSection("Timeline").click();
  await until(() => Boolean(doc.querySelector(".commons-events")));
  assert.equal(doc.querySelector(".commons details"), null);
  assert.ok(doc.querySelector(".commons-events .commons-event-body"));
  assert.ok(doc.querySelector("#commons-task"));
  assert.match(
    doc.querySelector(".commons-execution").textContent,
    /do not run the code/,
  );
  assert.match(
    doc.querySelector(".commons-events").textContent,
    /Project-only fixture note/,
  );
  projectSection("Code").click();
  await until(() => Boolean(doc.querySelector(".commons-file-list")));
  [...doc.querySelectorAll(".commons-file")]
    .find((b) => b.textContent === "README.md")
    .click();
  await until(() =>
    doc.querySelector(".commons-file-title").textContent.includes("README.md"),
  );
  projectSection("Chat").click();
  await until(() => Boolean(doc.querySelector("#commons-message")));
  await assertAccessible();
  projectSection("Tasks (0)").click();
  await until(() =>
    doc.querySelector(".commons-empty")?.textContent.includes("No tasks yet"),
  );
  const taskInput = doc.querySelector("#commons-task");
  const taskDraft = taskInput.value;
  projectSection("Chat").click();
  await until(() => Boolean(doc.querySelector(".commons-message")));
  const createFromMessage = () =>
    [...doc.querySelectorAll(".commons-message button")]
      .find((button) => button.textContent === "Create task")
      .click();
  createFromMessage();
  await until(() =>
    Boolean(doc.querySelector(".commons-start .commons-source")),
  );
  assert.equal(doc.activeElement, taskInput);
  assert.equal(taskInput.value, taskDraft);
  assert.match(
    doc.querySelector(".commons-start .commons-source").textContent,
    /Project-only fixture note/,
  );
  assert.ok(projectSection("Tasks (0)"));
  [...doc.querySelectorAll(".commons-start button")]
    .find((button) => button.textContent === "Remove source")
    .click();
  await until(() => !doc.querySelector(".commons-start .commons-source"));
  assert.equal(doc.activeElement, taskInput);
  createFromMessage();
  await until(() =>
    Boolean(doc.querySelector(".commons-start .commons-source")),
  );
  doc
    .querySelector(".commons-start form")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await until(() =>
    doc
      .querySelector(".commons-tasks")
      ?.textContent.includes("Fixture generation failed"),
  );
  assert.match(
    doc.querySelector(".commons-tasks").textContent,
    /Failed.*No pull request/s,
  );
  assert.match(doc.querySelector(".commons-tasks").textContent, /test_fixture/);
  assert.match(
    doc.querySelector(".commons-tasks .commons-source").textContent,
    /Project-only fixture note/,
  );
  assert.equal(doc.querySelector(".commons-start .commons-source"), null);
  assert.equal(doc.querySelector("#commons-task"), taskInput);
  assert.equal(taskInput.value, taskDraft);
  [...doc.querySelectorAll(".commons-tasks button")]
    .find((b) => b.textContent === "Task #1 timeline")
    .click();
  await until(() =>
    doc
      .querySelector(".commons-events")
      ?.textContent.includes("Fixture generation failed"),
  );
  assert.equal(
    doc
      .querySelector(".commons-events")
      .textContent.includes("Project-only fixture note"),
    false,
  );
  [...doc.querySelectorAll(".commons-actions button")]
    .find((b) => b.textContent === "All activity")
    .click();
  await until(() =>
    doc
      .querySelector(".commons-events")
      ?.textContent.includes("Project-only fixture note"),
  );
  projectSection("Tasks (1)").click();
  await until(() => Boolean(doc.querySelector(".commons-tasks")));
  await assertAccessible();
  projectSection("Chat").click();
  await until(() => Boolean(doc.querySelector(".commons-message")));
  [...doc.querySelectorAll(".commons-message button")]
    .find((button) => button.textContent === "Task #1")
    .click();
  await until(() =>
    Boolean(doc.querySelector(".commons-tasks .commons-source")),
  );
  assert.match(
    doc.querySelector(".commons-tasks .commons-source").textContent,
    /Project-only fixture note/,
  );
  const fillControlled = (element, value) => {
    Object.getOwnPropertyDescriptor(
      element.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      "value",
    ).set.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  window.location.hash = "/commons?view=projects";
  await until(() => Boolean(doc.querySelector('[aria-label="New project"]')));
  const newProjectForm = doc.querySelector('[aria-label="New project"] form');
  fillControlled(newProjectForm.querySelectorAll("input")[0], "ui-library");
  fillControlled(newProjectForm.querySelectorAll("input")[1], "UI Library");
  fillControlled(
    newProjectForm.querySelector("textarea"),
    "A library created through the actual interface.",
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  newProjectForm.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => doc.querySelector("h1")?.textContent === "UI Library");
  assert.match(doc.querySelector(".commons-code").textContent, /README.md/);
  projectSection("Issues (0)").click();
  await until(() => Boolean(doc.querySelector(".commons-issues")));
  const issueForm = doc.querySelector(".commons-issues form");
  fillControlled(issueForm.querySelector("input"), "Handle negative values");
  fillControlled(
    issueForm.querySelector("textarea"),
    "Negative input should return zero.",
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  issueForm.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => Boolean(doc.querySelector(".commons-issues article")));
  const issueArticle = doc.querySelector(".commons-issues article");
  [...issueArticle.querySelectorAll("button")]
    .find((button) => button.textContent === "Create task from issue")
    .click();
  await until(() =>
    Boolean(
      [...doc.querySelectorAll("button")].find(
        (button) => button.textContent === "Remove issue",
      ),
    ),
  );
  assert.equal(doc.activeElement, doc.querySelector("#commons-task"));
  [...issueArticle.querySelectorAll("button")]
    .find((button) => button.textContent === "Close issue")
    .click();
  await until(() => !doc.querySelector(".commons-issues article"));
  await assertAccessible();
  window.location.hash = "/model/failure-fixture-not-a-model";
  await until(() =>
    Boolean(doc.querySelector('[aria-label="Model timeline"]')),
  );
  assert.equal(doc.querySelectorAll("a a").length, 0);
  assert.match(
    doc.querySelector(".model-profile").textContent,
    /No recorded local calls/,
  );
  assert.equal(
    doc.querySelector('[aria-label="Model pull requests"] li'),
    null,
  );
  await assertAccessible();
  // Read-only UI fixture: no real model runs or persisted application data change.
  const contributionRun = (
    await system.gateway.inject({
      url: "/api/state",
      headers: { host: "localhost" },
    })
  ).json().runId;
  contributionFixture = (
    await system.gateway.inject({
      url: `/api/commons?runId=${contributionRun}`,
      headers: { host: "localhost" },
    })
  ).json();
  contributionFixture.version += 100;
  const project = contributionFixture.projects.find(
    (p) => p.id === "ui-library",
  );
  const first = {
    id: "fixture-first",
    jobId: "fixture-job",
    title: "Fixture initial implementation",
    path: "main.js",
    before: null,
    after: "export const value = 1;",
    baseRevision: 0,
    status: "merged",
    check: { passed: true },
    hash: "fixture-only",
  };
  const waiting = {
    ...first,
    id: "fixture-approved",
    title: "Fixture approved only",
    before: first.after,
    after: "export const value = 2;",
    baseRevision: 1,
    status: "approved",
  };
  project.prs = [first, waiting];
  project.forks = [
    {
      id: "fork-first",
      jobId: "fixture-job",
      baseRevision: 0,
      files: { "main.js": "export const fork = 1;" },
    },
    {
      id: "fork-second",
      baseRevision: 1,
      files: { "main.js": "export const fork = 2;" },
    },
  ];
  project.revision = 1;
  project.files["main.js"] = first.after;
  contributionFixture.jobs = [
    {
      id: "fixture-job",
      sourceMessageId: "fixture-source",
      repoId: project.id,
      model: "ui-fixture-only",
      provenance: "local_model",
      status: "completed",
      phase: "completed",
    },
  ];
  contributionFixture.events.push({
    id: "fixture-source",
    type: "message",
    repoId: project.id,
    actor: "operator",
    at: "2026-10-18T23:59:00Z",
    text: "Retained task source",
    sequence: 100,
  });
  contributionFixture.events.push({
    id: "fixture-merge",
    type: "merge",
    repoId: project.id,
    prId: first.id,
    actor: "operator",
    at: "2026-10-19T00:00:00Z",
    text: "UI fixture merge",
  });
  position = 0;
  window.location.hash = "/model/ui-fixture-only";
  await until(
    () =>
      doc.querySelectorAll('[aria-label="Accepted pull requests"] li')
        .length === 1,
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Created projects"] li').length,
    1,
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Improved projects"] li').length,
    0,
  );
  assert.equal(
    doc.querySelectorAll('[aria-label="Model pull requests"] li').length,
    1,
  );
  const exact = doc.querySelector(
    '[aria-label="Accepted pull requests"] .contribution-title',
  );
  assert.equal(
    exact.getAttribute("href"),
    "#/commons/ui-library?view=changes&pull=fixture-first",
  );
  exact.click();
  await until(() =>
    Boolean(doc.querySelector('.commons-pull[data-focused="true"]')),
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 1);
  const projectCredits = doc.querySelector(
    '[aria-label="Project model contributions"]',
  );
  assert.match(
    projectCredits.textContent,
    /First implementationui-fixture-only/,
  );
  assert.equal(
    projectCredits.querySelectorAll(".project-change-list li").length,
    1,
  );
  assert.equal(
    projectCredits.querySelectorAll(".project-proposal-list li").length,
    1,
  );
  assert.equal(
    projectCredits.querySelector(".contributor-link").getAttribute("href"),
    "#/model/ui-fixture-only",
  );
  assert.equal(
    projectCredits.querySelector(".project-change-list a").getAttribute("href"),
    "#/commons/ui-library?view=changes&pull=fixture-first",
  );
  position = 370;
  projectCredits
    .querySelector(".project-proposal-list > li > a:not(.contributor-link)")
    .click();
  await until(() =>
    doc
      .querySelector(".commons-pull h2")
      ?.textContent.includes("Fixture approved only"),
  );
  assert.equal(position, 0);
  window.history.back();
  await until(() =>
    doc
      .querySelector(".commons-pull h2")
      ?.textContent.includes("Fixture initial implementation"),
  );
  assert.equal(position, 370);
  assert.match(
    doc.querySelector(".commons-pull").textContent,
    /Fixture initial implementation/,
  );
  assert.equal(
    doc.querySelector(".commons-diff pre:last-child") !== null,
    true,
  );
  await assertAccessible();
  // A second PR in the same project changes the target without remounting the room.
  window.location.hash =
    "/commons/ui-library?view=changes&pull=fixture-approved";
  await until(() =>
    doc
      .querySelector(".commons-pull h2")
      ?.textContent.includes("Fixture approved only"),
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 1);
  doc.querySelector('a[href="#/commons/ui-library?view=changes"]').click();
  await until(
    () =>
      doc.querySelectorAll('[aria-label="Pull requests"] button').length === 2,
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 1);
  [...doc.querySelectorAll('[aria-label="Pull requests"] button')]
    .find((button) => button.textContent.includes("Fixture approved only"))
    .click();
  await until(() =>
    doc
      .querySelector(".commons-pull h2")
      ?.textContent.includes("Fixture approved only"),
  );
  window.location.hash = "/commons/ui-library?view=changes&pull=missing";
  await until(
    () =>
      doc
        .querySelector(".commons-main")
        ?.textContent.includes("Pull request not found") ||
      doc.body.textContent.includes("Pull request not found in this project."),
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 0);
  window.location.hash = "/commons/ui-library?view=forks";
  await until(
    () =>
      doc.querySelectorAll('[aria-label="Select fork"] button').length === 2,
  );
  assert.equal(doc.querySelectorAll(".commons-code").length, 1);
  assert.match(doc.querySelector(".commons-code").textContent, /fork = 1/);
  doc.querySelectorAll('[aria-label="Select fork"] button')[1].click();
  await until(() =>
    doc.querySelector(".commons-code").textContent.includes("fork = 2"),
  );
  assert.ok(doc.querySelector('.commons-support [aria-label="Fork project"]'));
  await assertAccessible();
  window.location.hash = "/commons/ui-library?view=versions&version=1";
  await until(
    () =>
      doc.querySelector('.commons-version[aria-pressed="true"]')
        ?.textContent === "v1",
  );
  [...doc.querySelectorAll(".commons-file")]
    .find((button) => button.textContent === "main.js")
    .click();
  await until(() =>
    doc.querySelector(".commons-file-title")?.textContent.includes("main.js"),
  );
  assert.match(
    doc.querySelector(".commons-code").textContent,
    /export const value = 1/,
  );
  window.location.hash = "/commons/ui-library";
  await until(() =>
    Boolean(doc.querySelector('[aria-label="Project live timeline"]')),
  );
  const liveTimeline = doc.querySelector(
    '[aria-label="Project live timeline"]',
  );
  assert.equal(doc.querySelectorAll('[aria-label="Fork project"]').length, 0);
  assert.match(liveTimeline.textContent, /Local operator.*merged the PR/s);
  assert.equal(liveTimeline.querySelectorAll("a.contributor-link").length, 0);
  const pauseTimeline = liveTimeline.querySelector("button[aria-pressed]");
  pauseTimeline.click();
  await until(() => pauseTimeline.getAttribute("aria-pressed") === "true");
  position = 240;
  contributionFixture.version++;
  contributionFixture.events.push({
    id: "fixture-live-check",
    sequence: 9998,
    type: "check",
    actor: "system",
    repoId: project.id,
    prId: first.id,
    jobId: "fixture-job",
    check: { passed: false },
    at: "2026-10-19T00:01:00Z",
  });
  await until(() => liveTimeline.textContent.includes("Show new activity"));
  assert.equal(
    liveTimeline.querySelectorAll('[data-project-event="fixture-live-check"]')
      .length,
    0,
  );
  assert.equal(position, 240);
  pauseTimeline.click();
  await until(() =>
    Boolean(
      liveTimeline.querySelector('[data-project-event="fixture-live-check"]'),
    ),
  );
  assert.match(liveTimeline.textContent, /syntax failed/);
  assert.equal(position, 240);
  liveTimeline.getBoundingClientRect = () => ({ top: -40 });
  contributionFixture.version++;
  contributionFixture.events.push({
    id: "fixture-live-proposal",
    sequence: 9999,
    type: "proposal",
    actor: "builder",
    repoId: project.id,
    prId: waiting.id,
    jobId: "fixture-job",
    at: "2026-10-19T00:02:00Z",
  });
  await until(() => liveTimeline.textContent.includes("Show new activity"));
  assert.equal(
    liveTimeline.querySelectorAll(
      '[data-project-event="fixture-live-proposal"]',
    ).length,
    0,
  );
  [...liveTimeline.querySelectorAll("button")]
    .find((button) => button.textContent === "Show new activity")
    .click();
  await until(() =>
    Boolean(
      liveTimeline.querySelector(
        '[data-project-event="fixture-live-proposal"]',
      ),
    ),
  );
  const liveChange = liveTimeline.querySelector(
    '[data-project-event="fixture-live-proposal"]',
  );
  assert.equal(
    liveChange.querySelector(".contributor-link").getAttribute("href"),
    "#/model/ui-fixture-only",
  );
  assert.equal(
    liveChange
      .querySelector('.project-event-action a[href*="pull="]')
      .getAttribute("href"),
    "#/commons/ui-library?view=changes&pull=fixture-approved",
  );
  assert.equal(position, 240);
  await assertAccessible();
  offline = true;
  await until(() =>
    liveTimeline
      .querySelector('[role="status"]')
      ?.textContent.includes("Offline"),
  );
  assert.ok(
    liveTimeline.querySelector('[data-project-event="fixture-live-proposal"]'),
  );
  offline = false;
  await until(() =>
    liveTimeline.querySelector('[role="status"]')?.textContent.includes("Live"),
  );
  window.location.hash = "/commons/ui-library?view=tasks&task=fixture-job";
  await until(() =>
    Boolean(doc.querySelector(".commons-content .commons-pull")),
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 1);
  assert.match(
    doc.querySelector(".commons-tasks").textContent,
    /fork-fir.*files retained/s,
  );
  assert.match(
    doc.querySelector(".commons-tasks .commons-source").textContent,
    /Retained task source/,
  );
  assert.ok(
    doc.querySelector('.commons-support [aria-label="Project live timeline"]'),
  );
  assert.match(doc.querySelector(".commons-pull").textContent, /View v1/);
  await assertAccessible();
  window.location.hash =
    "/commons/ui-library?view=changes&pull=fixture-approved";
  await until(() =>
    doc
      .querySelector(".commons-pull h2")
      ?.textContent.includes("Fixture approved only"),
  );
  [...doc.querySelectorAll(".commons-pull button")]
    .find((button) => button.textContent === "Create revision task")
    .click();
  await until(() =>
    Boolean(doc.querySelector(".commons-start .commons-source")),
  );
  assert.match(
    doc.querySelector(".commons-start .commons-source").textContent,
    /Retained task source/,
  );
  assert.equal(doc.activeElement, doc.querySelector("#commons-task"));
  window.location.hash = "/commons/ui-library?view=tasks&task=missing";
  await until(() =>
    doc
      .querySelector(".commons-content")
      ?.textContent.includes("Task not found"),
  );
  assert.equal(doc.querySelectorAll(".commons-pull").length, 0);
  assert.deepEqual(errors, []);
});
