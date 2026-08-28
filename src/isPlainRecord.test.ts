import { describe, expect, it } from "vitest";
import { isPlainRecord } from "./isPlainRecord";

describe("isPlainRecord", () => {
  it("accepts plain objects and rejects arrays, null, and primitives", () => {
    expect(isPlainRecord({ displayName: "Ada" })).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord("Ada")).toBe(false);
  });
});
