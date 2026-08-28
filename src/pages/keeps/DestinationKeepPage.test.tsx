import { describe, expect, it } from "vitest";
import destinationKeepPageSource from "./DestinationKeepPage.tsx?raw";

describe("DestinationKeepPage", () => {
  it("reuses only the locked design-system primitives", () => {
    expect(destinationKeepPageSource).toContain("PageShell");
    expect(destinationKeepPageSource).toContain("ParchmentCard");
    expect(destinationKeepPageSource).toContain("GoldButton");
    expect(destinationKeepPageSource).toContain("HeadingDisplay");
    expect(destinationKeepPageSource).not.toContain("GamePortraitCard");
    expect(destinationKeepPageSource).not.toContain("StoneInput");
  });
});
