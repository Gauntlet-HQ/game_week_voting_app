import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type { VotingApiClient } from "../../api/votingApiTypes";
import { NameGatePage } from "./NameGatePage";
import nameGatePageSource from "./NameGatePage.tsx?raw";

function createVotingApiClientMock(
  overrides: Partial<VotingApiClient> = {},
): VotingApiClient {
  return {
    fetchPublicVoterRosterDisplayNames: vi.fn(async () => [
      "Ada Lovelace",
      "Staff Sage",
      "Brannoc",
    ]),
    createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(async () => ({
      token: "voter-token",
      voterId: "11111111-1111-1111-1111-111111111111",
      displayName: "Ada Lovelace",
      isStaff: false,
    })),
    ...overrides,
  };
}

describe("NameGatePage", () => {
  it("reuses only the locked design-system primitives", () => {
    expect(nameGatePageSource).toContain("PageShell");
    expect(nameGatePageSource).toContain("ParchmentCard");
    expect(nameGatePageSource).toContain("GoldButton");
    expect(nameGatePageSource).toContain("StoneInput");
    expect(nameGatePageSource).toContain("HeadingDisplay");
    expect(nameGatePageSource).not.toContain("GamePortraitCard");
    expect(nameGatePageSource).toMatch(
      /from ["']\.\.\/\.\.\/design-system["']/,
    );
    expect(nameGatePageSource).not.toContain("Ada Lovelace");
  });

  it("renders roster names from the public API and never a hardcoded list", async () => {
    const votingApiClient = createVotingApiClientMock({
      fetchPublicVoterRosterDisplayNames: vi.fn(async () => [
        "Mira of Qeynos",
        "Thalen",
      ]),
    });

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("option", { name: "Mira of Qeynos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Thalen" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ada Lovelace" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/isStaff/i)).not.toBeInTheDocument();
    expect(
      votingApiClient.fetchPublicVoterRosterDisplayNames,
    ).toHaveBeenCalledOnce();
  });

  it("submits an honor-system name pick without a staff password", async () => {
    const user = userEvent.setup();
    const onHonorSystemSessionEstablished = vi.fn();
    const votingApiClient = createVotingApiClientMock();

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={onHonorSystemSessionEstablished}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Ada Lovelace" }),
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    await waitFor(() => {
      expect(onHonorSystemSessionEstablished).toHaveBeenCalledWith({
        token: "voter-token",
        voterId: "11111111-1111-1111-1111-111111111111",
        displayName: "Ada Lovelace",
        isStaff: false,
      });
    });
    expect(
      votingApiClient.createHonorSystemSessionWithOptionalSharedStaffPassword,
    ).toHaveBeenCalledWith({
      displayName: "Ada Lovelace",
      sharedStaffPassword: "",
    });
  });

  it("sends the shared staff password when the optional seal is filled", async () => {
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
    const onHonorSystemSessionEstablished = vi.fn();

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={onHonorSystemSessionEstablished}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Staff Sage" }));
    await user.type(
      screen.getByLabelText("Shared staff password"),
      "guild-seal",
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    await waitFor(() => {
      expect(
        votingApiClient.createHonorSystemSessionWithOptionalSharedStaffPassword,
      ).toHaveBeenCalledWith({
        displayName: "Staff Sage",
        sharedStaffPassword: "guild-seal",
      });
    });
    expect(onHonorSystemSessionEstablished).toHaveBeenCalledWith(
      expect.objectContaining({ isStaff: true, displayName: "Staff Sage" }),
    );
  });

  it("shows a clear failure when the roster API cannot be summoned and does not invent names", async () => {
    const votingApiClient = createVotingApiClientMock({
      fetchPublicVoterRosterDisplayNames: vi.fn(async () => {
        throw new VotingApiRequestFailedError({
          failureKind: "network",
          message:
            "The guild roster could not be summoned. The halls are unreachable.",
        });
      }),
    });

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(
        "The guild roster could not be summoned. The halls are unreachable.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Guild roster" })).toBeNull();
    expect(screen.getByRole("button", { name: "Enter the hall" })).toBeDisabled();
  });

  it("shows that an unknown name is not on the roster after POST /sessions returns 401", async () => {
    const user = userEvent.setup();
    const onHonorSystemSessionEstablished = vi.fn();
    const votingApiClient = createVotingApiClientMock({
      createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
        async () => {
          throw new VotingApiRequestFailedError({
            failureKind: "http",
            httpStatusCode: 401,
            message: "Display name is not on the voter roster",
          });
        },
      ),
    });

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={onHonorSystemSessionEstablished}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Ada Lovelace" }),
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    expect(
      await screen.findByText("That name is not on the guild roster."),
    ).toBeInTheDocument();
    expect(onHonorSystemSessionEstablished).not.toHaveBeenCalled();
  });

  it("fails quietly when a shared password does not grant staff — no wrong-password ink", async () => {
    const user = userEvent.setup();
    const onHonorSystemSessionEstablished = vi.fn();
    const votingApiClient = createVotingApiClientMock({
      createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
        async () => ({
          token: "voter-token",
          voterId: "22222222-2222-2222-2222-222222222222",
          displayName: "Staff Sage",
          isStaff: false,
        }),
      ),
    });

    render(
      <NameGatePage
        votingApiClient={votingApiClient}
        onHonorSystemSessionEstablished={onHonorSystemSessionEstablished}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Staff Sage" }));
    await user.type(
      screen.getByLabelText("Shared staff password"),
      "definitely-not-the-staff-password",
    );
    await user.click(screen.getByRole("button", { name: "Enter the hall" }));

    await waitFor(() => {
      expect(onHonorSystemSessionEstablished).toHaveBeenCalledWith(
        expect.objectContaining({ isStaff: false }),
      );
    });
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });
});
