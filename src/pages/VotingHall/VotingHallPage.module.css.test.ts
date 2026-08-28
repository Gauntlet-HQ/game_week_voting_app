import { describe, expect, it } from "vitest";
import votingHallPageCss from "./VotingHallPage.module.css?raw";

describe("VotingHallPage styles", () => {
  it("does not introduce one-off colors or typefaces outside the design tokens", () => {
    expect(votingHallPageCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(votingHallPageCss).not.toMatch(/\brgba?\(/);
    expect(votingHallPageCss).not.toMatch(/\bcolor\s*:/);
    expect(votingHallPageCss).not.toMatch(/\bfont-family\s*:/);
    expect(votingHallPageCss).not.toMatch(/\bbackground(?:-color)?\s*:/);
  });
});
