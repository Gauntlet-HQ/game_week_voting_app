import type { ReactNode } from "react";
import styles from "./ParchmentCard.module.css";

type ParchmentCardProperties = {
  children: ReactNode;
};

export function ParchmentCard({ children }: ParchmentCardProperties) {
  return <article className={styles.parchmentCard}>{children}</article>;
}
