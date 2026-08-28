import type { HTMLInputTypeAttribute } from "react";
import styles from "./StoneInput.module.css";

type StoneInputProperties = {
  labelText: string;
  inputName: string;
  value: string;
  onValueChange: (nextValue: string) => void;
  inputType?: Extract<
    HTMLInputTypeAttribute,
    "text" | "password" | "url" | "email"
  >;
  placeholderText?: string;
  isDisabled?: boolean;
};

export function StoneInput({
  labelText,
  inputName,
  value,
  onValueChange,
  inputType = "text",
  placeholderText,
  isDisabled = false,
}: StoneInputProperties) {
  const inputId = `stone-input-${inputName}`;

  return (
    <label className={styles.stoneInputLabel} htmlFor={inputId}>
      <span className={styles.stoneInputLabelText}>{labelText}</span>
      <input
        id={inputId}
        name={inputName}
        type={inputType}
        className={styles.stoneInput}
        value={value}
        placeholder={placeholderText}
        disabled={isDisabled}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      />
    </label>
  );
}
