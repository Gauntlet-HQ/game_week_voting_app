import { describe, expect, it } from "vitest";
import {
  AWARD_CATEGORIES,
  AWARD_CATEGORY_DISPLAY_NAMES,
  isAwardCategory,
} from "./awardCategories";

describe("awardCategories", () => {
  it("locks the four contest halls to the API enum", () => {
    expect(AWARD_CATEGORIES).toEqual([
      "technical_achievement",
      "creative_or_fun_gameplay",
      "visuals_or_graphics",
      "best_overall",
    ]);
    expect(AWARD_CATEGORY_DISPLAY_NAMES).toEqual({
      technical_achievement: "Technical Achievement",
      creative_or_fun_gameplay: "Most Creative/Fun Gameplay",
      visuals_or_graphics: "Best Visuals/Graphics",
      best_overall: "Best Overall",
    });
  });

  it("accepts only the four award-category enum values", () => {
    expect(isAwardCategory("best_overall")).toBe(true);
    expect(isAwardCategory("not_a_category")).toBe(false);
    expect(isAwardCategory(undefined)).toBe(false);
  });
});
