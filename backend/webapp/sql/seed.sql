-- webapp/sql/seed.sql
-- Sample data for local development. Re-runnable (clears the tables first).
-- Mirrors the frontend mock seed (src/api/mock/backend.ts) so the two POCs match.

BEGIN;

TRUNCATE assignments, interest, spaces, lots, students, users RESTART IDENTITY CASCADE;

-- One admin. password is 'admin123' (only for local dev!).
INSERT INTO users (role, username, password_hash, name, email) VALUES
    ('admin', 'admin', 'scrypt:32768:8:1$Vaf2FTiYuB3xMYWB$119092e01ad2ef9f9d3b50fe30a1909f6ae178e01c719c15888e0f2f9af41583e1600ed6ea5e8d944054f4f0c3fd4871713ef7e93038ae6f9c9507869e48571c', 'Admin', 'admin@lt.edu');

-- Student login accounts. They log in with their code (no password).
--   ids 2..5 => STU001 Alice, STU002 Bob, STU003 Andrew, STU004 Olivia.
INSERT INTO users (role, code, name, email) VALUES
    ('student', 'STU001', 'Alice',  'alice@lt.edu'),
    ('student', 'STU002', 'Bob',    'bob@lt.edu'),
    ('student', 'STU003', 'Andrew', 'andrew@lt.edu'),
    ('student', 'STU004', 'Olivia', 'olivia@lt.edu');

-- Six lots, each with an admin-assigned number that prefixes its spot labels.
INSERT INTO lots (name, number, display_order, map_image_url) VALUES
    ('Lot 1',   1, 1, '/lots/lot1.jpg'),
    ('Lot 4',   4, 2, '/lots/lot4.jpg'),
    ('Lot 5',   5, 3, '/lots/lot5.jpg'),
    ('Lot 11', 11, 4, '/lots/lot11.jpg'),
    ('Lot 13', 13, 5, '/lots/lot13.jpg'),
    ('Lot 17', 17, 6, '/lots/lot17.jpg');

-- Lot 1 (id 1) — an authored layout (normalized x/y, default size), the U8 showcase.
--   A4 is disabled; A8 is assigned to Alice (user 2 / STU001) and rotated 90 deg.
INSERT INTO spaces (lot_id, label, status, assigned_user_id, assigned_student_id,
                    pos_x, pos_y, pos_w, pos_h, rotation) VALUES
    (1, 'A1', 'available', NULL,   NULL,     0.20, 0.22, 0.05, 0.03, 0),
    (1, 'A2', 'available', NULL,   NULL,     0.35, 0.22, 0.05, 0.03, 0),
    (1, 'A3', 'available', NULL,   NULL,     0.50, 0.22, 0.05, 0.03, 0),
    (1, 'A4', 'disabled',  NULL,   NULL,     0.65, 0.22, 0.05, 0.03, 0),
    (1, 'A5', 'available', NULL,   NULL,     0.20, 0.55, 0.05, 0.03, 0),
    (1, 'A6', 'available', NULL,   NULL,     0.35, 0.55, 0.05, 0.03, 0),
    (1, 'A7', 'available', NULL,   NULL,     0.50, 0.55, 0.05, 0.03, 0),
    (1, 'A8', 'assigned',  2,      'STU001', 0.65, 0.55, 0.05, 0.03, 90);

-- Other lots — positionless spaces (they fall back to the grid renderer).
--   Labels are "<lot number>-<index>"; the 2nd space in each lot starts disabled.
INSERT INTO spaces (lot_id, label, status)
SELECT 2, '4-'  || g, CASE WHEN g = 2 THEN 'disabled' ELSE 'available' END FROM generate_series(1, 10) AS g;
INSERT INTO spaces (lot_id, label, status)
SELECT 3, '5-'  || g, CASE WHEN g = 2 THEN 'disabled' ELSE 'available' END FROM generate_series(1, 8)  AS g;
INSERT INTO spaces (lot_id, label, status)
SELECT 4, '11-' || g, CASE WHEN g = 2 THEN 'disabled' ELSE 'available' END FROM generate_series(1, 14) AS g;
INSERT INTO spaces (lot_id, label, status)
SELECT 5, '13-' || g, CASE WHEN g = 2 THEN 'disabled' ELSE 'available' END FROM generate_series(1, 12) AS g;
INSERT INTO spaces (lot_id, label, status)
SELECT 6, '17-' || g, CASE WHEN g = 2 THEN 'disabled' ELSE 'available' END FROM generate_series(1, 20) AS g;

-- The A8 assignment (Alice), so the seed has one live assignment on record.
INSERT INTO assignments (space_id, user_id, assigned_by, active)
SELECT id, 2, 1, TRUE FROM spaces WHERE lot_id = 1 AND label = 'A8';

-- Interest: Alice already holds Lot 1 (one active request per student, so she
-- has no second row); Bob and Olivia both wait on Lot 4 (id 2), so Manual
-- Assign shows a real choice between two pending requests.
INSERT INTO interest (user_id, lot_id, status, created_at) VALUES
    (2, 1, 'fulfilled', '2026-08-01T09:00:00Z'),
    (3, 2, 'pending',   '2026-08-20T09:00:00Z'),
    (5, 2, 'pending',   '2026-08-22T09:00:00Z');

-- The roster. STU001/STU002 match login users' `code` so slot assignments sync
-- onto them; Alice already holds Lot 1 · A8.
INSERT INTO students (first, last, student_id, email, grade, assigned_slot, parking_status) VALUES
    ('Alice',  'Anderson', 'STU001', 'alice@lt.edu',  '11', 'Lot 1 · A8', 'valid'),
    ('Bob',    'Baker',    'STU002', 'bob@lt.edu',    '12', NULL,         'unassigned'),
    ('Andrew', 'Adams',    'STU003', 'andrew@lt.edu', '9',  NULL,         'unassigned'),
    ('Sarah',  'Smith',    'S123213','sarah@lt.edu',  '10', NULL,         'suspended'),
    ('Olivia', 'Owens',    'STU004', 'olivia@lt.edu', '11', NULL,         'unassigned');

COMMIT;
