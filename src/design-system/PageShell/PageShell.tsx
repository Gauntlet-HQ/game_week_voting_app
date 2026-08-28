import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

type PageShellProperties = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProperties) {
  return (
    <div className={styles.pageShell}>
      <div className={styles.pageShellInner}>
        <main className={styles.pageShellMain}>{children}</main>
      </div>
    </div>
  );
}
