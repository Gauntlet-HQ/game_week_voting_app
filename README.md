# Game Week Voting App

Staff upload game submissions by CSV. Voters pick a name from a roster (honor system), choose one winner per category, then lock in. Staff share one password for upload and results. Fantasy MMO theme. Hosted on Railway.

## Layout

- Repo root — Vite React app: honor-system name gate, four-category voting hall, design-system primitives. Heraldry gallery is staff-only (`/gallery`).
- `backend/` — TypeScript Fastify + Postgres API
- `backend/migrations/001_award_voting_schema.sql` — locked schema (tables, RESTRICT FKs, lock/vote triggers)

## Status

This iteration ships the name gate (pick a roster name; optional shared staff password), the four-category voting hall with lock-in, and the fantasy design system. The staff CSV UI and Railway hosting are not included yet.

The name gate talks to the real API:

- `GET /voters` — public roster, display names only
- `POST /sessions` — body `{ displayName, staffPassword? }`. Honor-system name pick; `isStaff` is true only when the shared staff password is present and valid for a staff name. A wrong password still opens a voter session and does not leak staff-ness.

The voting hall (after a session) talks to:

- `GET /games` — submitted games still on the ballot
- `GET /ballot` — current draft or sealed ballot
- `PUT /ballot` — replace an unlocked draft (`{ votes: [{ category, gameId }] }`)
- `POST /ballot/lock` — seal after all four categories are filled; 400 if incomplete, 409 if already locked

## Run the name gate and voting hall

```bash
npm install
npm run dev
```

Vite prints a local URL (default `http://localhost:5173`). The home page is the name gate. Point it at the Fastify API with `VITE_API_BASE_URL` (default `http://localhost:3000`):

```bash
cp .env.example .env
```

The Heraldry / design-system gallery is staff-only. It is not linked from the name gate, and an unauthenticated `/gallery` visit returns to the gate.

## Frontend tests

```bash
npm test
```

## Backend

The API lives in `backend`. Categories are the Postgres enum `award_category`:

- `technical_achievement`
- `creative_or_fun_gameplay`
- `visuals_or_graphics`
- `best_overall`

Regular voters pick a roster name with no password. Staff names use **one shared staff password** (hashed in `staff_credentials`). A wrong password never grants staff and never reveals whether the name is marked staff. Session tokens encode `voter_id` + `isStaff`.

On first boot, if `voters` is empty and `STAFF_PASSWORD` is set, the API inserts one staff roster name (`BOOTSTRAP_STAFF_NAME`, default `Staff`) so an operator can pick that name, open a staff session, and import CSVs. Existing rows are left alone.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `STAFF_PASSWORD` | on first boot (and in production) | Hashed into `staff_credentials` **only if that table is empty** |
| `BOOTSTRAP_STAFF_NAME` | no (default `Staff`) | Display name for one staff voter inserted on boot **only if `voters` is empty** and `STAFF_PASSWORD` is set |
| `SESSION_SECRET` | production | HMAC secret for session tokens |
| `PORT` | no (default `3000`) | Listen port |
| `HOST` | no (default `0.0.0.0`) | Listen host |

Copy `backend/.env.example` and export the values (or put them in the shell / Railway service):

```bash
export DATABASE_URL=postgresql://voting:voting@127.0.0.1:5432/voting_dev
export STAFF_PASSWORD=change-me-shared-staff-password
export BOOTSTRAP_STAFF_NAME=Staff
export SESSION_SECRET=change-me-to-a-long-random-string
```

Tests do **not** use Railway. They try local Postgres (`TEST_DATABASE_URL`, default `postgresql://voting:voting@127.0.0.1:5432/voting_test`) and fall back to Testcontainers.

### Run locally

```bash
cd backend
npm install
npm run migrate
npm run dev
```

Production start after `npm run build`:

```bash
cd backend
npm start
```

Interactive OpenAPI UI: `http://localhost:3000/docs`. Checked-in spec: `backend/openapi.json`.

### Curl examples

Roster names (public):

```bash
curl -s http://localhost:3000/voters
```

Honor-system session (regular voter):

```bash
curl -s -X POST http://localhost:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"displayName":"Ada Lovelace"}'
```

Staff session (shared password). On an empty production roster the bootstrap name is `Staff` (or `BOOTSTRAP_STAFF_NAME`):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"displayName":"Staff","staffPassword":"change-me-shared-staff-password"}' \
  | jq -r .token)
```

Import games CSV (upsert by `url`; missing + zero votes → delete; missing + has votes → `withdrawn_from_ballot`):

```bash
curl -s -X POST http://localhost:3000/staff/games/import \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: text/csv' \
  --data-binary @games.csv
```

`games.csv`:

```csv
title,submitter_name,url
Dungeon Crawler,Ada Lovelace,https://example.com/dungeon
```

Import voter roster (upsert by `lower(display_name)`; missing + no ballot → delete; missing + has ballot → keep):

```bash
curl -s -X POST http://localhost:3000/staff/voters/import \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: text/csv' \
  --data-binary @voters.csv
```

`voters.csv`:

```csv
display_name,is_staff
Ada Lovelace,false
Staff Sage,true
```

Vote and lock:

```bash
curl -s http://localhost:3000/games -H "authorization: Bearer $TOKEN"
curl -s http://localhost:3000/ballot -H "authorization: Bearer $TOKEN"
curl -s -X PUT http://localhost:3000/ballot \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"votes":[{"category":"technical_achievement","gameId":"<uuid>"},{"category":"creative_or_fun_gameplay","gameId":"<uuid>"},{"category":"visuals_or_graphics","gameId":"<uuid>"},{"category":"best_overall","gameId":"<uuid>"}]}'
curl -s -X POST http://localhost:3000/ballot/lock \
  -H "authorization: Bearer $TOKEN"
```

Locked-ballot results (ties share a rank):

```bash
curl -s http://localhost:3000/staff/results -H "authorization: Bearer $TOKEN"
```

### Backend tests

```bash
cd backend
npm test
```

Needs local Postgres (see `TEST_DATABASE_URL`) or Docker for Testcontainers. The suite starts from failing-rule coverage: name gate + unique `(voter_id, category)`, lock immutability, CSV rules, `ON DELETE RESTRICT`, and results that ignore draft ballots.
