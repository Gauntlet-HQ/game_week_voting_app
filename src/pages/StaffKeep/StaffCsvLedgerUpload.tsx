import { useRef, useState, type FormEvent } from "react";
import { GoldButton, HeadingDisplay, ParchmentCard } from "../../design-system";
import styles from "./StaffKeepPage.module.css";

type StaffCsvLedgerUploadProperties = {
  ledgerHeading: string;
  ledgerDescription: string;
  csvFileInputName: string;
  csvFileInputLabelText: string;
  chooseCsvButtonLabel: string;
  inscribeLedgerButtonLabel: string;
  isInscribingLedger: boolean;
  ledgerFeedbackMessage: string | undefined;
  onInscribeChosenCsvText: (csvText: string) => Promise<void>;
};

export function StaffCsvLedgerUpload({
  ledgerHeading,
  ledgerDescription,
  csvFileInputName,
  csvFileInputLabelText,
  chooseCsvButtonLabel,
  inscribeLedgerButtonLabel,
  isInscribingLedger,
  ledgerFeedbackMessage,
  onInscribeChosenCsvText,
}: StaffCsvLedgerUploadProperties) {
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [chosenCsvFile, setChosenCsvFile] = useState<File | undefined>(
    undefined,
  );

  async function submitChosenCsvFile(
    formSubmitEvent: FormEvent<HTMLFormElement>,
  ) {
    formSubmitEvent.preventDefault();

    if (!chosenCsvFile || isInscribingLedger) {
      return;
    }

    const csvText = await chosenCsvFile.text();
    await onInscribeChosenCsvText(csvText);
  }

  return (
    <ParchmentCard>
      <HeadingDisplay headingLevel={2} inkTone="parchment">
        {ledgerHeading}
      </HeadingDisplay>
      <p>{ledgerDescription}</p>
      <form className={styles.csvFilePicker} onSubmit={submitChosenCsvFile}>
        <input
          ref={csvFileInputRef}
          id={csvFileInputName}
          name={csvFileInputName}
          type="file"
          accept=".csv,text/csv"
          className={styles.visuallyHiddenFileInput}
          aria-label={csvFileInputLabelText}
          disabled={isInscribingLedger}
          onChange={(changeEvent) => {
            setChosenCsvFile(changeEvent.target.files?.[0]);
          }}
        />
        <p>
          {chosenCsvFile
            ? `Chosen scroll: ${chosenCsvFile.name}`
            : "No scroll chosen yet."}
        </p>
        <div className={styles.staffKeepActions}>
          <GoldButton
            variant="secondary"
            isDisabled={isInscribingLedger}
            onClick={() => {
              csvFileInputRef.current?.click();
            }}
          >
            {chooseCsvButtonLabel}
          </GoldButton>
          <GoldButton
            type="submit"
            isDisabled={!chosenCsvFile || isInscribingLedger}
          >
            {inscribeLedgerButtonLabel}
          </GoldButton>
        </div>
      </form>
      {ledgerFeedbackMessage ? <p>{ledgerFeedbackMessage}</p> : null}
    </ParchmentCard>
  );
}
