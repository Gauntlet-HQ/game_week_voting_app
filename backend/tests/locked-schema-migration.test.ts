import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCKED_SCHEMA_MIGRATION_PATH } from "../src/database/apply-migrations.js";

const LOCKED_PRODUCT_TABLES = [
  "voters",
  "games",
  "ballots",
  "votes",
  "staff_credentials"
] as const;

describe("locked schema migration DDL", () => {
  const sql = readFileSync(LOCKED_SCHEMA_MIGRATION_PATH, "utf8");

  it("does not invent product tables beyond the locked schema", () => {
    const createdTables = [
      ...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)
    ].map((match) => match[1]);
    expect(createdTables.sort()).toEqual([...LOCKED_PRODUCT_TABLES].sort());
  });

  it("uses ON DELETE RESTRICT and never CASCADE on foreign keys", () => {
    expect(sql).toMatch(
      /REFERENCES voters \(voter_id\) ON DELETE RESTRICT/
    );
    expect(sql).toMatch(
      /REFERENCES ballots \(ballot_id\) ON DELETE RESTRICT/
    );
    expect(sql).toMatch(/REFERENCES games \(game_id\) ON DELETE RESTRICT/);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    expect(
      (sql.match(/REFERENCES \w+ \(\w+\) ON DELETE RESTRICT/g) ?? []).length
    ).toBe(4);
  });

  it("declares the locked award_category enum and ballot lock triggers", () => {
    expect(sql).toContain("'technical_achievement'");
    expect(sql).toContain("'creative_or_fun_gameplay'");
    expect(sql).toContain("'visuals_or_graphics'");
    expect(sql).toContain("'best_overall'");
    expect(sql).toContain("votes_reject_voter_mismatch");
    expect(sql).toContain("ballots_reject_lock_without_all_categories");
    expect(sql).toContain("withdrawn_from_ballot = TRUE");
    expect(sql).toMatch(
      /EXISTS\s*\(\s*SELECT 1\s*FROM votes\s*INNER JOIN games ON games\.game_id = votes\.game_id/s
    );
    expect(sql).toContain("ballots_reject_unlock");
    expect(sql).toContain("votes_freeze_after_ballot_lock");
  });
});
