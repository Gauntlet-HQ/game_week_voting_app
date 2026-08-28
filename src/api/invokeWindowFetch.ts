export function invokeWindowFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init === undefined) {
    return globalThis.fetch(input);
  }

  return globalThis.fetch(input, init);
}
