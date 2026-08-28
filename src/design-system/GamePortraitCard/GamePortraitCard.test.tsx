import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GamePortraitCard } from "./GamePortraitCard";

describe("GamePortraitCard", () => {
  it("presents an unselected character-select portrait that can be chosen", async () => {
    const user = userEvent.setup();
    const handleSelectPortrait = vi.fn();

    render(
      <GamePortraitCard
        gameTitle="Rift of the Hollow King"
        submitterName="Thalen"
        gameUrl="https://example.com/rift"
        onSelectPortrait={handleSelectPortrait}
      />,
    );

    const portrait = screen.getByRole("button", {
      name: /Rift of the Hollow King/,
    });
    expect(portrait).toHaveAttribute("aria-pressed", "false");
    expect(portrait).toHaveTextContent("Submitted by Thalen");
    expect(portrait).toHaveTextContent("https://example.com/rift");

    await user.click(portrait);
    expect(handleSelectPortrait).toHaveBeenCalledOnce();
  });

  it("marks the chosen portrait as pressed for the ember frame", () => {
    render(
      <GamePortraitCard
        gameTitle="Lanterns of Qeynos"
        submitterName="Mira"
        isSelected
      />,
    );

    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
