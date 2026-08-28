-- Locked Game Week Voting schema.
-- Reviewed on the API pull request (no separate migrations branch).
-- Product tables and columns match the agreed DDL exactly. No invented columns.
-- Foreign keys use ON DELETE RESTRICT (never CASCADE).
-- One rollback-safe transaction; re-running is idempotent
-- (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE award_category AS ENUM (
    'technical_achievement',
    'creative_or_fun_gameplay',
    'visuals_or_graphics',
    'best_overall'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS voters (
  voter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voters_display_name_not_blank CHECK (btrim(display_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS voters_display_name_lower_key
  ON voters (lower(display_name));

CREATE TABLE IF NOT EXISTS games (
  game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  url TEXT NOT NULL,
  withdrawn_from_ballot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT games_url_unique UNIQUE (url),
  CONSTRAINT games_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT games_submitter_not_blank CHECK (btrim(submitter_name) <> ''),
  CONSTRAINT games_url_not_blank CHECK (btrim(url) <> '')
);

CREATE TABLE IF NOT EXISTS ballots (
  ballot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES voters (voter_id) ON DELETE RESTRICT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ballots_one_per_voter UNIQUE (voter_id),
  CONSTRAINT ballots_locked_at_matches_flag CHECK (
    (is_locked = FALSE AND locked_at IS NULL)
    OR (is_locked = TRUE AND locked_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES ballots (ballot_id) ON DELETE RESTRICT,
  voter_id UUID NOT NULL REFERENCES voters (voter_id) ON DELETE RESTRICT,
  category award_category NOT NULL,
  game_id UUID NOT NULL REFERENCES games (game_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT votes_one_game_per_voter_category UNIQUE (voter_id, category),
  CONSTRAINT votes_one_game_per_ballot_category UNIQUE (ballot_id, category)
);

CREATE INDEX IF NOT EXISTS votes_results_by_category_game_idx
  ON votes (category, game_id);

CREATE TABLE IF NOT EXISTS staff_credentials (
  staff_credential_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (staff_credential_id),
  staff_code_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: reject voter mismatch on votes (votes.voter_id must equal ballots.voter_id)
CREATE OR REPLACE FUNCTION reject_vote_when_voter_does_not_match_ballot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ballot_owner_voter_id UUID;
BEGIN
  SELECT ballots.voter_id
    INTO ballot_owner_voter_id
  FROM ballots
  WHERE ballots.ballot_id = NEW.ballot_id;

  IF ballot_owner_voter_id IS NULL THEN
    RAISE EXCEPTION 'votes.voter_id must equal ballots.voter_id'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.voter_id IS DISTINCT FROM ballot_owner_voter_id THEN
    RAISE EXCEPTION 'votes.voter_id must equal ballots.voter_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS votes_reject_voter_mismatch ON votes;
CREATE TRIGGER votes_reject_voter_mismatch
  BEFORE INSERT OR UPDATE OF ballot_id, voter_id ON votes
  FOR EACH ROW
  EXECUTE FUNCTION reject_vote_when_voter_does_not_match_ballot();

-- Trigger: reject lock without all four categories present, or if any pick is withdrawn
CREATE OR REPLACE FUNCTION reject_ballot_lock_without_all_four_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  present_category_count INTEGER;
  missing_category_count INTEGER;
BEGIN
  IF NEW.is_locked = TRUE AND (TG_OP = 'INSERT' OR OLD.is_locked = FALSE) THEN
    SELECT COUNT(DISTINCT votes.category)
      INTO present_category_count
    FROM votes
    WHERE votes.ballot_id = NEW.ballot_id;

    SELECT COUNT(*)
      INTO missing_category_count
    FROM unnest(ARRAY[
      'technical_achievement'::award_category,
      'creative_or_fun_gameplay'::award_category,
      'visuals_or_graphics'::award_category,
      'best_overall'::award_category
    ]) AS required_category(category)
    WHERE NOT EXISTS (
      SELECT 1
      FROM votes
      WHERE votes.ballot_id = NEW.ballot_id
        AND votes.category = required_category.category
    );

    IF present_category_count <> 4 OR missing_category_count <> 0 THEN
      RAISE EXCEPTION 'cannot lock a ballot without all four award categories'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM votes
      INNER JOIN games ON games.game_id = votes.game_id
      WHERE votes.ballot_id = NEW.ballot_id
        AND games.withdrawn_from_ballot = TRUE
    ) THEN
      RAISE EXCEPTION 'cannot lock a ballot that includes a withdrawn game'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ballots_reject_lock_without_all_categories ON ballots;
CREATE TRIGGER ballots_reject_lock_without_all_categories
  BEFORE INSERT OR UPDATE OF is_locked ON ballots
  FOR EACH ROW
  EXECUTE FUNCTION reject_ballot_lock_without_all_four_categories();

-- Trigger: reject unlock (is_locked never flips back to false)
CREATE OR REPLACE FUNCTION reject_ballot_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_locked = TRUE AND NEW.is_locked = FALSE THEN
    RAISE EXCEPTION 'locked ballots cannot be unlocked'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ballots_reject_unlock ON ballots;
CREATE TRIGGER ballots_reject_unlock
  BEFORE UPDATE OF is_locked ON ballots
  FOR EACH ROW
  EXECUTE FUNCTION reject_ballot_unlock();

-- Trigger: freeze vote INSERT/UPDATE/DELETE after the ballot is locked
CREATE OR REPLACE FUNCTION freeze_votes_after_ballot_is_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_ballot_id UUID;
  ballot_is_locked BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_ballot_id := OLD.ballot_id;
  ELSE
    target_ballot_id := NEW.ballot_id;
  END IF;

  SELECT ballots.is_locked
    INTO ballot_is_locked
  FROM ballots
  WHERE ballots.ballot_id = target_ballot_id;

  IF ballot_is_locked = TRUE THEN
    RAISE EXCEPTION 'votes cannot be inserted, updated, or deleted after the ballot is locked'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS votes_freeze_after_ballot_lock ON votes;
CREATE TRIGGER votes_freeze_after_ballot_lock
  BEFORE INSERT OR UPDATE OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION freeze_votes_after_ballot_is_locked();

COMMIT;
