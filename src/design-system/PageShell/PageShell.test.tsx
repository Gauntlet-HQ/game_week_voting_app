import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("places page contents in a main landmark on the stone field", () => {
    render(
      <PageShell>
        <p>Codex of the Guild</p>
      </PageShell>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Codex of the Guild");
  });
});
