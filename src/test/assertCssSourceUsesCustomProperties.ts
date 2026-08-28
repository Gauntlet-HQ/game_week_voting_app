import { expect } from "vitest";

export function assertCssSourceUsesCustomProperties(
  cssSource: string,
  expectedCustomProperties: string[],
): void {
  for (const customProperty of expectedCustomProperties) {
    expect(cssSource, `missing ${customProperty}`).toContain(
      `var(${customProperty})`,
    );
  }
}
