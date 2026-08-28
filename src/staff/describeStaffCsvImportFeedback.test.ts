import { describe, expect, it } from "vitest";
import {
  describeGamesCsvImportSummary,
  describeVoterRosterCsvImportSummary,
} from "./describeStaffCsvImportFeedback";

describe("describeStaffCsvImportFeedback", () => {
  it("reports games upsert, delete, and withdraw counts from the import summary", () => {
    expect(
      describeGamesCsvImportSummary({
        upserted: 2,
        deleted: 1,
        withdrawn: 0,
      }),
    ).toBe(
      "The games ledger accepted 2 rows (1 deleted, 0 withdrawn for existing votes).",
    );
  });

  it("reports roster upsert, delete, and kept-because-ballot counts", () => {
    expect(
      describeVoterRosterCsvImportSummary({
        upserted: 3,
        deleted: 1,
        keptBecauseBallotExists: 1,
      }),
    ).toBe(
      "The roster ledger accepted 3 names (1 deleted, 1 kept because a ballot exists).",
    );
  });
});
