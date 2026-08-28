import { describe, expect, it } from "vitest";
import { readLockedDesignTokensFromCssSource } from "./readLockedDesignTokensFromCssSource";
import tokensCssSource from "./tokens.css?raw";

const lockedDesignTokens =
  readLockedDesignTokensFromCssSource(tokensCssSource);

function readPixelLength(cssLength: string): number {
  return Number.parseFloat(cssLength);
}

describe("locked fantasy design tokens", () => {
  it("keeps the stone, gold, parchment, ember, and danger palette in one stylesheet", () => {
    expect(lockedDesignTokens).toMatchObject({
      "--color-stone-page-background": "#1a1410",
      "--color-stone-panel-background": "#2a221c",
      "--color-stone-raised-background": "#3a3028",
      "--color-gold-trim": "#c9a227",
      "--color-gold-hover": "#e0c35a",
      "--color-gold-muted": "#8a7018",
      "--color-parchment-fill": "#e8d9b8",
      "--color-parchment-ink": "#1f170f",
      "--color-parchment-faded-ink": "#5c4a32",
      "--color-ember-selected-focus": "#c45c26",
      "--color-danger-wax-seal": "#8b1e1e",
    });
  });

  it("uses a display serif for titles and a readable serif for body copy", () => {
    expect(lockedDesignTokens["--font-family-display"]).toContain("Cinzel");
    expect(lockedDesignTokens["--font-family-display"]).toMatch(/serif\s*$/);
    expect(lockedDesignTokens["--font-family-display"]).not.toMatch(
      /system-ui|sans-serif|Segoe UI|Arial/i,
    );
    expect(lockedDesignTokens["--font-family-body"]).toContain(
      "Libre Baskerville",
    );
    expect(lockedDesignTokens["--font-family-body"]).toMatch(/serif\s*$/);
  });

  it("keeps chiseled card corners and tighter button corners", () => {
    expect(lockedDesignTokens["--radius-card"]).toBe("4px");
    expect(lockedDesignTokens["--radius-button"]).toBe("2px");
    expect(readPixelLength(lockedDesignTokens["--radius-button"])).toBeLessThan(
      readPixelLength(lockedDesignTokens["--radius-card"]),
    );
  });

  it("uses a 1px gold card border and a 2px ember selected portrait ring", () => {
    expect(lockedDesignTokens["--border-width-card"]).toBe("1px");
    expect(lockedDesignTokens["--border-width-selected-portrait"]).toBe("2px");
  });
});

describe("readLockedDesignTokensFromCssSource", () => {
  it("rejects a stylesheet that has no :root token block", () => {
    expect(() =>
      readLockedDesignTokensFromCssSource(".orphan { color: gold; }"),
    ).toThrow(/:root/);
  });
});
