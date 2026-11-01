import { applyAnswer, requireThat } from "./rules.mjs";
const SAVE_TRIGGERS = new Set([
  "checkpoint",
  "failure",
  "won",
  "abandoned",
  "restart",
  "manual",
]);
const byteLength = (text) => new TextEncoder().encode(text).byteLength;
export function httpTransport(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  requireThat(
    base.protocol === "https:" ||
      (base.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(base.hostname)),
    "HTTPS_REQUIRED",
  );
  return async (path, body, session) => {
    const response = await fetcher(new URL(path, base), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    requireThat(byteLength(text) <= 32768, "RESPONSE_TOO_LARGE");
    const value = JSON.parse(text);
    if (!response.ok)
      throw Object.assign(new Error(value.error || "REQUEST_FAILED"), {
        code: value.error,
        status: response.status,
      });
    return value;
  };
}
export class LearningClient {
  constructor({ transport, now = Date.now, maxEvents = 10000 }) {
    Object.assign(this, { transport, now, maxEvents });
    this.accounts = new Map();
    this.current = null;
    this.generation = 0;
    this.status = "guest";
  }
  useAccount(accountId, session) {
    // Call with /v1/session.playerId, never username/displayName. Renaming or
    // refreshing the same account must keep its deck, queue and in-flight ACK.
    if (this.current === accountId && this.state) {
      const changed = this.state.session !== session;
      this.state.session = session;
      if (changed && this.status === "login-required") {
        this.state.halted = false;
        this.state.retries = 0;
        this.state.retryAt = this.now();
        this.status = "pending";
      }
      return;
    }
    this.generation++;
    this.current = accountId;
    if (!this.accounts.has(accountId))
      this.accounts.set(accountId, {
        session,
        queue: [],
        head: 0,
        nextEventSeq: 1,
        frozen: null,
        pending: null,
        confirmed: new Map(),
        view: new Map(),
        prepared: null,
        retries: 0,
        retryAt: 0,
        halted: false,
      });
    this.state.session = session;
    this.state.halted = false;
    this.status = this.state.prepared ? "ready" : "loading";
  }
  guest() {
    this.generation++;
    this.current = null;
    this.status = "guest";
  }
  get state() {
    return this.accounts.get(this.current);
  }
  get pendingCount() {
    return this.state ? this.state.queue.length - this.state.head : 0;
  }
  async prepare(request) {
    const s = this.state;
    requireThat(s, "GUEST_HAS_NO_CLOUD");
    requireThat(
      !s.pending && !s.frozen && this.pendingCount === 0,
      "UNCONFIRMED_EVENTS",
      409,
    );
    const generation = ++this.generation;
    this.status = "loading";
    try {
      const body = { ...request };
      if (s.prepared)
        Object.assign(body, {
          writerSessionId: s.prepared.writerSessionId,
          writerEpoch: s.prepared.writerEpoch,
          baseRevision: s.prepared.revision,
          lastEventSeq: s.nextEventSeq - 1,
        });
      const p = await this.transport("/v1/prepare", body, s.session);
      if (generation !== this.generation || s !== this.state) return null;
      requireThat(
        p.words.length === 30 &&
          new Set(p.words.map((w) => w.wordId)).size === 30,
        "INVALID_PREPARED_DECK",
      );
      s.prepared = p;
      s.nextEventSeq = p.lastEventSeq + 1;
      s.confirmed = new Map(p.words.map((w) => [w.wordId, w.state]));
      s.view = new Map(s.confirmed);
      s.retries = 0;
      s.halted = false;
      this.status = "ready";
      return p;
    } catch (e) {
      if (generation === this.generation)
        this.status = s.prepared ? "prepare-failed-retained" : "read-failed";
      throw e;
    }
  }
  record(event) {
    const s = this.state;
    if (!s || !s.prepared) return false;
    if (this.pendingCount >= this.maxEvents) {
      this.status = "queue-full";
      throw Object.assign(new Error("QUEUE_FULL"), { code: "QUEUE_FULL" });
    }
    const e = { ...event, eventSeq: s.nextEventSeq++ };
    s.queue.push(e);
    // Small per-word prediction; no full dictionary or history rebuild.
    if (e.type === "answer")
      s.view.set(e.wordId, predict(s.view.get(e.wordId), e, this.now()));
    if (!s.halted)
      this.status = this.pendingCount >= 2000 ? "pending-large" : "pending";
    return true;
  }
  freeze(s, boundary = s.queue.length) {
    if (s.frozen) return s.frozen;
    const p = s.prepared,
      events = [];
    const base = {
      writerSessionId: p.writerSessionId,
      writerEpoch: p.writerEpoch,
      baseRevision: p.revision,
      batchSeq: p.lastBatchSeq + 1,
      batchId: `${p.writerSessionId}:${p.lastBatchSeq + 1}`,
      events,
    };
    let bytes = byteLength(JSON.stringify(base));
    for (let i = s.head; i < boundary && events.length < 200; i++) {
      const n = byteLength(JSON.stringify(s.queue[i])) + 1;
      if (bytes + n > 32768) break;
      events.push(s.queue[i]);
      bytes += n;
    }
    requireThat(events.length > 0, "EVENT_TOO_LARGE");
    s.frozen = JSON.parse(JSON.stringify(base));
    return s.frozen;
  }
  async save(trigger) {
    if (!SAVE_TRIGGERS.has(trigger) || !this.state?.prepared) return false;
    const s = this.state;
    if (s.pending) return s.pending;
    if (s.halted || s.head === s.queue.length) return false;
    const generation = this.generation,
      boundary = s.queue.length;
    s.pending = (async () => {
      while (s.head < boundary) {
        const batch = this.freeze(s, boundary);
        const requestSession = s.session;
        if (s === this.state && generation === this.generation)
          this.status = "saving";
        try {
          const ack = await this.transport(
            "/v1/batches",
            batch,
            requestSession,
          );
          // A response after account switch is not applied; retain the frozen
          // batch and retry idempotently when the original account resumes.
          if (s !== this.state || generation !== this.generation) return false;
          requireThat(
            ack.batchSeq === batch.batchSeq &&
              ack.batchId === batch.batchId &&
              ack.lastEventSeq === batch.events.at(-1).eventSeq &&
              ack.revision > batch.baseRevision,
            "INVALID_ACK",
          );
          const at = Date.parse(ack.savedAt);
          requireThat(Number.isFinite(at), "INVALID_ACK_TIME");
          for (const e of batch.events)
            if (e.type === "answer")
              s.confirmed.set(
                e.wordId,
                predict(s.confirmed.get(e.wordId), e, at),
              );
          for (let i = 0; i < batch.events.length; i++)
            s.queue[s.head++] = null;
          s.prepared.revision = ack.revision;
          s.prepared.lastBatchSeq = ack.batchSeq;
          s.frozen = null;
          s.retries = 0;
          s.retryAt = 0;
          s.view = new Map(s.confirmed);
          for (let i = s.head; i < s.queue.length; i++) {
            const e = s.queue[i];
            if (e.type === "answer")
              s.view.set(
                e.wordId,
                predict(s.view.get(e.wordId), e, this.now()),
              );
          }
        } catch (e) {
          if (s !== this.state || generation !== this.generation) return false;
          if (e.status === 401 && requestSession !== s.session) {
            s.retryAt = this.now();
            this.status = "pending";
            return false;
          }
          if (
            e.status === 401 ||
            e.status === 409 ||
            (e.status >= 400 && e.status < 500 && e.status !== 429)
          ) {
            s.halted = true;
            this.status =
              e.status === 401
                ? "login-required"
                : e.code === "WRITER_REPLACED"
                  ? "writer-replaced"
                  : "sync-rejected";
          } else {
            const delay = [2000, 5000, 15000][s.retries++];
            s.retryAt = delay ? this.now() + delay : 0;
            this.status = "pending-error";
          }
          return false;
        }
      }
      if (s.head === s.queue.length) {
        s.queue = [];
        s.head = 0;
        this.status = "saved";
      } else this.status = "pending";
      return true;
    })();
    try {
      return await s.pending;
    } finally {
      s.pending = null;
    }
  }
  async retryDue() {
    const s = this.state;
    if (s?.retryAt && this.now() >= s.retryAt && !s.halted) {
      s.retryAt = 0;
      return this.save("manual");
    }
    return false;
  }
}
function predict(view, event, time) {
  // Prepared views omit historical counters. Predict only state, never totals.
  const seed = view ? structuredClone(view) : null;
  if (seed)
    for (const type of ["spell", "meaning"])
      if (seed[type])
        Object.assign(seed[type], {
          attempts: 0,
          correct: 0,
          wrong: 0,
          timeouts: 0,
          assistedCorrect: 0,
        });
  const full = applyAnswer(seed, event, time);
  for (const type of ["spell", "meaning"])
    if (full[type])
      for (const key of [
        "attempts",
        "correct",
        "wrong",
        "timeouts",
        "assistedCorrect",
      ])
        delete full[type][key];
  return full;
}
