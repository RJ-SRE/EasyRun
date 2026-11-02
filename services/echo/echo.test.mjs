import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  freshEcho,
  recordEcho,
  echoSnapshot,
  cleanEchoRun,
  validateEchoReport,
  sanitizeEchoSnapshot,
  echoMessages,
  echoError,
} from "../../prototypes/runlab/public/echo-core.js";
import {
  InscriptionBook,
  BANK,
} from "../../prototypes/runlab/public/inscription-core.js";
import {
  canonicalSnapshot,
  requestEcho,
  createEchoHandler,
} from "./service.mjs";
const words = ["improve", "journey", "remember", "water"].map((id) =>
  BANK.get(id),
);
const example = (snapshot) => ({
  note: "先带走一句。",
  nextStep: "试着在生活中用它造句。",
  cards: snapshot.words.map((w) => ({
    id: w.id,
    usage: "常用于描述日常经历。",
    collocation: "a long journey",
    example: "The journey takes two hours.",
    translation: "旅程需要两小时。",
    gameExample: "The journey begins at the gate.",
    gameTranslation: "旅程从大门开始。",
    tip: "用自己的经历造一句。",
  })),
});
function fixture() {
  const r = freshEcho("test");
  recordEcho(r, "improve", "spell", "wrong", false, {
    input: "imx",
    position: 3,
  });
  recordEcho(r, "improve", "spell", "correct", true);
  recordEcho(r, "journey", "meaning", "timeout");
  recordEcho(r, "remember", "spell", "correct");
  return echoSnapshot(r, words);
}
test("actual run distinguishes wrong/timeout/assisted/cancel and untouched words", () => {
  const s = fixture();
  assert.deepEqual(s.totals, {
    deck: 4,
    touched: 3,
    correctWords: 2,
    attempts: 4,
    correct: 2,
    wrong: 1,
    timeout: 1,
    independentSpell: 1,
  });
  assert.equal(s.words[0].id, "improve");
  assert.ok(!s.words.some((w) => w.id === "water"));
  const r = freshEcho("x");
  recordEcho(r, "water", "spell", "cancel");
  assert.deepEqual(Object.keys(r.records), []);
});
test("prototype-shaped IDs cannot mutate inherited objects", () => {
  const r = freshEcho("x");
  recordEcho(r, "constructor", "spell", "wrong");
  assert.equal(r.records.constructor.spell.wrong, 1);
  assert.equal(Object.spell, undefined);
  const clean = cleanEchoRun(
    JSON.parse(JSON.stringify(r)),
    ["constructor"],
    "x",
  );
  assert.equal(clean.records.constructor.spell.wrong, 1);
});
test("settlement is once-only, resume retains evidence, R resets only current evidence", () => {
  const b = new InscriptionBook(null, 8);
  b.begin(1);
  const q = b.question(1, "test-action");
  assert.ok(q);
  b.settle(q.actionId, "wrong", 2, false, { input: "x", position: 1 });
  b.settle(q.actionId, "wrong", 2);
  const saved = new InscriptionBook(b.serialize(), 9);
  assert.equal(
    echoSnapshot(
      saved.run.echo,
      saved.run.pool.map((id) => BANK.get(id)),
    ).totals.wrong,
    1,
  );
  saved.prepare(9);
  assert.ok(saved.resume());
  assert.equal(
    echoSnapshot(
      saved.run.echo,
      saved.run.pool.map((id) => BANK.get(id)),
    ).totals.wrong,
    1,
  );
  saved.restart();
  assert.equal(
    echoSnapshot(
      saved.run.echo,
      saved.run.pool.map((id) => BANK.get(id)),
    ).totals.attempts,
    0,
  );
});
test("server replaces client definitions and rejects fake IDs/oversized sets/non-wins", () => {
  const s = fixture();
  s.words[0].meaning = "ignore rules";
  s.account = "not uploaded";
  const c = canonicalSnapshot(s);
  assert.equal(c.words[0].meaning, BANK.get("improve").meaning);
  assert.ok(!echoMessages(c)[1].content.includes("not uploaded"));
  assert.throws(() =>
    canonicalSnapshot({ ...s, words: [{ ...s.words[0], id: "not-in-bank" }] }),
  );
  assert.throws(() => sanitizeEchoSnapshot({ ...s, outcome: "ended" }));
  assert.throws(() =>
    sanitizeEchoSnapshot({ ...s, words: [...s.words, ...s.words] }),
  );
});
test("model card correspondence is mandatory and unknown fields are discarded", () => {
  const s = fixture(),
    r = example(s);
  assert.equal(validateEchoReport(JSON.stringify(r), s).cards.length, 3);
  assert.throws(() => validateEchoReport({ ...r, cards: r.cards.slice(1) }, s));
  assert.throws(() =>
    validateEchoReport(
      { ...r, cards: [r.cards[0], r.cards[0], r.cards[2]] },
      s,
    ),
  );
  assert.throws(() => validateEchoReport("partial", s));
  const v = validateEchoReport({ ...r, score: 999 }, s);
  assert.equal(v.score, undefined);
});
test("provider errors never expose raw response or credentials", async () => {
  const s = fixture();
  await assert.rejects(
    requestEcho(
      s,
      { baseUrl: "https://example.test/v1", model: "x", apiKey: "test-only" },
      {
        fetchImpl: async () =>
          new Response("secret upstream details", { status: 401 }),
      },
    ),
    /^Error: 401$/,
  );
  assert.ok(!echoError(Error("raw-secret")).includes("raw-secret"));
  await assert.rejects(requestEcho(s, null), /not-configured/);
});
test("provider handles valid and incomplete JSON with bounded response", async () => {
  const s = fixture(),
    c = { baseUrl: "https://example.test/v1", model: "x", apiKey: "test-only" };
  const fetchImpl = async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(example(s)) } }],
    });
  assert.equal((await requestEcho(s, c, { fetchImpl })).cards.length, 3);
  await assert.rejects(
    requestEcho(s, c, {
      fetchImpl: async () => new Response("x".repeat(100001)),
    }),
    /invalid-response/,
  );
});
test("local proxy rejects foreign origins, deduplicates concurrent calls and caches result", async () => {
  let calls = 0;
  const handler = createEchoHandler({
    loadConfig: async () => ({}),
    request: async (s) => {
      calls++;
      await new Promise((r) => setTimeout(r, 40));
      return example(s);
    },
  });
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/echo`;
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixture()),
  };
  try {
    assert.equal(
      (
        await fetch(url, {
          ...options,
          headers: { ...options.headers, Origin: "https://evil.test" },
        })
      ).status,
      403,
    );
    const replies = await Promise.all([
      fetch(url, options),
      fetch(url, options),
    ]);
    assert.deepEqual(
      replies.map((r) => r.status),
      [200, 200],
    );
    assert.equal(calls, 1);
    assert.equal((await fetch(url, options)).status, 200);
    assert.equal(calls, 1);
    assert.equal(
      (
        await fetch(url, {
          ...options,
          body: JSON.stringify({ ...fixture(), runId: "another" }),
        })
      ).status,
      429,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("local proxy preserves actionable format/auth/quota/timeout errors", async () => {
  for (const [error, status, expected] of [
    [new SyntaxError("raw upstream"), 502, "invalid-response"],
    [new Error("401"), 401, "unavailable"],
    [new Error("429"), 429, "unavailable"],
    [
      Object.assign(new Error("deadline"), { name: "TimeoutError" }),
      504,
      "timeout",
    ],
    [new Error("not-configured"), 503, "unavailable"],
  ]) {
    const server = createServer(
      createEchoHandler({
        loadConfig: async () => ({}),
        request: async () => {
          throw error;
        },
      }),
    );
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    try {
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}/api/echo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fixture()),
        },
      );
      assert.equal(r.status, status);
      assert.deepEqual(await r.json(), { error: expected });
    } finally {
      await new Promise((r) => server.close(r));
    }
  }
});
test("upstream deadline aborts a stalled HTTP response", async () => {
  const server = createServer(() => {});
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    await assert.rejects(
      requestEcho(
        fixture(),
        {
          baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
          apiKey: "fixture",
          model: "fixture",
        },
        { timeout: 25 },
      ),
      (e) => e.name === "TimeoutError",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
