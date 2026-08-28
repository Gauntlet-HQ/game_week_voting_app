import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VotingApiClient } from "../api/votingApiTypes";
import { writeHonorSystemSessionToBrowserStorage } from "../session/honorSystemSessionStorage";
import { APP_PATHNAMES } from "./appPathnames";
import { AppRouter } from "./AppRouter";

function createVotingApiClientMock(
  overrides: Partial<VotingApiClient> = {},
): VotingApiClient {
  return {
    fetchPublicVoterRosterDisplayNames: vi.fn(async () => [
      "Ada Lovelace",
      "Staff Sage",
    ]),
    createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(),
    ...overrides,
  };
}

describe("AppRouter", () => {
  it("opens the name gate at the app entry instead of the design-system gallery", async () => {
    render(
      <AppRouter votingApiClient={createVotingApiClientMock()} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Game Week Voting" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Name the champion",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Design system gallery")).not.toBeInTheDocument();
  });

  it("keeps the design-system gallery on the /gallery route", async () => {
    window.history.replaceState(null, "", APP_PATHNAMES.gallery);

    render(
      <AppRouter votingApiClient={createVotingApiClientMock()} />,
    );

    expect(
      await screen.findByText("Design system gallery"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Name the champion" }),
    ).not.toBeInTheDocument();
  });

  it("routes an honor-system voter into the champion keep", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock({
      createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
        async () => ({
          token: "voter-token",
          voterId: "11111111-1111-1111-1111-111111111111",
          displayName: "Ada Lovelace",
          isStaff: false,
        }),
      ),
    });

    render(<AppRouter votingApiClient={votingApiClient} />);

    await user.click(
      await screen.findByRole("button", { name: "Ada Lovelace" }),
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    expect(
      await screen.findByRole("heading", { name: "Champion's keep" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome, Ada Lovelace\. The voting hall will open here\./),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(APP_PATHNAMES.voterKeep);
  });

  it("routes a successful shared-password staff session into the staff keep", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock({
      createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
        async () => ({
          token: "staff-token",
          voterId: "22222222-2222-2222-2222-222222222222",
          displayName: "Staff Sage",
          isStaff: true,
        }),
      ),
    });

    render(<AppRouter votingApiClient={votingApiClient} />);

    await user.click(await screen.findByRole("button", { name: "Staff Sage" }));
    await user.type(
      screen.getByLabelText("Shared staff password"),
      "guild-seal",
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    expect(
      await screen.findByRole("heading", { name: "Staff keep" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome, Staff Sage\. The staff ledger will open here\./),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(APP_PATHNAMES.staffKeep);
  });

  it("treats a wrong shared password as a quiet voter session, not a staff keep", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock({
      createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
        async () => ({
          token: "quiet-fail-token",
          voterId: "22222222-2222-2222-2222-222222222222",
          displayName: "Staff Sage",
          isStaff: false,
        }),
      ),
    });

    render(<AppRouter votingApiClient={votingApiClient} />);

    await user.click(await screen.findByRole("button", { name: "Staff Sage" }));
    await user.type(
      screen.getByLabelText("Shared staff password"),
      "definitely-not-the-staff-password",
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    expect(
      await screen.findByRole("heading", { name: "Champion's keep" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Staff keep" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(APP_PATHNAMES.voterKeep);
  });

  it("sends an unauthenticated visitor from the keeps back to the name gate", async () => {
    window.history.replaceState(null, "", APP_PATHNAMES.staffKeep);

    render(
      <AppRouter votingApiClient={createVotingApiClientMock()} />,
    );

    expect(
      await screen.findByRole("heading", { name: "Name the champion" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe(APP_PATHNAMES.nameGate);
    });
  });

  it("keeps a stored voter out of the staff keep", async () => {
    writeHonorSystemSessionToBrowserStorage({
      token: "voter-token",
      voterId: "11111111-1111-1111-1111-111111111111",
      displayName: "Ada Lovelace",
      isStaff: false,
    });
    window.history.replaceState(null, "", APP_PATHNAMES.staffKeep);

    render(
      <AppRouter votingApiClient={createVotingApiClientMock()} />,
    );

    expect(
      await screen.findByRole("heading", { name: "Champion's keep" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe(APP_PATHNAMES.voterKeep);
    });
  });

  it("opens the heraldry gallery from the name gate without leaving the honor-system contract", async () => {
    const user = userEvent.setup();

    render(
      <AppRouter votingApiClient={createVotingApiClientMock()} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Heraldry gallery" }),
    );

    expect(screen.getByText("Design system gallery")).toBeInTheDocument();
    expect(window.location.pathname).toBe(APP_PATHNAMES.gallery);
  });
});
