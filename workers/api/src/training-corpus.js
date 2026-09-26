import { DurableObject } from 'cloudflare:workers';
import { rowToTrainingRecord } from './training-data.js';
const EXPORT_BATCH_MAX = 200;

export class TrainingCorpus extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS examples (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      contributor_hash TEXT NOT NULL,
      thread_hash TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      surface TEXT NOT NULL,
      target_language TEXT NOT NULL,
      user_text TEXT NOT NULL,
      assistant_text TEXT NOT NULL,
      user_script TEXT NOT NULL,
      assistant_script TEXT NOT NULL,
      model TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      consent_version INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(contributor_hash, surface, thread_hash, turn_id)
    )`);
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS examples_contributor ON examples(contributor_hash)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS examples_created ON examples(seq, created_at)');
    const columns = ctx.storage.sql.exec('PRAGMA table_info(examples)').toArray();
    if (!columns.some(column => column.name === 'consent_version')) {
      ctx.storage.sql.exec('ALTER TABLE examples ADD COLUMN consent_version INTEGER NOT NULL DEFAULT 0');
    }
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS contributor_deletions (
      contributor_hash TEXT PRIMARY KEY,
      consent_version INTEGER NOT NULL
    )`);
  }

  append(example, consentVersion) {
    if (!example || typeof example !== 'object') return { stored: false };
    const version = Number(consentVersion);
    if (!Number.isInteger(version) || version < 1) return { stored: false };
    try {
      const deletion = this.ctx.storage.sql.exec(
        'SELECT consent_version FROM contributor_deletions WHERE contributor_hash = ?',
        example.contributorHash
      ).toArray();
      if (deletion.length && Number(deletion[0].consent_version) >= version) return { stored: false };
      this.ctx.storage.sql.exec(`INSERT INTO examples (
        id, contributor_hash, thread_hash, turn_id, surface, target_language,
        user_text, assistant_text, user_script, assistant_script, model, policy_version, consent_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      example.id,
      example.contributorHash,
      example.threadHash,
      example.turnId,
      example.surface,
      example.targetLanguage,
      example.userText,
      example.assistantText,
      example.userScript,
      example.assistantScript,
      example.model,
      example.policyVersion,
      version,
      example.createdAt);
      const rows = this.ctx.storage.sql.exec('SELECT changes() AS changed').toArray();
      return { stored: Number(rows[0]?.changed ?? 0) > 0 };
    } catch {
      return { stored: false };
    }
  }

  deleteContributor(contributorHash, consentVersion) {
    if (typeof contributorHash !== 'string' || contributorHash.length !== 64) return { deleted: 0 };
    const version = Number(consentVersion);
    if (!Number.isInteger(version) || version < 0) return { deleted: 0 };
    this.ctx.storage.sql.exec(`INSERT INTO contributor_deletions (contributor_hash, consent_version)
      VALUES (?, ?)
      ON CONFLICT(contributor_hash) DO UPDATE SET
        consent_version=MAX(contributor_deletions.consent_version, excluded.consent_version)`, contributorHash, version);
    this.ctx.storage.sql.exec('DELETE FROM examples WHERE contributor_hash = ?', contributorHash);
    const rows = this.ctx.storage.sql.exec('SELECT changes() AS changed').toArray();
    return { deleted: Number(rows[0]?.changed ?? 0) };
  }

  exportBatch(after = 0, limit = 250) {
    const cursor = Number.isInteger(Number(after)) && Number(after) >= 0 ? Number(after) : 0;
    const size = Math.max(1, Math.min(EXPORT_BATCH_MAX, Number(limit) || 250));
    const rows = this.ctx.storage.sql.exec(`SELECT * FROM examples
      WHERE seq > ? ORDER BY seq ASC LIMIT ?`, cursor, size).toArray();
    const next = rows.length ? Number(rows.at(-1).seq) : cursor;
    return {
      records: rows.map(rowToTrainingRecord),
      next,
      hasMore: rows.length === size,
    };
  }
}
