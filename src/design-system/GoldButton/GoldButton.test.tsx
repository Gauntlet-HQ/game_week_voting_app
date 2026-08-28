import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoldButton } from "./GoldButton";

describe("GoldButton", () => {
  it("renders a primary command seal that can be pressed", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<GoldButton onClick={handleClick}>Seal the Ballot</GoldButton>);

    await user.click(
      screen.getByRole("button", { name: "Seal the Ballot" }),
    );
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("keeps secondary and danger variants as buttons with their labels", () => {
    render(
      <>
        <GoldButton variant="secondary">Return to Roster</GoldButton>
        <GoldButton variant="danger">Expunge the Ledger</GoldButton>
      </>,
    );

    expect(
      screen.getByRole("button", { name: "Return to Roster" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Expunge the Ledger" }),
    ).toBeEnabled();
  });

  it("does not fire the click handler when the seal is disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <GoldButton isDisabled onClick={handleClick}>
        Locked
      </GoldButton>,
    );

    await user.click(screen.getByRole("button", { name: "Locked" }));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
