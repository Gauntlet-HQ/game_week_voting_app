import type { ButtonHTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "../joinClassNames";
import styles from "./GoldButton.module.css";

export type GoldButtonVariant = "primary" | "secondary" | "danger";

type GoldButtonProperties = {
  children: ReactNode;
  variant?: GoldButtonVariant;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  isDisabled?: boolean;
  onClick?: () => void;
};

const goldButtonClassNameByVariant: Record<GoldButtonVariant, string> = {
  primary: styles.goldButtonPrimary,
  secondary: styles.goldButtonSecondary,
  danger: styles.goldButtonDanger,
};

export function GoldButton({
  children,
  variant = "primary",
  type = "button",
  isDisabled = false,
  onClick,
}: GoldButtonProperties) {
  return (
    <button
      type={type}
      className={joinClassNames(
        styles.goldButton,
        goldButtonClassNameByVariant[variant],
      )}
      disabled={isDisabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
