import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { httpError } from "../base.mjs";
const derive = promisify(scrypt);
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const publicAccount = (row) =>
  row
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        biography: row.biography,
        createdAt: row.created_at,
      }
    : null;

export class IdentityStore {
  constructor(db) {
    this.db = db;
  }
  async register({ username, displayName, password }) {
    if (displayName.trim().length < 2)
      throw httpError(
        400,
        "Display name must contain at least two characters.",
      );
    const salt = randomBytes(16).toString("hex");
    const key = await derive(password, salt, 64);
    try {
      const result = await this.db.query(
        "INSERT INTO accounts(id,username,display_name,password_hash) VALUES($1,$2,$3,$4) RETURNING *",
        [
          randomUUID(),
          username.toLowerCase(),
          displayName.trim(),
          `${salt}:${key.toString("hex")}`,
        ],
      );
      return publicAccount(result.rows[0]);
    } catch (error) {
      if (error.code === "23505")
        throw httpError(409, "That username is already taken.");
      throw error;
    }
  }
  async login({ username, password }) {
    const row = (
      await this.db.query("SELECT * FROM accounts WHERE username=$1", [
        username.toLowerCase(),
      ])
    ).rows[0];
    // Run the same derivation for unknown usernames to reduce account timing disclosure.
    const [salt, stored] = (
      row?.password_hash ||
      "00000000000000000000000000000000:" + "00".repeat(64)
    ).split(":");
    const key = await derive(password, salt, 64);
    if (
      !row?.password_hash ||
      !timingSafeEqual(key, Buffer.from(stored, "hex"))
    )
      throw httpError(401, "Incorrect username or password.");
    return publicAccount(row);
  }
  async issue(account) {
    const token = randomBytes(32).toString("hex");
    await this.db.transaction(async (tx) => {
      await tx.query("DELETE FROM sessions WHERE expires_at < now()");
      await tx.query("INSERT INTO sessions VALUES($1,$2,$3)", [
        hashToken(token),
        account.id,
        new Date(Date.now() + 7 * 86400000),
      ]);
    });
    return token;
  }
  async external(provider, subject, displayName) {
    const lookup = async (tx) =>
      publicAccount(
        (
          await tx.query(
            "SELECT a.* FROM accounts a JOIN external_identities e ON e.account_id=a.id WHERE e.provider=$1 AND e.subject=$2",
            [provider, subject],
          )
        ).rows[0],
      );
    try {
      return await this.db.transaction(async (tx) => {
        const existing = await lookup(tx);
        if (existing) return existing;
        const id = randomUUID();
        const row = (
          await tx.query(
            "INSERT INTO accounts(id,username,display_name) VALUES($1,$2,$3) RETURNING *",
            [id, `${provider}_${randomBytes(8).toString("hex")}`, displayName],
          )
        ).rows[0];
        await tx.query(
          "INSERT INTO external_identities(provider,subject,account_id) VALUES($1,$2,$3)",
          [provider, subject, id],
        );
        return publicAccount(row);
      });
    } catch (error) {
      if (error.code === "23505") {
        const existing = await lookup(this.db);
        if (existing) return existing;
      }
      throw error;
    }
  }
  async session(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return publicAccount(
      (
        await this.db.query(
          "SELECT a.* FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.token_hash=$1 AND s.expires_at>now()",
          [hashToken(token)],
        )
      ).rows[0],
    );
  }
  async logout(token) {
    if (token)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hashToken(token),
      ]);
  }
  async update(id, { displayName, biography }) {
    if (displayName.trim().length < 2)
      throw httpError(
        400,
        "Display name must contain at least two characters.",
      );
    return publicAccount(
      (
        await this.db.query(
          "UPDATE accounts SET display_name=$2,biography=$3 WHERE id=$1 RETURNING *",
          [id, displayName.trim(), biography.trim()],
        )
      ).rows[0],
    );
  }
  async bookmarks(id) {
    return (
      await this.db.query(
        "SELECT repo_id FROM bookmarks WHERE account_id=$1 ORDER BY created_at DESC",
        [id],
      )
    ).rows.map((r) => r.repo_id);
  }
  async bookmark(id, repo, save) {
    if (save)
      await this.db.query(
        "INSERT INTO bookmarks(account_id,repo_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, repo],
      );
    else
      await this.db.query(
        "DELETE FROM bookmarks WHERE account_id=$1 AND repo_id=$2",
        [id, repo],
      );
    return this.bookmarks(id);
  }
}
