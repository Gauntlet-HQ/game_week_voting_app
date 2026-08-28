import { describe, expect, it, vi } from "vitest";
import { invokeWindowFetch } from "./invokeWindowFetch";

describe("invokeWindowFetch", () => {
  it("calls globalThis.fetch as a window function, not as a detached method", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ voters: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchImplementation);

    await invokeWindowFetch("http://localhost:3000/voters");

    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://localhost:3000/voters",
    );

    vi.unstubAllGlobals();
  });
});
