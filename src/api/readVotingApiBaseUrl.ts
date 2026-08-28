export function readVotingApiBaseUrl(
  environmentVariables: { VITE_API_BASE_URL?: string } = import.meta.env,
): string {
  const configuredBaseUrl = environmentVariables.VITE_API_BASE_URL;

  if (typeof configuredBaseUrl === "string" && configuredBaseUrl.length > 0) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
