import type { ReactNode } from "react";
import { joinClassNames } from "../joinClassNames";
import styles from "./HeadingDisplay.module.css";

export type HeadingDisplayLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingDisplayInkTone = "gold" | "parchment";

type HeadingDisplayProperties = {
  children: ReactNode;
  headingLevel?: HeadingDisplayLevel;
  inkTone?: HeadingDisplayInkTone;
};

const headingTagNameByLevel = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

const headingClassNameByLevel: Record<HeadingDisplayLevel, string> = {
  1: styles.headingDisplayLevel1,
  2: styles.headingDisplayLevel2,
  3: styles.headingDisplayLevel3,
  4: styles.headingDisplayLevel4,
  5: styles.headingDisplayLevel5,
  6: styles.headingDisplayLevel6,
};

const headingClassNameByInkTone: Record<HeadingDisplayInkTone, string> = {
  gold: styles.headingDisplayInkGold,
  parchment: styles.headingDisplayInkParchment,
};

export function HeadingDisplay({
  children,
  headingLevel = 1,
  inkTone = "gold",
}: HeadingDisplayProperties) {
  const HeadingTag = headingTagNameByLevel[headingLevel];

  return (
    <HeadingTag
      className={joinClassNames(
        styles.headingDisplay,
        headingClassNameByLevel[headingLevel],
        headingClassNameByInkTone[inkTone],
      )}
    >
      {children}
    </HeadingTag>
  );
}
