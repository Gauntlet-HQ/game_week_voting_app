import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesignSystemGallery } from "./DesignSystemGallery";

describe("DesignSystemGallery", () => {
  it("exhibits every design-system primitive on one gallery page", () => {
    render(<DesignSystemGallery />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Game Week Voting" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Design system gallery")).toBeInTheDocument();
    expect(screen.getByText("--color-gold-trim")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(
      "Technical Achievement",
    );
    expect(
      screen.getByRole("button", { name: "Cast Primary Vote" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Return to Roster" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expunge the Ledger" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Champion Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("lets a visitor type a ledger name and choose a different portrait", async () => {
    const user = userEvent.setup();

    render(<DesignSystemGallery />);

    await user.type(screen.getByLabelText("Champion Name"), "Thalen");
    expect(screen.getByLabelText("Champion Name")).toHaveValue("Thalen");

    await user.click(
      screen.getByRole("button", { name: /Rift of the Hollow King/ }),
    );
    expect(
      screen.getByRole("button", { name: /Rift of the Hollow King/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("returns staff to the keep when the gallery is opened from the staff hall", async () => {
    const user = userEvent.setup();
    const onReturnToStaffKeep = vi.fn();

    render(<DesignSystemGallery onReturnToStaffKeep={onReturnToStaffKeep} />);

    await user.click(
      screen.getByRole("button", { name: "Return to the staff keep" }),
    );
    expect(onReturnToStaffKeep).toHaveBeenCalledOnce();
  });
});
