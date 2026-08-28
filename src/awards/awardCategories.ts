export const AWARD_CATEGORIES = [
  "technical_achievement",
  "creative_or_fun_gameplay",
  "visuals_or_graphics",
  "best_overall",
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export const AWARD_CATEGORY_DISPLAY_NAMES: Record<AwardCategory, string> = {
  technical_achievement: "Technical Achievement",
  creative_or_fun_gameplay: "Most Creative/Fun Gameplay",
  visuals_or_graphics: "Best Visuals/Graphics",
  best_overall: "Best Overall",
};

export function isAwardCategory(value: unknown): value is AwardCategory {
  return (
    typeof value === "string" &&
    (AWARD_CATEGORIES as readonly string[]).includes(value)
  );
}
