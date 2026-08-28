import { describe, expect, it } from "vitest";
import { joinClassNames } from "./joinClassNames";

describe("joinClassNames", () => {
  it("joins truthy class names and drops empty values", () => {
    expect(joinClassNames("frame", false, undefined, "selected", null, "")).toBe(
      "frame selected",
    );
  });
});
