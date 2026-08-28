import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParchmentCard } from "./ParchmentCard";

describe("ParchmentCard", () => {
  it("renders an article of parchment with the inscribed copy", () => {
    render(
      <ParchmentCard>
        <p>Four banners. One champion per banner.</p>
      </ParchmentCard>,
    );

    expect(screen.getByRole("article")).toHaveTextContent(
      "Four banners. One champion per banner.",
    );
  });
});
