import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadingDisplay } from "./HeadingDisplay";

describe("HeadingDisplay", () => {
  it("renders a display-serif heading at the requested rank", () => {
    render(
      <HeadingDisplay headingLevel={2}>Best Overall</HeadingDisplay>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Best Overall" }),
    ).toBeInTheDocument();
  });

  it("defaults to a page-title heading", () => {
    render(<HeadingDisplay>Game Week Voting</HeadingDisplay>);

    expect(
      screen.getByRole("heading", { level: 1, name: "Game Week Voting" }),
    ).toBeInTheDocument();
  });

  it("can be inscribed in parchment ink for use on a missive", () => {
    render(
      <HeadingDisplay headingLevel={3} inkTone="parchment">
        Four Banners of the Contest
      </HeadingDisplay>,
    );

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Four Banners of the Contest",
      }),
    ).toBeInTheDocument();
  });
});
