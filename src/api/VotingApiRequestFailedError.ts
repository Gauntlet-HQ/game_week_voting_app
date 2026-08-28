export class VotingApiRequestFailedError extends Error {
  readonly failureKind: "network" | "http";
  readonly httpStatusCode: number | undefined;

  constructor(input: {
    failureKind: "network" | "http";
    httpStatusCode?: number;
    message: string;
  }) {
    super(input.message);
    this.name = "VotingApiRequestFailedError";
    this.failureKind = input.failureKind;
    this.httpStatusCode = input.httpStatusCode;
  }
}
