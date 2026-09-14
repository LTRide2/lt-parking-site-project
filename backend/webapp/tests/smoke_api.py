#!/usr/bin/env python3
"""End-to-end smoke test for the LTRide API.

Runs every endpoint against a live server and asserts the responses match the
frontend contract (snake_case fields, the shapes the Redux slices consume) and
the UI-backport behaviours (lot number, roster, preferred-spot interest, move).
Stdlib only. Assumes a freshly migrated + seeded database.

Usage: python webapp/tests/smoke_api.py [base_url]   (default http://localhost:8000)
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

passed = 0
failed = 0


def call(method, path, token=None, body=None):
    """Return (status_code, parsed_json_or_text) for a JSON request."""
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    return _send(request)


def call_multipart(path, token, field, filename, content, content_type):
    """POST a single-file multipart/form-data body (for CSV import / map upload)."""
    boundary = "----ltridesmoke42"
    prefix = (f"--{boundary}\r\n"
              f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
              f"Content-Type: {content_type}\r\n\r\n").encode()
    body = prefix + content + f"\r\n--{boundary}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST")
    return _send(request)


def _send(request):
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode()
            return response.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, raw


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}  {detail}")


def available_ids(token, lot_id, count):
    _, payload = call("GET", f"/api/lots/{lot_id}/spaces", token=token)
    return [s["id"] for s in payload["data"] if s["status"] == "available"][:count]


print(f"== LTRide API smoke test against {BASE} ==\n")

# ---- B1 health -------------------------------------------------------------
print("B1 health")
status, payload = call("GET", "/api/health")
check("GET /api/health -> 200 ok", status == 200 and payload["data"]["status"] == "ok", payload)
status, payload = call("GET", "/api/nope")
check("unknown route -> 404 error envelope",
      status == 404 and payload["error"]["code"] == "not_found", payload)

# ---- B3 auth ---------------------------------------------------------------
print("\nB3 auth")
status, payload = call("POST", "/api/auth/student", body={"code": "STU001"})
check("student login -> 200 + token + email",
      status == 200 and "token" in payload["data"] and payload["data"]["user"]["email"] == "alice@lt.edu", payload)
alice_token = payload["data"]["token"] if status == 200 else None
alice_id = payload["data"]["user"]["id"] if status == 200 else None

status, payload = call("POST", "/api/auth/student", body={"code": "STU002"})
bob_token = payload["data"]["token"] if status == 200 else None
bob_id = payload["data"]["user"]["id"] if status == 200 else None
status, payload = call("POST", "/api/auth/student", body={"code": "STU003"})
andrew_token = payload["data"]["token"] if status == 200 else None

status, payload = call("POST", "/api/auth/student", body={"code": "NOPE"})
check("student bad code -> 401", status == 401, payload)
status, payload = call("POST", "/api/auth/admin", body={"username": "admin", "password": "admin123"})
check("admin login -> 200 + token", status == 200 and "token" in payload["data"], payload)
admin = payload["data"]["token"] if status == 200 else None
status, payload = call("POST", "/api/auth/admin", body={"username": "admin", "password": "wrong"})
check("admin bad password -> 401", status == 401, payload)
status, payload = call("GET", "/api/auth/me", token=alice_token)
check("/me -> 200 self", status == 200 and payload["data"]["id"] == alice_id, payload)
status, payload = call("GET", "/api/auth/me")
check("/me no token -> 401", status == 401, payload)

# ---- B4 read lots & spaces (snake_case, number, bare arrays) ---------------
print("\nB4 read lots & spaces")
status, payload = call("GET", "/api/lots", token=alice_token)
lots = payload["data"] if status == 200 else []
by_name = {lot["name"]: lot for lot in lots}
lot1, lot4, lot5 = by_name.get("Lot 1"), by_name.get("Lot 4"), by_name.get("Lot 5")
check("GET /api/lots -> array; Lot 1 number=1 cap=8 avail=6",
      status == 200 and lot1 and lot1["number"] == 1 and lot1["capacity"] == 8
      and lot1["available_count"] == 6, lot1)
check("lot fields are snake_case",
      lot1 and "display_order" in lot1 and "map_image_url" in lot1 and "available_count" in lot1, lot1)

status, payload = call("GET", f"/api/lots/{lot1['id']}/spaces", token=alice_token)
spaces = payload["data"] if status == 200 else []
a8 = next((s for s in spaces if s["label"] == "A8"), None)
check("GET /lots/1/spaces -> BARE array of 8", isinstance(spaces, list) and len(spaces) == 8, payload)
check("A8 assigned to Alice w/ position + size + snake_case",
      a8 and a8["status"] == "assigned" and a8["assigned_user_name"] == "Alice"
      and a8["assigned_student_id"] == "STU001" and a8["x"] == 0.65 and a8["y"] == 0.55
      and a8["w"] == 0.05 and a8["h"] == 0.03 and a8["rotation"] == 90 and a8["lot_id"] == lot1["id"], a8)
status, payload = call("GET", "/api/lots/999/spaces", token=alice_token)
check("GET /lots/999/spaces -> 404", status == 404, payload)
status, payload = call("GET", "/api/lots")
check("GET /api/lots no token -> 401", status == 401, payload)

# ---- B5 admin enable/disable ----------------------------------------------
print("\nB5 admin enable/disable")
two = available_ids(admin, lot4["id"], 2)
status, payload = call("PATCH", "/api/spaces", token=admin, body={"ids": two, "status": "disabled"})
check("bulk disable 2 -> 200 array both disabled",
      status == 200 and len(payload["data"]) == 2 and all(s["status"] == "disabled" for s in payload["data"]), payload)
status, payload = call("PATCH", f"/api/spaces/{two[0]}", token=admin, body={"status": "available"})
check("single re-enable -> 200 available", status == 200 and payload["data"]["status"] == "available", payload)
status, payload = call("PATCH", f"/api/spaces/{two[1]}", token=alice_token, body={"status": "available"})
check("student toggling -> 403", status == 403, payload)
status, payload = call("PATCH", f"/api/spaces/{two[1]}", token=admin, body={"status": "banana"})
check("invalid status -> 400", status == 400, payload)
status, payload = call("PATCH", "/api/spaces", token=admin, body={"ids": [a8["id"]], "status": "disabled"})
check("bulk touching an assigned space -> 409", status == 409, payload)
call("PATCH", "/api/spaces", token=admin, body={"ids": [two[1]], "status": "available"})

# ---- B6 student interest (preferred spot) ----------------------------------
print("\nB6 student interest")
pick = available_ids(andrew_token, lot4["id"], 1)[0]
status, payload = call("POST", "/api/interest", token=andrew_token, body={"lotId": lot4["id"], "spaceIds": [pick]})
check("Andrew requests one spot -> 201 pending w/ space_ids + user_name",
      status == 201 and payload["data"]["status"] == "pending"
      and payload["data"]["space_ids"] == [pick] and payload["data"]["user_name"] == "Andrew", payload)
status, payload = call("POST", "/api/interest", token=andrew_token, body={"lotId": lot4["id"], "spaceIds": []})
check("no spot -> 400", status == 400, payload)
status, payload = call("POST", "/api/interest", token=andrew_token,
                       body={"lotId": lot4["id"], "spaceIds": available_ids(andrew_token, lot4["id"], 2)})
check("two spots -> 400", status == 400, payload)
status, payload = call("POST", "/api/interest", token=andrew_token, body={"lotId": lot1["id"], "spaceIds": [a8["id"]]})
check("unavailable spot -> 409", status == 409, payload)
newpick = available_ids(andrew_token, lot4["id"], 1)[0]
status, payload = call("POST", "/api/interest", token=andrew_token, body={"lotId": lot4["id"], "spaceIds": [newpick]})
check("re-submit (upsert) -> 200 still pending", status == 200 and payload["data"]["status"] == "pending", payload)
status, payload = call("GET", "/api/interest/me", token=andrew_token)
check("/interest/me -> single object", status == 200 and payload["data"] and payload["data"]["space_ids"] == [newpick], payload)
status, payload = call("GET", "/api/interest?status=pending", token=admin)
check("admin list pending -> names present (Bob, Olivia, Andrew)",
      status == 200 and {"Andrew", "Bob", "Olivia"}.issubset({row["user_name"] for row in payload["data"]}), payload)
status, payload = call("GET", "/api/interest", token=andrew_token)
check("student GET all interest -> 403", status == 403, payload)
status, payload = call("DELETE", "/api/interest/me", token=andrew_token)
check("withdraw -> 204", status == 204, payload)
status, payload = call("GET", "/api/interest/me", token=andrew_token)
check("/interest/me after withdraw -> null", status == 200 and payload["data"] is None, payload)

# ---- B7 assignments (spaceId-keyed unassign, roster sync) ------------------
print("\nB7 assignments")
target = available_ids(admin, lot4["id"], 1)[0]
status, payload = call("POST", "/api/assignments", token=admin, body={"spaceId": target, "userId": bob_id})
check("assign space -> Bob -> 201", status == 201 and payload["data"]["space_id"] == target, payload)
status, payload = call("GET", f"/api/lots/{lot4['id']}/spaces", token=admin)
tspace = next((s for s in payload["data"] if s["id"] == target), None)
check("space now assigned to Bob (name + student_id)",
      tspace and tspace["status"] == "assigned" and tspace["assigned_user_id"] == bob_id
      and tspace["assigned_user_name"] == "Bob" and tspace["assigned_student_id"] == "STU002", tspace)
status, payload = call("GET", "/api/students?q=Baker", token=admin)
bob_row = payload["data"][0] if payload["data"] else None
check("roster: Bob now valid w/ slot text",
      bob_row and bob_row["parking_status"] == "valid" and bob_row["assigned_slot"] and "Lot 4" in bob_row["assigned_slot"], bob_row)
status, payload = call("POST", "/api/assignments", token=admin, body={"spaceId": target, "userId": alice_id})
check("re-assign same space -> 409", status == 409, payload)
status, payload = call("POST", "/api/assignments", token=admin, body={"spaceId": target})
check("missing userId -> 400", status == 400, payload)
status, payload = call("DELETE", f"/api/assignments/{target}", token=admin)
check("unassign by spaceId -> 204", status == 204, payload)
status, payload = call("GET", f"/api/lots/{lot4['id']}/spaces", token=admin)
tspace = next((s for s in payload["data"] if s["id"] == target), None)
check("space available again", tspace and tspace["status"] == "available", tspace)
status, payload = call("GET", "/api/interest?status=pending", token=admin)
check("Bob's request reverted to pending", any(r["user_name"] == "Bob" for r in payload["data"]), payload)
status, payload = call("GET", "/api/students?q=Baker", token=admin)
check("roster: Bob back to unassigned", payload["data"][0]["parking_status"] == "unassigned", payload["data"])

# ---- move: unassign + re-queue to another lot ------------------------------
print("\nassignments/move")
target = available_ids(admin, lot4["id"], 1)[0]
call("POST", "/api/assignments", token=admin, body={"spaceId": target, "userId": bob_id})
status, payload = call("POST", "/api/assignments/move", token=admin,
                       body={"fromSpaceId": target, "toLotId": lot5["id"]})
check("move -> 200", status == 200 and payload["data"]["to_lot_id"] == lot5["id"], payload)
status, payload = call("GET", f"/api/lots/{lot4['id']}/spaces", token=admin)
check("source space freed", next(s["status"] for s in payload["data"] if s["id"] == target) == "available", payload)
status, payload = call("GET", "/api/interest?status=pending", token=admin)
moved = next((r for r in payload["data"] if r["user_name"] == "Bob"), None)
check("Bob re-queued as pending in Lot 5", moved and moved["lot_id"] == lot5["id"], moved)

# ---- B8 save layout (w/h) --------------------------------------------------
print("\nB8 save layout")
status, payload = call("PUT", f"/api/lots/{lot5['id']}/layout", token=admin,
                       body={"spaces": [{"label": "Z1", "x": 0.25, "y": 0.4, "w": 0.1, "h": 0.05, "rotation": 0},
                                        {"label": "Z2", "x": 0.6, "y": 0.4, "rotation": 90}]})
check("PUT layout (2 spaces) -> 200 lot_id + spaces",
      status == 200 and payload["data"]["lot_id"] == lot5["id"] and len(payload["data"]["spaces"]) == 2, payload)
status, payload = call("GET", f"/api/lots/{lot5['id']}/spaces", token=admin)
z1 = next((s for s in payload["data"] if s["label"] == "Z1"), None)
check("re-read: Z1 x/y/w persisted, full-replace to 2",
      len(payload["data"]) == 2 and z1 and z1["x"] == 0.25 and z1["w"] == 0.1, z1)
status, payload = call("PUT", f"/api/lots/{lot5['id']}/layout", token=alice_token, body={"spaces": []})
check("student PUT layout -> 403", status == 403, payload)
status, payload = call("PUT", f"/api/lots/{lot5['id']}/layout", token=admin, body={"spaces": [{"label": "X", "x": 9, "y": 0.1}]})
check("out-of-range coord -> 400", status == 400, payload)
status, payload = call("PUT", "/api/lots/999/layout", token=admin, body={"spaces": []})
check("layout on missing lot -> 404", status == 404, payload)

# ---- B9 create lot (number) ------------------------------------------------
print("\nB9 create lot")
status, payload = call("POST", "/api/lots", token=admin, body={"name": "North Lot", "number": 99, "capacity": 5})
new_lot = payload["data"] if status == 201 else {}
check("create lot number=99 cap=5 -> 201", status == 201 and new_lot.get("number") == 99 and new_lot.get("capacity") == 5, payload)
status, payload = call("GET", f"/api/lots/{new_lot['id']}/spaces", token=admin)
check("new lot has 5 positionless spaces labelled 99-n",
      len(payload["data"]) == 5 and all(s["x"] is None for s in payload["data"])
      and payload["data"][0]["label"] == "99-1", payload)
status, payload = call("POST", "/api/lots", token=admin, body={"name": "   "})
check("blank name -> 400", status == 400, payload)
status, payload = call("POST", "/api/lots", token=admin, body={"name": "North Lot"})
check("duplicate name -> 409", status == 409, payload)
status, payload = call("POST", "/api/lots", token=admin, body={"name": "Other", "number": 99})
check("duplicate number -> 409", status == 409, payload)
status, payload = call("POST", "/api/lots", token=alice_token, body={"name": "Sneaky"})
check("student create lot -> 403", status == 403, payload)

# ---- delete lot ------------------------------------------------------------
print("\ndelete lot")
status, payload = call("DELETE", f"/api/lots/{new_lot['id']}", token=admin)
check("delete empty lot -> 204", status == 204, payload)
status, payload = call("DELETE", f"/api/lots/{lot1['id']}", token=admin)
check("delete lot with an assigned space -> 409", status == 409, payload)

# ---- students roster (CRUD + assign + CSV) ---------------------------------
print("\nstudents roster")
status, payload = call("GET", "/api/students", token=admin)
check("GET /api/students -> 5 seeded", status == 200 and len(payload["data"]) == 5, payload)
status, payload = call("GET", "/api/students", token=alice_token)
check("student GET roster -> 403", status == 403, payload)
status, payload = call("POST", "/api/students", token=admin,
                       body={"first": "Test", "last": "User", "student_id": "STU999", "email": "t@x", "grade": "10"})
new_student = payload["data"] if status == 201 else {}
check("create student -> 201 unassigned", status == 201 and new_student.get("parking_status") == "unassigned", payload)
status, payload = call("POST", "/api/students", token=admin, body={"first": "T", "last": "U", "student_id": "STU999"})
check("duplicate student_id -> 409", status == 409, payload)
status, payload = call("POST", "/api/students", token=admin, body={"first": "T"})
check("missing fields -> 400", status == 400, payload)
status, payload = call("PATCH", f"/api/students/{new_student['id']}", token=admin, body={"parking_status": "suspended"})
check("patch parking_status -> suspended", status == 200 and payload["data"]["parking_status"] == "suspended", payload)
status, payload = call("PATCH", f"/api/students/{new_student['id']}", token=admin, body={"student_id": "STU001"})
check("patch to existing student_id -> 409", status == 409, payload)
status, payload = call("DELETE", f"/api/students/{new_student['id']}", token=admin)
check("delete student -> 204", status == 204, payload)

# direct assign of a roster student with NO login account (Sarah / S123213)
status, payload = call("GET", "/api/students?q=Smith", token=admin)
sarah = payload["data"][0]
spot = available_ids(admin, lot4["id"], 1)[0]
status, payload = call("POST", f"/api/students/{sarah['id']}/assign", token=admin, body={"spaceId": spot})
check("assign roster-only student -> 200, space holds student name",
      status == 200 and payload["data"]["assigned_student_id"] == "S123213"
      and payload["data"]["assigned_user_name"] == "Sarah Smith", payload)
status, payload = call("GET", "/api/students?q=Smith", token=admin)
check("roster: Sarah now valid", payload["data"][0]["parking_status"] == "valid", payload)

# CSV import upsert (STU777 added, STU001 updated)
csv_bytes = b"First,Last,studentId,email,grade\nJohn,Doe,STU777,john@x,10\nAlice,Anderson,STU001,alice2@x,12\n,Bad,\n"
status, payload = call_multipart("/api/students/import", admin, "file", "roster.csv", csv_bytes, "text/csv")
check("CSV import -> 1 added, 1 updated, 1 error",
      status == 200 and payload["data"]["added"] == 1 and payload["data"]["updated"] == 1
      and len(payload["data"]["errors"]) == 1, payload)

# ---- map upload ------------------------------------------------------------
print("\nmap upload")
png = b"\x89PNG\r\n\x1a\n" + b"0" * 32
status, payload = call_multipart(f"/api/lots/{lot4['id']}/map", admin, "file", "map.png", png, "image/png")
check("upload map -> 200 w/ static url",
      status == 200 and "/static/uploads/" in (payload["data"]["map_image_url"] or ""), payload)
status, payload = call_multipart(f"/api/lots/{lot4['id']}/map", admin, "file", "bad.txt", b"nope", "text/plain")
check("upload non-image -> 400", status == 400, payload)

# ---- summary ---------------------------------------------------------------
print(f"\n== {passed} passed, {failed} failed ==")
sys.exit(1 if failed else 0)
