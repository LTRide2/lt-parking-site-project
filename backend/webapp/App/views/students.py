# webapp/App/views/students.py
import csv
import io

from flask import Blueprint, request, jsonify, g

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("students", __name__)

VALID_PARKING = {"unassigned", "valid", "expired", "suspended"}


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _student_by_id(student_pk):
    return query_one("SELECT * FROM students WHERE id = %s", (student_pk,))


@bp.get("/api/students")
@require_role("admin")
def list_students():
    term = (request.args.get("q") or "").strip().lower()
    if term:
        pattern = f"%{term}%"
        rows = query(
            "SELECT * FROM students "
            "WHERE lower(first || ' ' || last) LIKE %s OR lower(student_id) LIKE %s "
            "ORDER BY lower(last), lower(first)", (pattern, pattern))
    else:
        rows = query("SELECT * FROM students ORDER BY lower(last), lower(first)")
    return jsonify({"data": [serialize.student(row) for row in rows]})


@bp.post("/api/students")
@require_role("admin")
def create_student():
    body = request.get_json(silent=True) or {}
    first = (body.get("first") or "").strip()
    last = (body.get("last") or "").strip()
    student_id = (body.get("student_id") or "").strip()
    if not first or not last or not student_id:
        return _err("bad_request", "first, last and student_id are required", 400)
    if query_one("SELECT id FROM students WHERE lower(student_id) = lower(%s)", (student_id,)):
        return _err("conflict", f"Student id {student_id} already exists", 409)

    row = query_one(
        "INSERT INTO students (first, last, student_id, email, grade) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (first, last, student_id, (body.get("email") or "").strip(), (body.get("grade") or "").strip()))
    get_db().commit()
    return jsonify({"data": serialize.student(row)}), 201


@bp.patch("/api/students/<int:student_pk>")
@require_role("admin")
def update_student(student_pk):
    student = _student_by_id(student_pk)
    if student is None:
        return _err("not_found", "Student not found", 404)

    body = request.get_json(silent=True) or {}
    updates = {}
    if body.get("student_id") is not None:
        next_student_id = str(body["student_id"]).strip()
        if not next_student_id:
            return _err("bad_request", "student_id cannot be blank", 400)
        clash = query_one(
            "SELECT id FROM students WHERE id <> %s AND lower(student_id) = lower(%s)",
            (student_pk, next_student_id))
        if clash:
            return _err("conflict", f"Student id {next_student_id} already exists", 409)
        updates["student_id"] = next_student_id
    for field in ("first", "last", "email", "grade"):
        if body.get(field) is not None:
            updates[field] = str(body[field]).strip()
    if body.get("parking_status") is not None and body["parking_status"] in VALID_PARKING:
        updates["parking_status"] = body["parking_status"]

    if updates:
        columns = ", ".join(f"{name} = %s" for name in updates)
        values = list(updates.values()) + [student_pk]
        connection = get_db()
        with connection.cursor() as cursor:
            cursor.execute(f"UPDATE students SET {columns} WHERE id = %s", values)
        connection.commit()
    return jsonify({"data": serialize.student(_student_by_id(student_pk))})


@bp.delete("/api/students/<int:student_pk>")
@require_role("admin")
def delete_student(student_pk):
    if _student_by_id(student_pk) is None:
        return _err("not_found", "Student not found", 404)
    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM students WHERE id = %s", (student_pk,))
    connection.commit()
    return "", 204


@bp.post("/api/students/<int:student_pk>/assign")
@require_role("admin")
def assign_student(student_pk):
    student = _student_by_id(student_pk)
    if student is None:
        return _err("not_found", "Student not found", 404)
    body = request.get_json(silent=True) or {}
    space_id = body.get("spaceId")
    if not isinstance(space_id, int):
        return _err("bad_request", "spaceId (integer) is required", 400)
    space = query_one("SELECT id, lot_id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if space["status"] != "available":
        return _err("conflict", "Space is not available", 409)

    student_code = student["student_id"]
    login = query_one("SELECT id FROM users WHERE code = %s", (student_code,))
    login_id = login["id"] if login else None
    held = query(
        "SELECT id, lot_id FROM spaces "
        "WHERE status='assigned' AND (assigned_student_id=%s OR assigned_user_id=%s)",
        (student_code, login_id))

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Free any spot the student already holds, so this becomes a MOVE.
            for previous in held:
                cursor.execute(
                    "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (previous["id"],))
                cursor.execute(
                    "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                    "assigned_student_id=NULL WHERE id=%s", (previous["id"],))
                if login_id is not None:
                    cursor.execute(
                        "UPDATE interest SET status='pending' "
                        "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                        (login_id, previous["lot_id"]))
            # Assign the new space to the roster student (and login user if any).
            cursor.execute(
                "UPDATE spaces SET status='assigned', assigned_student_id=%s, assigned_user_id=%s "
                "WHERE id=%s", (student_code, login_id, space_id))
            if login_id is not None:
                cursor.execute(
                    "INSERT INTO assignments (space_id, user_id, assigned_by, active) "
                    "VALUES (%s, %s, %s, TRUE)", (space_id, login_id, g.user["id"]))
                cursor.execute(
                    "UPDATE interest SET lot_id=%s, status='fulfilled' "
                    "WHERE user_id=%s AND status='pending'", (space["lot_id"], login_id))
            cursor.execute("SELECT name FROM lots WHERE id=%s", (space["lot_id"],))
            lot_row = cursor.fetchone()
            cursor.execute("SELECT label FROM spaces WHERE id=%s", (space_id,))
            label = cursor.fetchone()["label"]
            lot_name = lot_row["name"] if lot_row else f"Lot {space['lot_id']}"
            cursor.execute(
                "UPDATE students SET assigned_slot=%s, parking_status='valid' WHERE id=%s",
                (f"{lot_name} · {label}", student_pk))
        connection.commit()
    except Exception:
        connection.rollback()
        raise

    row = query_one(serialize.SPACE_SELECT + " WHERE s.id = %s", (space_id,))
    return jsonify({"data": serialize.space(row)})


@bp.post("/api/students/import")
@require_role("admin")
def import_students():
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return _err("bad_request", "a CSV file is required", 400)
    text = uploaded.read().decode("utf-8-sig", errors="replace")
    rows = [row for row in csv.reader(io.StringIO(text)) if any(cell.strip() for cell in row)]
    if not rows:
        return _err("bad_request", "The CSV file is empty", 400)
    # Skip a header row if the first two columns look like First,Last.
    if len(rows[0]) >= 2 and rows[0][0].strip().lower() == "first" and rows[0][1].strip().lower() == "last":
        rows = rows[1:]

    added = 0
    updated = 0
    errors = []
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            for index, cells in enumerate(rows):
                first = cells[0].strip() if len(cells) > 0 else ""
                last = cells[1].strip() if len(cells) > 1 else ""
                student_id = cells[2].strip() if len(cells) > 2 else ""
                email = cells[3].strip() if len(cells) > 3 else ""
                grade = cells[4].strip() if len(cells) > 4 else ""
                if not first or not last or not student_id:
                    errors.append(f"Row {index + 1}: need First, Last and studentId")
                    continue
                cursor.execute(
                    "SELECT id FROM students WHERE lower(student_id) = lower(%s)", (student_id,))
                existing = cursor.fetchone()
                if existing:
                    cursor.execute(
                        "UPDATE students SET first=%s, last=%s, email=%s, grade=%s WHERE id=%s",
                        (first, last, email, grade, existing["id"]))
                    updated += 1
                else:
                    cursor.execute(
                        "INSERT INTO students (first, last, student_id, email, grade) "
                        "VALUES (%s, %s, %s, %s, %s)", (first, last, student_id, email, grade))
                    added += 1
                # Provision the student's (non-admin) login account so an imported
                # student can sign in with their student_id as their code. The
                # users row holds only login identity (role, code, name); all
                # student metadata lives in the students table. Upsert by code so
                # re-importing the same student never duplicates the login.
                cursor.execute(
                    "INSERT INTO users (role, code, name) "
                    "VALUES ('student', %s, %s) "
                    "ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name",
                    (student_id, f"{first} {last}"))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": {"added": added, "updated": updated, "errors": errors}})
