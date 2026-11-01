import {
  applyAnswer,
  iso,
  requireThat,
  summarize,
  prepareDeck,
  wordView,
} from "./rules.mjs";
import {
  playerId,
  usernamePlayerId,
  canonicalUsername,
  sign,
  verify,
  randomId,
} from "./auth.mjs";
import { sha256 } from "./lexicon.mjs";
export class LearningService {
  constructor({
    repository,
    lexicon,
    verifyIdentity,
    mappingKey,
    sessionKey,
    profileMode = "verified-id",
    now = Date.now,
    random = Math.random,
  }) {
    requireThat(
      ["verified-id", "username"].includes(profileMode),
      "PROFILE_MODE_INVALID",
      503,
    );
    requireThat(
      mappingKey?.length >= 32 && sessionKey?.length >= 32,
      "SERVER_KEYS_REQUIRED",
      503,
    );
    Object.assign(this, {
      repository,
      lexicon,
      verifyIdentity,
      mappingKey,
      sessionKey,
      profileMode,
      now,
      random,
    });
  }
  async login(credential) {
    requireThat(
      this.profileMode === "verified-id",
      "PROFILE_MODE_MISMATCH",
      400,
    );
    requireThat(this.verifyIdentity, "XBUILDER_IDENTITY_NOT_CONFIGURED", 503);
    const identity = await this.verifyIdentity(credential);
    const id = playerId(identity.issuer, identity.subject, this.mappingKey),
      expiresAt = this.now() + 8 * 3600000;
    return {
      playerId: id,
      session: sign(
        { purpose: "game-session", playerId: id, expiresAt },
        this.sessionKey,
      ),
      expiresAt: iso(expiresAt),
    };
  }
  async loginUsername(value) {
    requireThat(
      this.profileMode === "username",
      "USERNAME_PROFILES_DISABLED",
      503,
    );
    const username = canonicalUsername(value);
    const id = usernamePlayerId(username, this.mappingKey),
      expiresAt = this.now() + 8 * 3600000;
    return {
      playerId: id,
      username,
      profileMode: "username",
      verified: false,
      session: sign(
        { purpose: "username-profile-session", playerId: id, expiresAt },
        this.sessionKey,
      ),
      expiresAt: iso(expiresAt),
    };
  }
  identity(token) {
    const value = verify(token, this.sessionKey);
    requireThat(
      value.purpose ===
        (this.profileMode === "username"
          ? "username-profile-session"
          : "game-session") && value.expiresAt > this.now(),
      "LOGIN_REQUIRED",
      401,
    );
    return value.playerId;
  }
  fresh(id) {
    const at = iso(this.now());
    return {
      schemaVersion: 1,
      lexiconId: this.lexicon.lexiconId,
      contentVersion: this.lexicon.contentVersion,
      learningRuleVersion: 1,
      revision: 1,
      playerId: id,
      profileMode: this.profileMode,
      createdAt: at,
      updatedAt: at,
      sync: {
        writerSessionId: null,
        writerEpoch: 0,
        writerExpiresAt: null,
        lastBatchSeq: 0,
        lastEventSeq: 0,
        lastBatchHash: null,
        lastReceipt: null,
        maxRunSeq: 0,
        lastPreparation: null,
      },
      words: {},
      activeRun: null,
      recentRuns: [],
      totals: { completedRuns: 0 },
    };
  }
  checkWriter(p, body) {
    requireThat(
      p.sync.writerSessionId === body.writerSessionId &&
        p.sync.writerEpoch === body.writerEpoch,
      "WRITER_REPLACED",
      409,
    );
    requireThat(
      Date.parse(p.sync.writerExpiresAt) > this.now(),
      "WRITER_EXPIRED",
      409,
    );
  }
  async prepare(token, body) {
    const id = this.identity(token);
    requireThat(
      body.contentVersion === this.lexicon.contentVersion,
      "CONTENT_VERSION_MISMATCH",
      409,
    );
    return this.repository.serial(id, async () => {
      let current = await this.repository.load(id),
        fresh = current === null;
      const p = structuredClone(current ?? this.fresh(id));
      const owns =
        p.sync.writerSessionId === body.writerSessionId &&
        p.sync.writerEpoch === body.writerEpoch;
      const active =
        p.sync.writerSessionId &&
        Date.parse(p.sync.writerExpiresAt) > this.now();
      if (active && !owns) {
        requireThat(body.takeover === true, "TAKEOVER_REQUIRED", 409);
        requireThat(body.baseRevision === p.revision, "REVISION_CONFLICT", 409);
      }
      if (owns) {
        requireThat(body.baseRevision === p.revision, "REVISION_CONFLICT", 409);
        requireThat(
          body.lastEventSeq === p.sync.lastEventSeq,
          "UNCONFIRMED_EVENTS",
          409,
        );
      }
      const deck = prepareDeck(
        this.lexicon,
        p.words,
        body.wordMode,
        this.now(),
        this.random,
      );
      if (!owns || !active) {
        p.sync = {
          writerSessionId: randomId(),
          writerEpoch: p.sync.writerEpoch + 1,
          writerExpiresAt: iso(this.now() + 24 * 3600000),
          lastBatchSeq: 0,
          lastEventSeq: 0,
          lastBatchHash: null,
          lastReceipt: null,
          maxRunSeq: 0,
          lastPreparation: null,
        };
      } else p.sync.writerExpiresAt = iso(this.now() + 24 * 3600000);
      if (!fresh) p.revision++;
      p.updatedAt = iso(this.now());
      await this.repository.commit(id, p, { insertOnly: fresh });
      const prepared = {
        purpose: "prepared-deck",
        id: randomId(),
        playerId: id,
        writerSessionId: p.sync.writerSessionId,
        writerEpoch: p.sync.writerEpoch,
        contentVersion: this.lexicon.contentVersion,
        wordMode: body.wordMode,
        words: deck.map((w) => w.wordId),
        expiresAt: this.now() + 30 * 60000,
      };
      const response = {
        playerId: id,
        schemaVersion: 1,
        contentVersion: this.lexicon.contentVersion,
        learningRuleVersion: 1,
        revision: p.revision,
        serverTime: iso(this.now()),
        serverTimeMs: this.now(),
        writerSessionId: p.sync.writerSessionId,
        writerEpoch: p.sync.writerEpoch,
        writerExpiresAt: p.sync.writerExpiresAt,
        lastBatchSeq: p.sync.lastBatchSeq,
        lastEventSeq: p.sync.lastEventSeq,
        maxRunSeq: p.sync.maxRunSeq,
        wordMode: body.wordMode,
        preparation: sign(prepared, this.sessionKey),
        summary: summarize(p, this.lexicon, this.now()),
        words: deck.map((w) => ({ ...w, state: wordView(p.words[w.wordId]) })),
      };
      requireThat(
        Buffer.byteLength(JSON.stringify(response)) <= 32768,
        "PREPARE_RESPONSE_BUDGET",
        500,
      );
      return response;
    });
  }
  async view(token) {
    const id = this.identity(token);
    return this.repository.serial(id, async () => {
      const p = await this.repository.load(id);
      return p
        ? {
            revision: p.revision,
            serverTime: iso(this.now()),
            summary: summarize(p, this.lexicon, this.now()),
          }
        : { newUser: true };
    });
  }
  finishRun(p, status) {
    const run = p.activeRun;
    if (!run) return;
    run.status = status;
    run.endedAt = iso(this.now());
    if (status === "won") {
      p.totals.completedRuns++;
      for (const id of run.solved)
        if (p.words[id]) p.words[id].everCompletedInWonRun = true;
    }
    // Keep compact summaries; never truncate the cumulative learning evidence.
    const summary = { ...run };
    delete summary.words;
    delete summary.preparation;
    p.recentRuns.push(summary);
    p.recentRuns = p.recentRuns.slice(-10);
    p.activeRun = null;
  }
  applyEvent(p, e, savedAt) {
    requireThat(Number.isSafeInteger(e.eventSeq), "INVALID_EVENT_SEQUENCE");
    if (e.type === "run-start") {
      requireThat(
        Number.isSafeInteger(e.runSeq) && e.runSeq === p.sync.maxRunSeq + 1,
        "RUN_SEQUENCE_CONFLICT",
        409,
      );
      requireThat(
        e.runId === `${p.sync.writerSessionId}:${e.runSeq}`,
        "INVALID_RUN_ID",
      );
      const prep = verify(e.preparation, this.sessionKey);
      requireThat(
        prep.purpose === "prepared-deck" &&
          prep.playerId === p.playerId &&
          prep.writerSessionId === p.sync.writerSessionId &&
          prep.writerEpoch === p.sync.writerEpoch &&
          prep.contentVersion === this.lexicon.contentVersion,
        "INVALID_PREPARATION",
      );
      requireThat(
        prep.expiresAt > savedAt || p.sync.lastPreparation === prep.id,
        "PREPARATION_EXPIRED",
        409,
      );
      requireThat(
        Array.isArray(prep.words) &&
          prep.words.length === 30 &&
          new Set(prep.words).size === 30,
        "INVALID_PREPARATION",
      );
      this.finishRun(p, "interrupted");
      p.sync.maxRunSeq = e.runSeq;
      p.sync.lastPreparation = prep.id;
      p.activeRun = {
        runId: e.runId,
        runSeq: e.runSeq,
        status: "active",
        wordMode: prep.wordMode,
        contentVersion: prep.contentVersion,
        words: prep.words,
        preparation: prep.id,
        startedAt: iso(savedAt),
        solved: [],
        touched: [],
        failures: 0,
        lastAttemptSeq: 0,
        lastQuestionSeq: 0,
        lastCheckpoint: 0,
      };
      return;
    }
    const run = p.activeRun;
    requireThat(run && e.runId === run.runId, "RUN_NOT_ACTIVE", 409);
    if (e.type === "answer") {
      requireThat(
        Number.isSafeInteger(e.questionSeq) &&
          e.questionSeq > run.lastQuestionSeq,
        "QUESTION_ALREADY_FINAL",
        409,
      );
      requireThat(
        run.words.includes(e.wordId) && e.contentVersion === run.contentVersion,
        "WORD_NOT_IN_RUN",
      );
      const word = this.lexicon.byId.get(e.wordId);
      requireThat(
        word && (word.spellable || e.questionType === "meaning"),
        "WORD_NOT_SPELLABLE",
      );
      p.words[e.wordId] = applyAnswer(p.words[e.wordId], e, savedAt);
      run.lastQuestionSeq = e.questionSeq;
      if (!run.touched.includes(e.wordId)) run.touched.push(e.wordId);
      if (e.result === "correct" && !run.solved.includes(e.wordId))
        run.solved.push(e.wordId);
    } else if (e.type === "failure") {
      requireThat(
        Number.isSafeInteger(e.attemptSeq) &&
          e.attemptSeq === run.lastAttemptSeq + 1,
        "DUPLICATE_FAILURE",
        409,
      );
      run.failures++;
      run.lastAttemptSeq = e.attemptSeq;
    } else if (e.type === "checkpoint") {
      requireThat(
        Number.isSafeInteger(e.checkpoint) && e.checkpoint > run.lastCheckpoint,
        "DUPLICATE_CHECKPOINT",
        409,
      );
      run.lastCheckpoint = e.checkpoint;
    } else if (e.type === "won" || e.type === "abandoned")
      this.finishRun(p, e.type);
    else requireThat(false, "INVALID_EVENT_TYPE");
  }
  async submit(token, body) {
    const id = this.identity(token);
    requireThat(
      Array.isArray(body.events) &&
        body.events.length > 0 &&
        body.events.length <= 200,
      "BATCH_EVENT_LIMIT",
      413,
    );
    requireThat(
      Buffer.byteLength(JSON.stringify(body)) <= 262144,
      "BATCH_BYTE_LIMIT",
      413,
    );
    requireThat(
      Number.isSafeInteger(body.batchSeq) &&
        body.batchSeq >= 1 &&
        body.batchId === `${body.writerSessionId}:${body.batchSeq}`,
      "INVALID_BATCH",
    );
    const hash = sha256(JSON.stringify(body));
    return this.repository.serial(id, async () => {
      const current = await this.repository.load(id);
      requireThat(current, "PROFILE_NOT_PREPARED", 409);
      this.checkWriter(current, body);
      // Dedupe before checking a base revision that necessarily became stale.
      if (body.batchSeq === current.sync.lastBatchSeq) {
        requireThat(
          hash === current.sync.lastBatchHash,
          "BATCH_PAYLOAD_CHANGED",
          409,
        );
        return current.sync.lastReceipt;
      }
      if (body.batchSeq < current.sync.lastBatchSeq)
        return { ...current.sync.lastReceipt, alreadyProcessed: true };
      requireThat(
        body.batchSeq === current.sync.lastBatchSeq + 1,
        "BATCH_SEQUENCE_GAP",
        409,
      );
      requireThat(
        body.baseRevision === current.revision,
        "REVISION_CONFLICT",
        409,
      );
      const p = structuredClone(current),
        savedAt = this.now();
      for (const e of body.events) {
        requireThat(
          e.eventSeq === p.sync.lastEventSeq + 1,
          "EVENT_SEQUENCE_GAP",
          409,
        );
        this.applyEvent(p, e, savedAt);
        p.sync.lastEventSeq = e.eventSeq;
      }
      p.revision++;
      p.updatedAt = iso(savedAt);
      p.sync.lastBatchSeq = body.batchSeq;
      p.sync.lastBatchHash = hash;
      p.sync.writerExpiresAt = iso(savedAt + 24 * 3600000);
      const receipt = {
        batchId: body.batchId,
        batchSeq: body.batchSeq,
        lastEventSeq: p.sync.lastEventSeq,
        revision: p.revision,
        savedAt: iso(savedAt),
        summary: summarize(p, this.lexicon, savedAt),
      };
      p.sync.lastReceipt = receipt;
      await this.repository.commit(id, p);
      return receipt;
    });
  }
}
