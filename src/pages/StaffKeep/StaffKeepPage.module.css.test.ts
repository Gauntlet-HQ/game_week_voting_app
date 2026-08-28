import { describe, expect, it } from "vitest";
import staffKeepPageCss from "./StaffKeepPage.module.css?raw";

describe("StaffKeepPage styles", () => {
  it("does not introduce one-off colors or typefaces outside the design tokens", () => {
    expect(staffKeepPageCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(staffKeepPageCss).not.toMatch(/\brgba?\(/);
    expect(staffKeepPageCss).not.toMatch(/\bcolor\s*:/);
    expect(staffKeepPageCss).not.toMatch(/\bfont-family\s*:/);
    expect(staffKeepPageCss).not.toMatch(/\bbackground(?:-color)?\s*:/);
  });
});
