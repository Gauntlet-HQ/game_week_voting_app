import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { APP_PATHNAMES } from "./routing/appPathnames";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("mounts the name gate as the entry screen and fetches GET /voters", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async (requestUrl) => {
      expect(String(requestUrl)).toBe("http://localhost:3000/voters");
      return new Response(
        JSON.stringify({
          voters: [{ displayName: "Elara" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchImplementation);

    render(<App />);

    expect(
      await screen.findByRole("option", { name: "Elara" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Shared staff password")).toBeInTheDocument();
    expect(screen.queryByText("Design system gallery")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Heraldry gallery" }),
    ).not.toBeInTheDocument();
  });

  it("does not serve the design-system gallery from a public /gallery visit", async () => {
    window.history.replaceState(null, "", APP_PATHNAMES.gallery);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Name the champion" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Design system gallery")).not.toBeInTheDocument();
  });
});
