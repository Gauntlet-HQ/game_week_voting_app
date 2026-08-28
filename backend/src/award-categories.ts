export const AWARD_CATEGORIES = [
  "technical_achievement",
  "creative_or_fun_gameplay",
  "visuals_or_graphics",
  "best_overall"
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export function isAwardCategory(value: string): value is AwardCategory {
  return (AWARD_CATEGORIES as readonly string[]).includes(value);
}
