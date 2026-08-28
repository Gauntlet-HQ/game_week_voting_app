export class UnknownVoterDisplayNameError extends Error {
  constructor() {
    super("Display name is not on the voter roster");
    this.name = "UnknownVoterDisplayNameError";
  }
}

export class BallotAlreadyLockedError extends Error {
  constructor() {
    super("Ballot is locked and cannot be changed");
    this.name = "BallotAlreadyLockedError";
  }
}

export class BallotLockRequiresFourNonWithdrawnGamesError extends Error {
  constructor() {
    super(
      "Locking a ballot requires one real non-withdrawn game in each of the four award categories"
    );
    this.name = "BallotLockRequiresFourNonWithdrawnGamesError";
  }
}

export class WithdrawnOrUnknownGameNotVotableError extends Error {
  constructor() {
    super("Votes must reference a game that exists and is not withdrawn from the ballot");
    this.name = "WithdrawnOrUnknownGameNotVotableError";
  }
}

export class DuplicateCategoryOnBallotError extends Error {
  constructor() {
    super("A ballot draft cannot contain two votes for the same award category");
    this.name = "DuplicateCategoryOnBallotError";
  }
}

export class StaffAuthorizationRequiredError extends Error {
  constructor() {
    super("Staff authorization is required");
    this.name = "StaffAuthorizationRequiredError";
  }
}

export class CsvImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportValidationError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationRequiredError";
  }
}
