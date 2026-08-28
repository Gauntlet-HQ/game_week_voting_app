import { joinClassNames } from "../joinClassNames";
import styles from "./GamePortraitCard.module.css";

type GamePortraitCardProperties = {
  gameTitle: string;
  submitterName: string;
  gameUrl?: string;
  isSelected?: boolean;
  onSelectPortrait?: () => void;
};

export function GamePortraitCard({
  gameTitle,
  submitterName,
  gameUrl,
  isSelected = false,
  onSelectPortrait,
}: GamePortraitCardProperties) {
  return (
    <button
      type="button"
      className={joinClassNames(
        styles.gamePortraitCard,
        isSelected && styles.gamePortraitCardSelected,
      )}
      aria-pressed={isSelected}
      onClick={onSelectPortrait}
    >
      <span className={styles.portraitWell} aria-hidden="true">
        <span className={styles.portraitSigil} />
      </span>
      <span className={styles.portraitNameplate}>
        <span className={styles.gameTitle}>{gameTitle}</span>
        <span className={styles.submitterName}>Submitted by {submitterName}</span>
        {gameUrl ? <span className={styles.gameUrl}>{gameUrl}</span> : null}
      </span>
    </button>
  );
}
