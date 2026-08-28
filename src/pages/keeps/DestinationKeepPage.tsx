import {
  GoldButton,
  HeadingDisplay,
  PageShell,
  ParchmentCard,
} from "../../design-system";

type DestinationKeepKind = "voter" | "staff";

type DestinationKeepPageProperties = {
  keepKind: DestinationKeepKind;
  displayName: string;
  onReturnToNameGate: () => void;
};

export function DestinationKeepPage({
  keepKind,
  displayName,
  onReturnToNameGate,
}: DestinationKeepPageProperties) {
  const keepTitle = keepKind === "staff" ? "Staff keep" : "Champion's keep";
  const welcomeText =
    keepKind === "staff"
      ? `Welcome, ${displayName}. The staff ledger will open here.`
      : `Welcome, ${displayName}. The voting hall will open here.`;

  return (
    <PageShell>
      <HeadingDisplay>{keepTitle}</HeadingDisplay>
      <ParchmentCard>
        <p>{welcomeText}</p>
        <GoldButton onClick={onReturnToNameGate}>
          Return to the name gate
        </GoldButton>
      </ParchmentCard>
    </PageShell>
  );
}
