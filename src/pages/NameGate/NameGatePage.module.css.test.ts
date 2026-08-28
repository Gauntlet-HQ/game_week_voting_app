import { describe, expect, it } from "vitest";
import nameGatePageCss from "./NameGatePage.module.css?raw";

describe("NameGatePage styles", () => {
  it("does not introduce one-off colors or typefaces outside the design tokens", () => {
    expect(nameGatePageCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nameGatePageCss).not.toMatch(/\brgba?\(/);
    expect(nameGatePageCss).not.toMatch(/\bcolor\s*:/);
    expect(nameGatePageCss).not.toMatch(/\bfont-family\s*:/);
    expect(nameGatePageCss).not.toMatch(/\bbackground(?:-color)?\s*:/);
  });
});
