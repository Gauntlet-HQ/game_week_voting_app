import { useState } from "react";
import tokensCssSource from "../../design-system/tokens.css?raw";
import {
  GamePortraitCard,
  GoldButton,
  HeadingDisplay,
  PageShell,
  ParchmentCard,
  StoneInput,
} from "../../design-system";
import { readLockedDesignTokensFromCssSource } from "../../design-system/readLockedDesignTokensFromCssSource";
import styles from "./DesignSystemGallery.module.css";

const lockedDesignTokens =
  readLockedDesignTokensFromCssSource(tokensCssSource);

const colorTokenEntries = Object.entries(lockedDesignTokens).filter(
  ([tokenName]) => tokenName.startsWith("--color-"),
);

const galleryGamePortraits = [
  {
    gameTitle: "Rift of the Hollow King",
    submitterName: "Thalen",
    gameUrl: "https://example.com/rift",
  },
  {
    gameTitle: "Lanterns of Qeynos",
    submitterName: "Mira",
    gameUrl: "https://example.com/lanterns",
  },
  {
    gameTitle: "Storms over Karana",
    submitterName: "Brannoc",
    gameUrl: "https://example.com/karana",
  },
] as const;

const voteCategoryNames = [
  "Technical Achievement",
  "Most Creative/Fun Gameplay",
  "Best Visuals/Graphics",
  "Best Overall",
] as const;

export function DesignSystemGallery() {
  const [ledgerName, setLedgerName] = useState("");
  const [selectedGameTitle, setSelectedGameTitle] = useState<string>(
    galleryGamePortraits[1].gameTitle,
  );

  return (
    <PageShell>
      <header className={styles.galleryHeader}>
        <HeadingDisplay>Game Week Voting</HeadingDisplay>
        <p className={styles.kicker}>Design system gallery</p>
        <p className={styles.lede}>
          Stone halls, gold trim, parchment missives, and ember-framed
          portraits. These primitives are the guild&apos;s visual language;
          voting, roster gates, and staff ledgers come later.
        </p>
      </header>

      <section className={styles.gallerySection}>
        <HeadingDisplay headingLevel={2}>Heraldry</HeadingDisplay>
        <div className={styles.swatchGrid}>
          {colorTokenEntries.map(([tokenName, tokenValue]) => (
            <div className={styles.swatch} key={tokenName}>
              <span
                className={styles.swatchChip}
                style={{ backgroundColor: `var(${tokenName})` }}
              />
              <span className={styles.swatchName}>{tokenName}</span>
              <span className={styles.swatchValue}>{tokenValue}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.gallerySection}>
        <HeadingDisplay headingLevel={2}>Inscriptions</HeadingDisplay>
        <ParchmentCard>
          <HeadingDisplay headingLevel={3} inkTone="parchment">
            Four Banners of the Contest
          </HeadingDisplay>
          <p>
            Each champion may raise a standard in only one of these halls:
          </p>
          <ul className={styles.bannerList}>
            {voteCategoryNames.map((categoryName) => (
              <li key={categoryName}>{categoryName}</li>
            ))}
          </ul>
        </ParchmentCard>
      </section>

      <section className={styles.gallerySection}>
        <HeadingDisplay headingLevel={2}>Command Seals</HeadingDisplay>
        <div className={styles.buttonRow}>
          <GoldButton>Cast Primary Vote</GoldButton>
          <GoldButton variant="secondary">Return to Roster</GoldButton>
          <GoldButton variant="danger">Expunge the Ledger</GoldButton>
          <GoldButton isDisabled>Sealed Ballot</GoldButton>
        </div>
      </section>

      <section className={styles.gallerySection}>
        <HeadingDisplay headingLevel={2}>Ledger Fields</HeadingDisplay>
        <div className={styles.ledgerPanel}>
          <StoneInput
            labelText="Champion Name"
            inputName="championName"
            value={ledgerName}
            onValueChange={setLedgerName}
            placeholderText="Choose from the roster"
          />
        </div>
      </section>

      <section className={styles.gallerySection}>
        <HeadingDisplay headingLevel={2}>Character Select</HeadingDisplay>
        <div className={styles.portraitGrid}>
          {galleryGamePortraits.map((portrait) => (
            <GamePortraitCard
              key={portrait.gameTitle}
              gameTitle={portrait.gameTitle}
              submitterName={portrait.submitterName}
              gameUrl={portrait.gameUrl}
              isSelected={portrait.gameTitle === selectedGameTitle}
              onSelectPortrait={() => {
                setSelectedGameTitle(portrait.gameTitle);
              }}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
