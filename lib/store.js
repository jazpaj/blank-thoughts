import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Append-only JSON file store for waitlist signups. This is the backup copy the
 * brief asks for; it is also the source of truth for waitlist positions.
 * Writes are serialized through a promise queue and committed atomically
 * (write temp file, then rename) so a crash never leaves a half-written file.
 */
export class SignupStore {
  constructor(file) {
    this.file = file;
    this.records = [];
    this.queue = Promise.resolve();
  }

  async load() {
    await fsp.mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.records = JSON.parse(await fsp.readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.records = [];
    }
    return this;
  }

  get count() {
    return this.records.length;
  }

  findDuplicate({ email, phone }) {
    return this.records.find((r) => r.email === email || (phone && r.phone === phone)) ?? null;
  }

  /** Adds a signup unless the email/phone is already on the list. */
  add(values) {
    return this.#serial(async () => {
      const existing = this.findDuplicate(values);
      if (existing) return { record: existing, duplicate: true };

      const record = { position: this.records.length + 1, createdAt: new Date().toISOString(), ...values };
      this.records.push(record);
      await this.#persist();
      return { record, duplicate: false };
    });
  }

  update(position, patch) {
    return this.#serial(async () => {
      const rec = this.records.find((r) => r.position === position);
      if (!rec) return;
      Object.assign(rec, patch);
      await this.#persist();
    });
  }

  #serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async #persist() {
    const tmp = this.file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(this.records, null, 2));
    await fsp.rename(tmp, this.file);
  }
}

const CSV_COLUMNS = [
  'position', 'createdAt', 'name', 'email', 'phone', 'smsConsent',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'referrer', 'klaviyo',
];

export function toCsv(records) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    // Leading =,+,-,@ would be executed as formulas by spreadsheet apps
    // (E.164 phone numbers like +12125550123 are harmless and left intact).
    const safe = /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? "'" + s : s;
    return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };
  const rows = records.map((r) =>
    CSV_COLUMNS.map((c) => esc(c in r ? r[c] : r.tracking?.[c])).join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
