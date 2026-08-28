import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StoneInput } from "./StoneInput";

function BoundChampionNameField() {
  const [championName, setChampionName] = useState("");

  return (
    <StoneInput
      labelText="Champion Name"
      inputName="championName"
      value={championName}
      onValueChange={setChampionName}
      placeholderText="Choose from the roster"
    />
  );
}

describe("StoneInput", () => {
  it("associates the visible label with the stone field and records typed ink", async () => {
    const user = userEvent.setup();

    render(<BoundChampionNameField />);

    const championNameField = screen.getByLabelText("Champion Name");
    await user.type(championNameField, "Elara");

    expect(championNameField).toHaveValue("Elara");
  });
});
