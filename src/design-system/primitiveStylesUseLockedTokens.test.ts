import { describe, it } from "vitest";
import gamePortraitCardCss from "./GamePortraitCard/GamePortraitCard.module.css?raw";
import goldButtonCss from "./GoldButton/GoldButton.module.css?raw";
import headingDisplayCss from "./HeadingDisplay/HeadingDisplay.module.css?raw";
import pageShellCss from "./PageShell/PageShell.module.css?raw";
import parchmentCardCss from "./ParchmentCard/ParchmentCard.module.css?raw";
import stoneInputCss from "./StoneInput/StoneInput.module.css?raw";
import { assertCssSourceUsesCustomProperties } from "../test/assertCssSourceUsesCustomProperties";

describe("primitive styles use locked design tokens", () => {
  it("paints PageShell with the stone page field and body serif", () => {
    assertCssSourceUsesCustomProperties(pageShellCss, [
      "--color-stone-page-background",
      "--color-stone-raised-background",
      "--color-parchment-fill",
      "--font-family-body",
    ]);
  });

  it("cuts ParchmentCard from parchment fill, gold trim, and the card radius", () => {
    assertCssSourceUsesCustomProperties(parchmentCardCss, [
      "--color-parchment-fill",
      "--color-parchment-ink",
      "--color-parchment-faded-ink",
      "--color-gold-trim",
      "--color-stone-page-background",
      "--radius-card",
      "--border-width-card",
      "--font-family-body",
    ]);
  });

  it("casts GoldButton variants from gold, stone, ember, and wax-seal tokens", () => {
    assertCssSourceUsesCustomProperties(goldButtonCss, [
      "--font-family-display",
      "--radius-button",
      "--border-width-card",
      "--color-gold-trim",
      "--color-gold-hover",
      "--color-gold-muted",
      "--color-stone-raised-background",
      "--color-parchment-ink",
      "--color-parchment-fill",
      "--color-danger-wax-seal",
      "--color-ember-selected-focus",
      "--border-width-selected-portrait",
    ]);
  });

  it("carves StoneInput from the stone panel with gold trim and an ember focus ring", () => {
    assertCssSourceUsesCustomProperties(stoneInputCss, [
      "--color-stone-panel-background",
      "--color-gold-trim",
      "--color-parchment-fill",
      "--color-parchment-faded-ink",
      "--color-ember-selected-focus",
      "--radius-button",
      "--border-width-card",
      "--border-width-selected-portrait",
      "--font-family-display",
      "--font-family-body",
    ]);
  });

  it("sets HeadingDisplay in the display serif with gold ink", () => {
    assertCssSourceUsesCustomProperties(headingDisplayCss, [
      "--font-family-display",
      "--color-gold-trim",
      "--color-parchment-ink",
      "--color-stone-page-background",
    ]);
  });

  it("frames GamePortraitCard in gold and swaps to a 2px ember ring when selected", () => {
    assertCssSourceUsesCustomProperties(gamePortraitCardCss, [
      "--color-gold-trim",
      "--color-ember-selected-focus",
      "--border-width-card",
      "--border-width-selected-portrait",
      "--radius-card",
      "--color-parchment-fill",
      "--color-parchment-ink",
      "--color-parchment-faded-ink",
      "--font-family-display",
      "--font-family-body",
    ]);
  });
});
