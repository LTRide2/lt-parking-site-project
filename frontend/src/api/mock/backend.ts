// A self-contained, in-memory mock of the LTRide backend.
// It lets the frontend run end-to-end with no real server. State is
// persisted to localStorage so it survives a page refresh, exactly like
// a real API would. Flip VITE_USE_MOCK=false to talk to a real backend.

export interface MockUser {
  id: number;
  role: "student" | "admin";
  name: string;
  email?: string;
  code?: string;      // student login code
  username?: string;  // admin login username
  password?: string;  // admin login password
}

export interface MockSpace {
  id: number;
  lot_id: number;
  label: string;
  status: "available" | "disabled" | "assigned";
  x: number | null;
  y: number | null;
  w: number | null;       // slot size as a fraction of the map (keeps ratio at any zoom)
  h: number | null;
  rotation: number | null;
  assigned_user_id: number | null;
  assigned_student_id: string | null; // roster student_id, so a spot can be held by a student with no login account
}

export interface MockLot {
  id: number;
  name: string;
  number: number;          // admin-assigned lot number, used as the prefix for spot labels
  display_order: number;
  map_image_url: string | null;
}

export interface MockInterest {
  id: number;
  user_id: number;
  lot_id: number;
  space_ids: number[];   // the specific spots the student picked (their preferences)
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

// Parking status on a roster student. "unassigned" is the default (no slot);
// assigning a slot sets "valid"; the admin can set "expired"/"suspended" by hand.
export type ParkingStatus = "unassigned" | "valid" | "expired" | "suspended";

// The admin-managed student roster. student_id is the business primary key
// (CSV upserts and slot assignments are keyed on it).
export interface MockStudent {
  id: number;
  first: string;
  last: string;
  student_id: string;
  email: string;
  grade: string;
  assigned_slot: string | null;
  parking_status: ParkingStatus;
}

interface MockDatabase {
  users: MockUser[];
  lots: MockLot[];
  spaces: MockSpace[];
  interest: MockInterest[];
  students: MockStudent[];
  nextId: { space: number; lot: number; interest: number; student: number };
}

const STORAGE_KEY = "ltride.mockdb.v6"; // v6: seed adds student logins STU003/Andrew, STU004/Olivia
// Default slot size as a fraction of the map, for spots saved without a size.
const DEFAULT_SPOT_W = 0.05;
const DEFAULT_SPOT_H = 0.03;

// The seed: a handful of lots backed by the photos in public/lots, one of
// them (Lot 1) with an authored normalized layout so U8 has something to show.
function seed(): MockDatabase {
  const users: MockUser[] = [
    { id: 1, role: "admin", name: "Admin", username: "admin", password: "admin123" },
    { id: 2, role: "student", name: "Alice", email: "alice@lt.edu", code: "STU001" },
    { id: 3, role: "student", name: "Bob", email: "bob@lt.edu", code: "STU002" },
    { id: 4, role: "student", name: "Andrew", email: "andrew@lt.edu", code: "STU003" },
    { id: 5, role: "student", name: "Olivia", email: "olivia@lt.edu", code: "STU004" },
  ];

  const lots: MockLot[] = [
    { id: 1, name: "Lot 1", number: 1, display_order: 1, map_image_url: "/lots/lot1.jpg" },
    { id: 2, name: "Lot 4", number: 4, display_order: 2, map_image_url: "/lots/lot4.jpg" },
    { id: 3, name: "Lot 5", number: 5, display_order: 3, map_image_url: "/lots/lot5.jpg" },
    { id: 4, name: "Lot 11", number: 11, display_order: 4, map_image_url: "/lots/lot11.jpg" },
    { id: 5, name: "Lot 13", number: 13, display_order: 5, map_image_url: "/lots/lot13.jpg" },
    { id: 6, name: "Lot 17", number: 17, display_order: 6, map_image_url: "/lots/lot17.jpg" },
  ];

  const spaces: MockSpace[] = [];
  let spaceId = 1;

  // Lot 1 — an authored layout (normalized x/y), the U8 showcase.
  const authored: Array<[string, number, number, number, MockSpace["status"], number | null]> = [
    ["A1", 0.20, 0.22, 0, "available", null],
    ["A2", 0.35, 0.22, 0, "available", null],
    ["A3", 0.50, 0.22, 0, "available", null],
    ["A4", 0.65, 0.22, 0, "disabled", null],
    ["A5", 0.20, 0.55, 0, "available", null],
    ["A6", 0.35, 0.55, 0, "available", null],
    ["A7", 0.50, 0.55, 0, "available", null],
    ["A8", 0.65, 0.55, 90, "assigned", 2],
  ];
  for (const [label, x, y, rotation, status, assigned] of authored) {
    spaces.push({ id: spaceId++, lot_id: 1, label, status, x, y, w: DEFAULT_SPOT_W, h: DEFAULT_SPOT_H, rotation, assigned_user_id: assigned, assigned_student_id: assigned === 2 ? "STU001" : null });
  }

  // Other lots — positionless spaces (they fall back to the grid renderer).
  const positionless: Array<[number, number]> = [
    [2, 10], [3, 8], [4, 14], [5, 12], [6, 20],
  ];
  for (const [lotId, count] of positionless) {
    const prefix = lots.find((lot) => lot.id === lotId)?.number ?? lotId;
    for (let index = 1; index <= count; index++) {
      const status: MockSpace["status"] = index === 2 ? "disabled" : "available";
      spaces.push({ id: spaceId++, lot_id: lotId, label: `${prefix}-${index}`, status, x: null, y: null, w: null, h: null, rotation: null, assigned_user_id: null, assigned_student_id: null });
    }
  }

  const interest: MockInterest[] = [
    { id: 1, user_id: 2, lot_id: 1, space_ids: [], status: "fulfilled", created_at: "2026-08-01T09:00:00.000Z" },
    // Two students both waiting on Lot 4 (lot_id 2) — so Manual Assign shows a real choice.
    { id: 2, user_id: 3, lot_id: 2, space_ids: [], status: "pending", created_at: "2026-08-20T09:00:00.000Z" },
    { id: 3, user_id: 2, lot_id: 2, space_ids: [], status: "pending", created_at: "2026-08-22T09:00:00.000Z" },
  ];

  // The roster. STU001/STU002 match the login users' `code` so slot assignments
  // sync onto them; Alice already holds Lot 1 · A8 (assigned in the seed above).
  const students: MockStudent[] = [
    { id: 1, first: "Alice", last: "Anderson", student_id: "STU001", email: "alice@lt.edu", grade: "11", assigned_slot: "Lot 1 · A8", parking_status: "valid" },
    { id: 2, first: "Bob", last: "Baker", student_id: "STU002", email: "bob@lt.edu", grade: "12", assigned_slot: null, parking_status: "unassigned" },
    { id: 3, first: "Andrew", last: "Adams", student_id: "STU003", email: "andrew@lt.edu", grade: "9", assigned_slot: null, parking_status: "unassigned" },
    { id: 4, first: "Sarah", last: "Smith", student_id: "S123213", email: "sarah@lt.edu", grade: "10", assigned_slot: null, parking_status: "suspended" },
    { id: 5, first: "Olivia", last: "Owens", student_id: "STU004", email: "olivia@lt.edu", grade: "11", assigned_slot: null, parking_status: "unassigned" },
  ];

  return {
    users, lots, spaces, interest, students,
    nextId: { space: spaceId, lot: 7, interest: 4, student: 6 },
  };
}

function load(): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDatabase;
  } catch {
    // fall through to a fresh seed
  }
  const fresh = seed();
  persist(fresh); // don't touch `database` here — it may still be initializing
  return fresh;
}

// Write a database to localStorage. Kept separate from save() so load() can
// persist a fresh seed without reassigning the `database` binding (which would
// hit the temporal dead zone while `database = load()` is still running).
function persist(db: MockDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable — keep the in-memory copy
  }
}

function save(next: MockDatabase = database) {
  database = next;
  persist(database);
}

let database: MockDatabase = load();

// Wipe the mock database back to the seed (handy from the browser console).
export function resetMockDatabase() {
  localStorage.removeItem(STORAGE_KEY);
  database = load();
}

// --- token helpers (a fake, human-readable stand-in for a JWT) ---
function issueToken(user: MockUser): string {
  return `mock.${user.id}.${user.role}`;
}
function userFromToken(token: string | null): MockUser | null {
  if (!token) return null;
  const userId = Number(token.split(".")[1]);
  return database.users.find((candidate) => candidate.id === userId) ?? null;
}

// --- serializers (the shapes the frontend slices consume) ---
function publicUser(user: MockUser) {
  return { id: user.id, role: user.role, name: user.name, email: user.email };
}
function serializeLot(lot: MockLot) {
  const spaces = database.spaces.filter((space) => space.lot_id === lot.id);
  const availableCount = spaces.filter((space) => space.status === "available").length;
  return {
    id: lot.id, name: lot.name, number: lot.number, display_order: lot.display_order,
    map_image_url: lot.map_image_url, capacity: spaces.length, available_count: availableCount,
  };
}
function serializeSpace(space: MockSpace) {
  const assignedUser = space.assigned_user_id != null
    ? database.users.find((candidate) => candidate.id === space.assigned_user_id)
    : null;
  // A spot can be held by a roster student who has no login account — fall back to that name.
  const assignedStudent = space.assigned_student_id != null
    ? database.students.find((row) => row.student_id === space.assigned_student_id)
    : null;
  const assignedName = assignedUser?.name
    ?? (assignedStudent ? `${assignedStudent.first} ${assignedStudent.last}` : null);
  return {
    id: space.id, lot_id: space.lot_id, label: space.label, status: space.status,
    x: space.x, y: space.y, w: space.w, h: space.h, rotation: space.rotation,
    assigned_user_id: space.assigned_user_id, assigned_user_name: assignedName,
    assigned_student_id: space.assigned_student_id,
  };
}
function serializeInterest(interest: MockInterest) {
  const lot = database.lots.find((candidate) => candidate.id === interest.lot_id);
  const user = database.users.find((candidate) => candidate.id === interest.user_id);
  const spaceIds = interest.space_ids ?? [];
  const spaceLabels = spaceIds
    .map((id) => database.spaces.find((space) => space.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  return {
    id: interest.id, user_id: interest.user_id, user_name: user?.name ?? null, lot_id: interest.lot_id,
    lot_name: lot?.name, space_ids: spaceIds, space_labels: spaceLabels,
    status: interest.status, created_at: interest.created_at,
  };
}
function serializeStudent(student: MockStudent) {
  return {
    id: student.id, first: student.first, last: student.last, student_id: student.student_id,
    email: student.email, grade: student.grade,
    assigned_slot: student.assigned_slot, parking_status: student.parking_status,
  };
}

// Resolve the roster student behind a space, by direct student link or (failing
// that) the login user's `code`. Either identity may be absent.
function studentForSpace(studentId: string | null, userId: number | null): MockStudent | undefined {
  if (studentId) {
    const byId = database.students.find((row) => row.student_id === studentId);
    if (byId) return byId;
  }
  if (userId != null) {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (user?.code) return database.students.find((row) => row.student_id === user.code);
  }
  return undefined;
}

// Set (or clear, with null) a roster student's parking slot text + status.
function setRosterSlot(student: MockStudent | undefined, slotText: string | null) {
  if (!student) return;
  student.assigned_slot = slotText;
  student.parking_status = slotText ? "valid" : "unassigned";
}

// Keep the roster in sync when a slot is (un)assigned via the interest flow.
function syncStudentSlot(userId: number | null, slotText: string | null) {
  setRosterSlot(studentForSpace(null, userId), slotText);
}

// Free every space this student currently holds (by direct link or login user),
// reverting any matching fulfilled interest to pending. Lets an assign MOVE them.
function releaseStudentSpaces(studentId: string) {
  const loginUser = database.users.find((candidate) => candidate.code === studentId) ?? null;
  database.spaces.forEach((space) => {
    const heldByStudent = space.assigned_student_id === studentId;
    const heldByUser = loginUser != null && space.assigned_user_id === loginUser.id;
    if (space.status !== "assigned" || (!heldByStudent && !heldByUser)) return;
    if (loginUser) {
      const fulfilled = database.interest.find(
        (row) => row.user_id === loginUser.id && row.lot_id === space.lot_id && row.status === "fulfilled",
      );
      if (fulfilled) fulfilled.status = "pending";
    }
    space.status = "available";
    space.assigned_user_id = null;
    space.assigned_student_id = null;
  });
}

export interface MockResponse {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
}

function ok(data: unknown, status = 200): MockResponse {
  return { status, ok: true, json: async () => ({ data }) };
}
function noContent(): MockResponse {
  return { status: 204, ok: true, json: async () => ({}) };
}
function fail(code: string, message: string, status: number): MockResponse {
  return { status, ok: false, json: async () => ({ error: { code, message } }) };
}

function nowIso(): string {
  return new Date().toISOString();
}

// The router. `path` may carry a query string; `options` mirrors fetch's.
export async function mockFetch(
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<MockResponse> {
  await new Promise((resolve) => setTimeout(resolve, 120)); // feel like a network hop
  const method = (options.method ?? "GET").toUpperCase();
  const [rawPath, query = ""] = path.split("?");
  const parts = rawPath.split("/").filter(Boolean); // e.g. ["api","lots","1","spaces"]
  const body = options.body ? (JSON.parse(options.body) as Record<string, unknown>) : {};
  const token = (options.headers?.["Authorization"] ?? "").replace(/^Bearer\s+/, "") || null;
  const actor = userFromToken(token);

  const requireAdmin = (): MockResponse | null =>
    actor?.role === "admin" ? null : fail("forbidden", "Admin access required", 403);

  // GET /api/health
  if (method === "GET" && rawPath === "/api/health") return ok({ status: "ok" });

  // POST /api/auth/student  { code }
  if (method === "POST" && rawPath === "/api/auth/student") {
    const student = database.users.find((u) => u.role === "student" && u.code === String(body.code ?? "").trim());
    if (!student) return fail("unauthorized", "Invalid student code", 401);
    return ok({ token: issueToken(student), user: publicUser(student) });
  }

  // POST /api/auth/admin  { username, password }
  if (method === "POST" && rawPath === "/api/auth/admin") {
    const admin = database.users.find(
      (u) => u.role === "admin" && u.username === body.username && u.password === body.password,
    );
    if (!admin) return fail("unauthorized", "Invalid username or password", 401);
    return ok({ token: issueToken(admin), user: publicUser(admin) });
  }

  // POST /api/auth/logout
  if (method === "POST" && rawPath === "/api/auth/logout") return noContent();

  // GET /api/auth/me
  if (method === "GET" && rawPath === "/api/auth/me") {
    if (!actor) return fail("unauthorized", "Not logged in", 401);
    return ok(publicUser(actor));
  }

  // GET /api/lots
  if (method === "GET" && rawPath === "/api/lots") {
    if (!actor) return fail("unauthorized", "Not logged in", 401);
    const lots = [...database.lots].sort((a, b) => a.display_order - b.display_order).map(serializeLot);
    return ok(lots);
  }

  // POST /api/lots  { name, number?, capacity?, display_order? }
  if (method === "POST" && rawPath === "/api/lots") {
    const denied = requireAdmin();
    if (denied) return denied;
    const name = String(body.name ?? "").trim();
    const capacity = body.capacity;
    const numberInput = body.number;
    if (!name) return fail("bad_request", "name is required", 400);
    if (numberInput != null && (!Number.isInteger(numberInput) || (numberInput as number) < 0))
      return fail("bad_request", "number must be a non-negative integer", 400);
    if (capacity != null && (!Number.isInteger(capacity) || (capacity as number) < 0))
      return fail("bad_request", "capacity must be a non-negative integer", 400);
    if (database.lots.some((lot) => lot.name.toLowerCase() === name.toLowerCase()))
      return fail("conflict", "A lot with that name already exists", 409);
    const displayOrder =
      (body.display_order as number) ?? Math.max(0, ...database.lots.map((lot) => lot.display_order)) + 1;
    // default the lot number to its display order when the admin didn't set one
    const lotNumber = numberInput != null ? (numberInput as number) : displayOrder;
    if (database.lots.some((lot) => lot.number === lotNumber))
      return fail("conflict", `Lot number ${lotNumber} is already in use`, 409);
    const lot: MockLot = { id: database.nextId.lot++, name, number: lotNumber, display_order: displayOrder, map_image_url: null };
    database.lots.push(lot);
    for (let index = 1; index <= ((capacity as number) || 0); index++) {
      database.spaces.push({
        id: database.nextId.space++, lot_id: lot.id, label: `${lot.number}-${index}`,
        status: "available", x: null, y: null, w: null, h: null, rotation: null, assigned_user_id: null, assigned_student_id: null,
      });
    }
    save();
    return ok(serializeLot(lot), 201);
  }

  // DELETE /api/lots/:id   (admin) — remove a lot, but only if none of its spaces are assigned
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "lots" && parts.length === 3) {
    const denied = requireAdmin();
    if (denied) return denied;
    const lotId = Number(parts[2]);
    if (!database.lots.some((lot) => lot.id === lotId)) return fail("not_found", "Lot not found", 404);
    const assigned = database.spaces.filter((space) => space.lot_id === lotId && space.status === "assigned");
    if (assigned.length)
      return fail("conflict", `cannot remove a lot with assigned space(s): ${assigned.map((s) => s.label).join(", ")}`, 409);
    database.lots = database.lots.filter((lot) => lot.id !== lotId);
    database.spaces = database.spaces.filter((space) => space.lot_id !== lotId);
    database.interest = database.interest.filter((row) => row.lot_id !== lotId);
    save();
    return noContent();
  }

  // GET /api/lots/:id/spaces
  if (method === "GET" && parts[0] === "api" && parts[1] === "lots" && parts[3] === "spaces" && method === "GET") {
    if (!actor) return fail("unauthorized", "Not logged in", 401);
    const lotId = Number(parts[2]);
    const spaces = database.spaces.filter((space) => space.lot_id === lotId).map(serializeSpace);
    return ok(spaces);
  }

  // PUT /api/lots/:id/layout  { spaces:[{id?,label,x,y,rotation?}] }
  if (method === "PUT" && parts[0] === "api" && parts[1] === "lots" && parts[3] === "layout") {
    const denied = requireAdmin();
    if (denied) return denied;
    const lotId = Number(parts[2]);
    if (!database.lots.some((lot) => lot.id === lotId)) return fail("not_found", "Lot not found", 404);
    const incoming = body.spaces;
    if (!Array.isArray(incoming)) return fail("bad_request", "spaces (array) is required", 400);
    const clean: Array<{ id: number | null; label: string; x: number; y: number; w: number; h: number; rotation: number }> = [];
    for (const raw of incoming as Array<Record<string, unknown>>) {
      const label = String(raw.label ?? "").trim();
      const x = raw.x, y = raw.y, rotation = raw.rotation;
      if (!label) return fail("bad_request", "each space needs a non-empty label", 400);
      if (!isFraction(x) || !isFraction(y)) return fail("bad_request", "x and y must be numbers in 0..1", 400);
      clean.push({
        id: typeof raw.id === "number" ? raw.id : null,
        label, x: x as number, y: y as number,
        w: isFraction(raw.w) ? (raw.w as number) : DEFAULT_SPOT_W,
        h: isFraction(raw.h) ? (raw.h as number) : DEFAULT_SPOT_H,
        rotation: typeof rotation === "number" ? rotation : 0,
      });
    }
    const keepIds = new Set(clean.map((entry) => entry.id).filter((id): id is number => id != null));
    const existing = database.spaces.filter((space) => space.lot_id === lotId);
    const toDelete = existing.filter((space) => !keepIds.has(space.id));
    const blocked = toDelete.filter((space) => space.status === "assigned").map((space) => space.id);
    if (blocked.length) return fail("conflict", `cannot delete assigned space(s): ${blocked}`, 409);
    for (const entry of clean) {
      if (entry.id != null) {
        const target = database.spaces.find((space) => space.id === entry.id && space.lot_id === lotId);
        if (target) { target.label = entry.label; target.x = entry.x; target.y = entry.y; target.w = entry.w; target.h = entry.h; target.rotation = entry.rotation; }
      } else {
        database.spaces.push({
          id: database.nextId.space++, lot_id: lotId, label: entry.label,
          status: "available", x: entry.x, y: entry.y, w: entry.w, h: entry.h, rotation: entry.rotation, assigned_user_id: null, assigned_student_id: null,
        });
      }
    }
    const deleteIds = new Set(toDelete.map((space) => space.id));
    database.spaces = database.spaces.filter((space) => !deleteIds.has(space.id));
    save();
    const spaces = database.spaces.filter((space) => space.lot_id === lotId).map(serializeSpace);
    return ok({ lotId, spaces });
  }

  // PATCH /api/spaces  { ids:number[], status:"available"|"disabled" }
  if (method === "PATCH" && rawPath === "/api/spaces") {
    const denied = requireAdmin();
    if (denied) return denied;
    const ids = (body.ids as number[]) ?? [];
    const status = body.status as MockSpace["status"];
    if (!Array.isArray(ids) || (status !== "available" && status !== "disabled"))
      return fail("bad_request", "ids (array) and status (available|disabled) required", 400);
    const targets = database.spaces.filter((space) => ids.includes(space.id));
    if (targets.some((space) => space.status === "assigned"))
      return fail("conflict", "cannot change an assigned space", 409);
    for (const space of targets) space.status = status;
    save();
    return ok(targets.map(serializeSpace));
  }

  // GET /api/interest?status=pending   (admin)
  if (method === "GET" && rawPath === "/api/interest") {
    const denied = requireAdmin();
    if (denied) return denied;
    const statusFilter = new URLSearchParams(query).get("status");
    const rows = database.interest.filter((row) => !statusFilter || row.status === statusFilter);
    return ok(rows.map(serializeInterest));
  }

  // GET /api/interest/me   (student)
  if (method === "GET" && rawPath === "/api/interest/me") {
    if (!actor) return fail("unauthorized", "Not logged in", 401);
    const mine = database.interest
      .filter((row) => row.user_id === actor.id && row.status !== "cancelled")
      .sort((a, b) => b.id - a.id)[0];
    return ok(mine ? serializeInterest(mine) : null);
  }

  // POST /api/interest  { lotId, spaceIds }   (student) — pick specific spots in a
  // lot and submit. Upserts the student's single active request (re-submit replaces it).
  if (method === "POST" && rawPath === "/api/interest") {
    if (!actor || actor.role !== "student") return fail("forbidden", "Students only", 403);
    const lotId = Number(body.lotId);
    if (!database.lots.some((lot) => lot.id === lotId)) return fail("bad_request", "Unknown lot", 400);
    const requestedIds = Array.isArray(body.spaceIds) ? body.spaceIds.map(Number) : [];
    const lotSpaces = database.spaces.filter((space) => space.lot_id === lotId);
    const spaceIds = requestedIds.filter((id) =>
      lotSpaces.some((space) => space.id === id && space.status === "available"));
    if (requestedIds.length === 0) return fail("bad_request", "Pick an available spot", 400);
    if (requestedIds.length > 1) return fail("bad_request", "Only one spot can be requested", 400);
    if (spaceIds.length !== requestedIds.length)
      return fail("conflict", "The chosen spot is no longer available", 409);
    // Replace the student's active (pending) request if they have one.
    const existing = database.interest.find((row) => row.user_id === actor.id && row.status === "pending");
    if (existing) {
      existing.lot_id = lotId;
      existing.space_ids = spaceIds;
      existing.created_at = nowIso();
      save();
      return ok(serializeInterest(existing));
    }
    const created: MockInterest = {
      id: database.nextId.interest++, user_id: actor.id, lot_id: lotId,
      space_ids: spaceIds, status: "pending", created_at: nowIso(),
    };
    database.interest.push(created);
    save();
    return ok(serializeInterest(created), 201);
  }

  // DELETE /api/interest/me   (student) — withdraw the active request
  if (method === "DELETE" && rawPath === "/api/interest/me") {
    if (!actor || actor.role !== "student") return fail("forbidden", "Students only", 403);
    const active = database.interest.find((row) => row.user_id === actor.id && row.status === "pending");
    if (active) active.status = "cancelled";
    save();
    return noContent();
  }

  // GET /api/students?q=...   (admin) — search by name or student_id substring
  if (method === "GET" && rawPath === "/api/students") {
    const denied = requireAdmin();
    if (denied) return denied;
    const term = new URLSearchParams(query).get("q")?.trim().toLowerCase() ?? "";
    const matches = database.students.filter((student) => {
      if (!term) return true;
      const fullName = `${student.first} ${student.last}`.toLowerCase();
      return fullName.includes(term) || student.student_id.toLowerCase().includes(term);
    });
    const sorted = [...matches].sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
    return ok(sorted.map(serializeStudent));
  }

  // POST /api/students  { first, last, student_id, email, grade }   (admin)
  if (method === "POST" && rawPath === "/api/students") {
    const denied = requireAdmin();
    if (denied) return denied;
    const studentId = String(body.student_id ?? "").trim();
    const first = String(body.first ?? "").trim();
    const last = String(body.last ?? "").trim();
    if (!studentId || !first || !last) return fail("bad_request", "first, last and student_id are required", 400);
    if (database.students.some((row) => row.student_id.toLowerCase() === studentId.toLowerCase()))
      return fail("conflict", `Student id ${studentId} already exists`, 409);
    const student: MockStudent = {
      id: database.nextId.student++, first, last, student_id: studentId,
      email: String(body.email ?? "").trim(), grade: String(body.grade ?? "").trim(),
      assigned_slot: null, parking_status: "unassigned",
    };
    database.students.push(student);
    save();
    return ok(serializeStudent(student), 201);
  }

  // PATCH /api/students/:id  (admin) — edit fields incl. parking_status
  if (method === "PATCH" && parts[0] === "api" && parts[1] === "students" && parts.length === 3) {
    const denied = requireAdmin();
    if (denied) return denied;
    const student = database.students.find((row) => row.id === Number(parts[2]));
    if (!student) return fail("not_found", "Student not found", 404);
    if (body.student_id != null) {
      const nextStudentId = String(body.student_id).trim();
      if (!nextStudentId) return fail("bad_request", "student_id cannot be blank", 400);
      if (database.students.some((row) => row.id !== student.id && row.student_id.toLowerCase() === nextStudentId.toLowerCase()))
        return fail("conflict", `Student id ${nextStudentId} already exists`, 409);
      student.student_id = nextStudentId;
    }
    if (body.first != null) student.first = String(body.first).trim();
    if (body.last != null) student.last = String(body.last).trim();
    if (body.email != null) student.email = String(body.email).trim();
    if (body.grade != null) student.grade = String(body.grade).trim();
    const validStatuses: ParkingStatus[] = ["unassigned", "valid", "expired", "suspended"];
    if (body.parking_status != null && validStatuses.includes(body.parking_status as ParkingStatus))
      student.parking_status = body.parking_status as ParkingStatus;
    save();
    return ok(serializeStudent(student));
  }

  // DELETE /api/students/:id   (admin)
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "students" && parts.length === 3) {
    const denied = requireAdmin();
    if (denied) return denied;
    const studentId = Number(parts[2]);
    if (!database.students.some((row) => row.id === studentId)) return fail("not_found", "Student not found", 404);
    database.students = database.students.filter((row) => row.id !== studentId);
    save();
    return noContent();
  }

  // POST /api/students/:id/assign  { spaceId }   (admin) — place/move a roster
  // student directly into a lot spot, no interest request required.
  if (method === "POST" && parts[0] === "api" && parts[1] === "students" && parts[3] === "assign" && parts.length === 4) {
    const denied = requireAdmin();
    if (denied) return denied;
    const student = database.students.find((row) => row.id === Number(parts[2]));
    if (!student) return fail("not_found", "Student not found", 404);
    const space = database.spaces.find((candidate) => candidate.id === Number(body.spaceId));
    if (!space) return fail("not_found", "Space not found", 404);
    if (space.status !== "available") return fail("conflict", "Space is not available", 409);
    // Free any spot this student already holds so this becomes a move, not a duplicate.
    releaseStudentSpaces(student.student_id);
    const loginUser = database.users.find((candidate) => candidate.code === student.student_id) ?? null;
    space.status = "assigned";
    space.assigned_student_id = student.student_id;
    space.assigned_user_id = loginUser?.id ?? null;
    const lot = database.lots.find((candidate) => candidate.id === space.lot_id);
    setRosterSlot(student, `${lot?.name ?? `Lot ${space.lot_id}`} · ${space.label}`);
    // If they have a login account, point their active request at this lot and fulfil it.
    if (loginUser) {
      const active = database.interest.find((row) => row.user_id === loginUser.id && row.status === "pending");
      if (active) { active.lot_id = space.lot_id; active.status = "fulfilled"; }
    }
    save();
    return ok(serializeSpace(space));
  }

  // POST /api/assignments/move  { fromSpaceId, toLotId }   (admin) — unassign the
  // occupant and re-queue their request to another lot as PENDING; the admin then
  // assigns them a spot in that lot via the normal Assign-to-Spot flow.
  if (method === "POST" && rawPath === "/api/assignments/move") {
    const denied = requireAdmin();
    if (denied) return denied;
    const from = database.spaces.find((candidate) => candidate.id === Number(body.fromSpaceId));
    const toLotId = Number(body.toLotId);
    const toLot = database.lots.find((candidate) => candidate.id === toLotId);
    if (!from) return fail("not_found", "Space not found", 404);
    if (!toLot) return fail("not_found", "Lot not found", 404);
    if (from.status !== "assigned") return fail("conflict", "Source space is not assigned", 409);
    const userId = from.assigned_user_id;
    const studentId = from.assigned_student_id;
    from.status = "available";
    from.assigned_user_id = null;
    from.assigned_student_id = null;
    // Unassigned until the admin picks a spot in the new lot.
    setRosterSlot(studentForSpace(studentId, userId), null);
    // Re-point the occupant's fulfilled request to the new lot as pending
    // (or open a fresh pending request if they have a login account but none).
    if (userId != null) {
      const moved = database.interest.find(
        (row) => row.user_id === userId && row.lot_id === from.lot_id && row.status === "fulfilled",
      );
      if (moved) { moved.lot_id = toLotId; moved.space_ids = []; moved.status = "pending"; }
      else database.interest.push({ id: database.nextId.interest++, user_id: userId, lot_id: toLotId, space_ids: [], status: "pending", created_at: nowIso() });
    }
    save();
    return ok({ fromSpaceId: from.id, toLotId });
  }

  // POST /api/assignments  { spaceId, userId, interestId }   (admin)
  if (method === "POST" && rawPath === "/api/assignments") {
    const denied = requireAdmin();
    if (denied) return denied;
    const spaceId = Number(body.spaceId);
    const userId = Number(body.userId);
    const interestId = Number(body.interestId);
    const space = database.spaces.find((candidate) => candidate.id === spaceId);
    if (!space) return fail("not_found", "Space not found", 404);
    if (space.status !== "available") return fail("conflict", "Space is not available", 409);
    space.status = "assigned";
    space.assigned_user_id = userId;
    const assignedUser = database.users.find((candidate) => candidate.id === userId);
    space.assigned_student_id = assignedUser?.code ?? null;
    const interest = database.interest.find((row) => row.id === interestId);
    if (interest) interest.status = "fulfilled";
    const lot = database.lots.find((candidate) => candidate.id === space.lot_id);
    syncStudentSlot(userId, `${lot?.name ?? `Lot ${space.lot_id}`} · ${space.label}`);
    save();
    return ok({ spaceId, userId, interestId });
  }

  // DELETE /api/assignments/:spaceId   (admin — unassign)
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "assignments") {
    const denied = requireAdmin();
    if (denied) return denied;
    const spaceId = Number(parts[2]);
    const space = database.spaces.find((candidate) => candidate.id === spaceId);
    if (!space) return fail("not_found", "Assignment not found", 404);
    const freedUserId = space.assigned_user_id;
    const freedStudentId = space.assigned_student_id;
    space.status = "available";
    space.assigned_user_id = null;
    space.assigned_student_id = null;
    // Put the student's request back in the pending queue so they can be
    // reassigned, and clear their roster slot (parking_status -> unassigned).
    if (freedUserId != null) {
      const fulfilled = database.interest.find(
        (row) => row.user_id === freedUserId && row.lot_id === space.lot_id && row.status === "fulfilled",
      );
      if (fulfilled) fulfilled.status = "pending";
    }
    setRosterSlot(studentForSpace(freedStudentId, freedUserId), null);
    save();
    return noContent();
  }

  return fail("not_found", `No mock route for ${method} ${rawPath}`, 404);
}

// Multipart uploads, handled apart from mockFetch: lot maps and the student CSV.
export async function mockUpload(
  path: string,
  file: File,
  headers: Record<string, string> = {},
): Promise<MockResponse> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const token = (headers["Authorization"] ?? "").replace(/^Bearer\s+/, "") || null;
  if (userFromToken(token)?.role !== "admin") return fail("forbidden", "Admin access required", 403);

  // POST /api/students/import — CSV batch upsert (columns: First,Last,studentId,email,grade)
  if (path.replace(/\?.*$/, "").endsWith("/students/import")) {
    const text = await readAsText(file);
    return importStudentsCsv(text);
  }

  const parts = path.split("/").filter(Boolean);
  const lotId = Number(parts[2]);
  const lot = database.lots.find((candidate) => candidate.id === lotId);
  if (!lot) return fail("not_found", "Lot not found", 404);
  if (!["image/png", "image/jpeg"].includes(file.type))
    return fail("bad_request", "Only PNG or JPG images are allowed", 400);
  if (file.size > 5 * 1024 * 1024) return fail("payload_too_large", "Image is larger than 5 MB", 413);
  // Read as a base64 data URL, NOT URL.createObjectURL(): a blob: URL is only valid
  // for the current page session, so it renders once but breaks on refresh and is dead
  // weight once persisted to localStorage. A data URL survives save()/reload.
  lot.map_image_url = await readAsDataUrl(file);
  save();
  return ok(serializeLot(lot));
}

// Turn an uploaded File into a persistable base64 data URL (mock stand-in for a
// server writing the file to disk and returning its URL).
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

// Upsert students from CSV text by student_id. Columns: First,Last,studentId,
// email,grade (a header row is detected and skipped). Slot/status are untouched.
function importStudentsCsv(text: string): MockResponse {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return fail("bad_request", "The CSV file is empty", 400);
  if (lines[0].toLowerCase().replace(/\s/g, "").startsWith("first,last")) lines.shift();
  let added = 0;
  let updated = 0;
  const errors: string[] = [];
  lines.forEach((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const [first, last, studentId, email = "", grade = ""] = cells;
    if (!first || !last || !studentId) {
      errors.push(`Row ${index + 1}: need First, Last and studentId`);
      return;
    }
    const existing = database.students.find((row) => row.student_id.toLowerCase() === studentId.toLowerCase());
    if (existing) {
      existing.first = first; existing.last = last; existing.email = email; existing.grade = grade;
      updated++;
    } else {
      database.students.push({
        id: database.nextId.student++, first, last, student_id: studentId, email, grade,
        assigned_slot: null, parking_status: "unassigned",
      });
      added++;
    }
  });
  save();
  return ok({ added, updated, errors });
}

function isFraction(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}
