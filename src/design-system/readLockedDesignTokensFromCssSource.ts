export function readLockedDesignTokensFromCssSource(
  cssSource: string,
): Record<string, string> {
  const rootBlockMatch = cssSource.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootBlockMatch) {
    throw new Error("Expected a :root rule in the design-token stylesheet.");
  }

  const customProperties: Record<string, string> = {};
  const customPropertyPattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;

  for (const match of rootBlockMatch[1].matchAll(customPropertyPattern)) {
    customProperties[match[1]] = match[2].trim();
  }

  return customProperties;
}
