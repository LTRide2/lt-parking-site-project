-- webapp/sql/migrations/001_init.sql
-- Initial schema for LTRide. Safe to re-run: it drops then recreates everything.

BEGIN;

DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS interest    CASCADE;
DROP TABLE IF EXISTS spaces      CASCADE;
DROP TABLE IF EXISTS lots        CASCADE;
DROP TABLE IF EXISTS students    CASCADE;
DROP TABLE IF EXISTS users       CASCADE;

-- USERS: both students and admins live here, told apart by `role`.
--   students  -> have a `code`, no username/password
--   admins    -> have username + password_hash, no code
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    role          TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    code          TEXT UNIQUE,                 -- student login code (e.g. STU001)
    username      TEXT UNIQUE,                 -- admin login name
    password_hash TEXT,                        -- admin password (hashed, never plain)
    name          TEXT NOT NULL,
    email         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STUDENTS: the admin-managed roster, separate from the login/auth user.
--   student_id is the business primary key; CSV upserts and slot assignments
--   are keyed on it. A roster row may exist with no matching login user.
CREATE TABLE students (
    id             SERIAL PRIMARY KEY,
    first          TEXT NOT NULL,
    last           TEXT NOT NULL,
    student_id     TEXT NOT NULL UNIQUE,       -- e.g. STU001 / S123213
    email          TEXT,
    grade          TEXT,                        -- stored as text (mirrors the UI)
    assigned_slot  TEXT,                        -- display text, e.g. "Lot 1 · A8"; NULL = none
    parking_status TEXT NOT NULL DEFAULT 'unassigned'
                   CHECK (parking_status IN ('unassigned', 'valid', 'expired', 'suspended'))
);

-- LOTS: a parking lot / area.
--   number is the admin-assigned lot number, unique, used to prefix spot labels.
CREATE TABLE lots (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    number        INTEGER UNIQUE,              -- admin-assigned lot number (label prefix)
    display_order INTEGER NOT NULL DEFAULT 0,
    map_image_url TEXT
);

-- SPACES: one parking space, belongs to a lot.
--   pos_x / pos_y are where the space sits on the map (normalized 0..1 fractions).
--   pos_w / pos_h are the slot's size as fractions of the map, so it keeps its
--   ratio at any zoom. NULL position/size = "no authored layout yet".
--   assigned_student_id is a soft reference to students.student_id, so a spot can
--   be held by a roster student who has no login account.
CREATE TABLE spaces (
    id                  SERIAL PRIMARY KEY,
    lot_id              INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available', 'disabled', 'assigned')),
    assigned_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_student_id TEXT,                  -- roster student_id (soft ref); NULL = none
    pos_x               DOUBLE PRECISION CHECK (pos_x IS NULL OR (pos_x >= 0 AND pos_x <= 1)),
    pos_y               DOUBLE PRECISION CHECK (pos_y IS NULL OR (pos_y >= 0 AND pos_y <= 1)),
    pos_w               DOUBLE PRECISION CHECK (pos_w IS NULL OR (pos_w >= 0 AND pos_w <= 1)),
    pos_h               DOUBLE PRECISION CHECK (pos_h IS NULL OR (pos_h >= 0 AND pos_h <= 1)),
    rotation            DOUBLE PRECISION,      -- degrees; NULL treated as 0
    UNIQUE (lot_id, label)
);

-- INTEREST: a student registering that they want a spot.
--   space_ids holds the specific spots the student picked (their preference);
--   a request holds at most one, kept as an array for forward-compatibility.
CREATE TABLE interest (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lot_id     INTEGER REFERENCES lots(id) ON DELETE SET NULL,
    space_ids  INTEGER[] NOT NULL DEFAULT '{}',
    status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stop a student having two *active* (pending) requests at once.
CREATE UNIQUE INDEX one_active_interest_per_user
    ON interest (user_id)
    WHERE status = 'pending';

-- ASSIGNMENTS: an admin gave a space to a student. History is kept (active flag).
CREATE TABLE assignments (
    id          SERIAL PRIMARY KEY,
    space_id    INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id),   -- the admin
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A space can have at most ONE active assignment at a time.
CREATE UNIQUE INDEX one_active_assignment_per_space
    ON assignments (space_id)
    WHERE active;

COMMIT;
