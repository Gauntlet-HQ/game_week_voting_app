import type pg from "pg";
import type { AwardCategory } from "../award-categories.js";
import type {
  BallotRecord,
  CategoryStandingRecord,
  GameRecord,
  VoteRecord,
  VoterRecord
} from "../domain/voting-records.js";

type Queryable = pg.Pool | pg.PoolClient;

export class PostgresVotingStore {
  public constructor(private readonly queryable: Queryable) {}

  public async withTransaction<T>(
    work: (store: PostgresVotingStore) => Promise<T>
  ): Promise<T> {
    if (!("connect" in this.queryable)) {
      return work(this);
    }

    const pool = this.queryable as pg.Pool;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const transactionalStore = new PostgresVotingStore(client);
      const result = await work(transactionalStore);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async findVoterByDisplayNameCaseInsensitive(
    displayName: string
  ): Promise<VoterRecord | undefined> {
    const result = await this.queryable.query<{
      voter_id: string;
      display_name: string;
      is_staff: boolean;
    }>(
      `
        SELECT voter_id, display_name, is_staff
        FROM voters
        WHERE lower(display_name) = lower(btrim($1))
      `,
      [displayName]
    );
    const row = result.rows[0];
    return row ? mapVoter(row) : undefined;
  }

  public async listVoterDisplayNames(): Promise<string[]> {
    const result = await this.queryable.query<{ display_name: string }>(
      `
        SELECT display_name
        FROM voters
        ORDER BY lower(display_name)
      `
    );
    return result.rows.map((row) => row.display_name);
  }

  public async listActiveGames(): Promise<GameRecord[]> {
    const result = await this.queryable.query<GameRow>(
      `
        SELECT game_id, title, submitter_name, url, withdrawn_from_ballot
        FROM games
        WHERE withdrawn_from_ballot = FALSE
        ORDER BY lower(title), url
      `
    );
    return result.rows.map(mapGame);
  }

  public async findGameById(gameId: string): Promise<GameRecord | undefined> {
    const result = await this.queryable.query<GameRow>(
      `
        SELECT game_id, title, submitter_name, url, withdrawn_from_ballot
        FROM games
        WHERE game_id = $1
      `,
      [gameId]
    );
    const row = result.rows[0];
    return row ? mapGame(row) : undefined;
  }

  public async findBallotByVoterId(
    voterId: string
  ): Promise<BallotRecord | undefined> {
    const result = await this.queryable.query<BallotRow>(
      `
        SELECT ballot_id, voter_id, is_locked, locked_at
        FROM ballots
        WHERE voter_id = $1
      `,
      [voterId]
    );
    const row = result.rows[0];
    return row ? mapBallot(row) : undefined;
  }

  public async createUnlockedBallotForVoter(
    voterId: string
  ): Promise<BallotRecord> {
    const result = await this.queryable.query<BallotRow>(
      `
        INSERT INTO ballots (voter_id, is_locked, locked_at)
        VALUES ($1, FALSE, NULL)
        RETURNING ballot_id, voter_id, is_locked, locked_at
      `,
      [voterId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create ballot");
    }
    return mapBallot(row);
  }

  public async listVotesForBallot(ballotId: string): Promise<VoteRecord[]> {
    const result = await this.queryable.query<VoteRow>(
      `
        SELECT vote_id, ballot_id, voter_id, category, game_id
        FROM votes
        WHERE ballot_id = $1
        ORDER BY category
      `,
      [ballotId]
    );
    return result.rows.map(mapVote);
  }

  public async replaceDraftVotesOnBallot(input: {
    ballotId: string;
    voterId: string;
    votes: ReadonlyArray<{ category: AwardCategory; gameId: string }>;
  }): Promise<void> {
    await this.queryable.query(`DELETE FROM votes WHERE ballot_id = $1`, [
      input.ballotId
    ]);

    for (const vote of input.votes) {
      await this.queryable.query(
        `
          INSERT INTO votes (ballot_id, voter_id, category, game_id)
          VALUES ($1, $2, $3::award_category, $4)
        `,
        [input.ballotId, input.voterId, vote.category, vote.gameId]
      );
    }

    await this.queryable.query(
      `
        UPDATE ballots
        SET updated_at = now()
        WHERE ballot_id = $1
      `,
      [input.ballotId]
    );
  }

  public async lockBallot(ballotId: string): Promise<BallotRecord> {
    const result = await this.queryable.query<BallotRow>(
      `
        UPDATE ballots
        SET is_locked = TRUE,
            locked_at = now(),
            updated_at = now()
        WHERE ballot_id = $1
        RETURNING ballot_id, voter_id, is_locked, locked_at
      `,
      [ballotId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to lock ballot");
    }
    return mapBallot(row);
  }

  public async loadStaffPasswordHash(): Promise<string | undefined> {
    const result = await this.queryable.query<{ staff_code_hash: string }>(
      `
        SELECT staff_code_hash
        FROM staff_credentials
        WHERE staff_credential_id = TRUE
      `
    );
    return result.rows[0]?.staff_code_hash;
  }

  public async insertStaffPasswordHashIfMissing(
    staffCodeHash: string
  ): Promise<boolean> {
    const result = await this.queryable.query(
      `
        INSERT INTO staff_credentials (staff_credential_id, staff_code_hash)
        VALUES (TRUE, $1)
        ON CONFLICT (staff_credential_id) DO NOTHING
      `,
      [staffCodeHash]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async listAllGames(): Promise<GameRecord[]> {
    const result = await this.queryable.query<GameRow>(
      `
        SELECT game_id, title, submitter_name, url, withdrawn_from_ballot
        FROM games
      `
    );
    return result.rows.map(mapGame);
  }

  public async listGameIdsThatHaveVotes(): Promise<Set<string>> {
    const result = await this.queryable.query<{ game_id: string }>(
      `SELECT DISTINCT game_id FROM votes`
    );
    return new Set(result.rows.map((row) => row.game_id));
  }

  public async upsertGameByUrl(input: {
    title: string;
    submitterName: string;
    url: string;
  }): Promise<void> {
    await this.queryable.query(
      `
        INSERT INTO games (title, submitter_name, url, withdrawn_from_ballot)
        VALUES ($1, $2, $3, FALSE)
        ON CONFLICT (url) DO UPDATE
        SET title = EXCLUDED.title,
            submitter_name = EXCLUDED.submitter_name,
            withdrawn_from_ballot = FALSE,
            updated_at = now()
      `,
      [input.title, input.submitterName, input.url]
    );
  }

  public async deleteGameById(gameId: string): Promise<void> {
    await this.queryable.query(`DELETE FROM games WHERE game_id = $1`, [
      gameId
    ]);
  }

  public async markGameWithdrawnFromBallot(gameId: string): Promise<void> {
    await this.queryable.query(
      `
        UPDATE games
        SET withdrawn_from_ballot = TRUE,
            updated_at = now()
        WHERE game_id = $1
      `,
      [gameId]
    );
  }

  public async listAllVoters(): Promise<VoterRecord[]> {
    const result = await this.queryable.query<{
      voter_id: string;
      display_name: string;
      is_staff: boolean;
    }>(
      `SELECT voter_id, display_name, is_staff FROM voters`
    );
    return result.rows.map(mapVoter);
  }

  public async listVoterIdsThatHaveBallots(): Promise<Set<string>> {
    const result = await this.queryable.query<{ voter_id: string }>(
      `SELECT voter_id FROM ballots`
    );
    return new Set(result.rows.map((row) => row.voter_id));
  }

  public async insertStaffVoterWhenRosterIsEmpty(
    displayName: string
  ): Promise<boolean> {
    const result = await this.queryable.query(
      `
        INSERT INTO voters (display_name, is_staff)
        SELECT $1, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM voters)
      `,
      [displayName]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async upsertVoterByLowerDisplayName(input: {
    displayName: string;
    isStaff: boolean;
  }): Promise<void> {
    await this.queryable.query(
      `
        INSERT INTO voters (display_name, is_staff)
        VALUES ($1, $2)
        ON CONFLICT ((lower(display_name))) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            is_staff = EXCLUDED.is_staff,
            updated_at = now()
      `,
      [input.displayName, input.isStaff]
    );
  }

  public async deleteVoterById(voterId: string): Promise<void> {
    await this.queryable.query(`DELETE FROM voters WHERE voter_id = $1`, [
      voterId
    ]);
  }

  public async countLockedBallots(): Promise<number> {
    const result = await this.queryable.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ballots WHERE is_locked = TRUE`
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  public async listLockedBallotStandings(): Promise<CategoryStandingRecord[]> {
    const result = await this.queryable.query<{
      category: AwardCategory;
      rank: string;
      vote_count: string;
      game_id: string;
      title: string;
      submitter_name: string;
      url: string;
    }>(
      `
        SELECT
          votes.category,
          RANK() OVER (
            PARTITION BY votes.category
            ORDER BY COUNT(*) DESC
          )::text AS rank,
          COUNT(*)::text AS vote_count,
          games.game_id,
          games.title,
          games.submitter_name,
          games.url
        FROM votes
        INNER JOIN ballots ON ballots.ballot_id = votes.ballot_id
        INNER JOIN games ON games.game_id = votes.game_id
        WHERE ballots.is_locked = TRUE
        GROUP BY
          votes.category,
          games.game_id,
          games.title,
          games.submitter_name,
          games.url
        ORDER BY votes.category, rank, games.title
      `
    );

    return result.rows.map((row) => ({
      category: row.category,
      rank: Number(row.rank),
      voteCount: Number(row.vote_count),
      gameId: row.game_id,
      title: row.title,
      submitterName: row.submitter_name,
      url: row.url
    }));
  }
}

type GameRow = {
  game_id: string;
  title: string;
  submitter_name: string;
  url: string;
  withdrawn_from_ballot: boolean;
};

type BallotRow = {
  ballot_id: string;
  voter_id: string;
  is_locked: boolean;
  locked_at: Date | null;
};

type VoteRow = {
  vote_id: string;
  ballot_id: string;
  voter_id: string;
  category: AwardCategory;
  game_id: string;
};

function mapVoter(row: {
  voter_id: string;
  display_name: string;
  is_staff: boolean;
}): VoterRecord {
  return {
    voterId: row.voter_id,
    displayName: row.display_name,
    isStaff: row.is_staff
  };
}

function mapGame(row: GameRow): GameRecord {
  return {
    gameId: row.game_id,
    title: row.title,
    submitterName: row.submitter_name,
    url: row.url,
    withdrawnFromBallot: row.withdrawn_from_ballot
  };
}

function mapBallot(row: BallotRow): BallotRecord {
  return {
    ballotId: row.ballot_id,
    voterId: row.voter_id,
    isLocked: row.is_locked,
    lockedAt: row.locked_at
  };
}

function mapVote(row: VoteRow): VoteRecord {
  return {
    voteId: row.vote_id,
    ballotId: row.ballot_id,
    voterId: row.voter_id,
    category: row.category,
    gameId: row.game_id
  };
}
