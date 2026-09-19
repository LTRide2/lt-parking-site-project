# webapp/App/views/assignments.py
import psycopg
from flask import Blueprint, request, jsonify, g

from ..db import query_one, get_db
from ..auth import require_role

bp = Blueprint("assignments", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _resolve_student_id(cursor, student_id, user_id):
    """The roster student behind a space: direct student_id, else the login user's code."""
    if student_id:
        cursor.execute("SELECT student_id FROM students WHERE student_id = %s", (student_id,))
        if cursor.fetchone():
            return student_id
    if user_id is not None:
        cursor.execute("SELECT code FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        if row and row["code"]:
            cursor.execute("SELECT student_id FROM students WHERE student_id = %s", (row["code"],))
            if cursor.fetchone():
                return row["code"]
    return None


def _set_roster_slot(cursor, student_id, user_id, slot_text):
    """Point a roster student at a slot (valid) or clear it (unassigned)."""
    resolved = _resolve_student_id(cursor, student_id, user_id)
    if resolved is None:
        return
    parking_status = "valid" if slot_text else "unassigned"
    cursor.execute(
        "UPDATE students SET assigned_slot = %s, parking_status = %s WHERE student_id = %s",
        (slot_text, parking_status, resolved))


@bp.post("/api/assignments")
@require_role("admin")
def create_assignment():
    body = request.get_json(silent=True) or {}
    space_id, user_id = body.get("spaceId"), body.get("userId")
    interest_id = body.get("interestId")
    if not isinstance(space_id, int) or not isinstance(user_id, int):
        return _err("bad_request", "spaceId and userId (integers) are required", 400)

    space = query_one("SELECT id, lot_id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    user = query_one("SELECT id, code FROM users WHERE id = %s", (user_id,))
    if user is None:
        return _err("not_found", "User not found", 404)
    if space["status"] != "available":
        return _err("conflict", f"Space is {space['status']}, not assignable", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO assignments (space_id, user_id, assigned_by, active) "
                "VALUES (%s, %s, %s, TRUE)", (space_id, user_id, g.user["id"]))
            cursor.execute(
                "UPDATE spaces SET status='assigned', assigned_user_id=%s, "
                "assigned_student_id=%s WHERE id=%s",
                (user_id, user["code"], space_id))
            if isinstance(interest_id, int):
                cursor.execute("UPDATE interest SET status='fulfilled' WHERE id=%s", (interest_id,))
            else:
                cursor.execute(
                    "UPDATE interest SET status='fulfilled' "
                    "WHERE user_id=%s AND status='pending'", (user_id,))
            cursor.execute("SELECT name FROM lots WHERE id = %s", (space["lot_id"],))
            lot_row = cursor.fetchone()
            lot_name = lot_row["name"] if lot_row else f"Lot {space['lot_id']}"
            slot_text = f"{lot_name} · {_label(cursor, space_id)}"
            _set_roster_slot(cursor, user["code"], user_id, slot_text)
        connection.commit()
    except psycopg.errors.UniqueViolation:
        connection.rollback()
        return _err("conflict", "Space already has an active assignment", 409)
    except Exception:
        connection.rollback()
        raise

    return jsonify({"data": {"space_id": space_id, "user_id": user_id,
                             "interest_id": interest_id if isinstance(interest_id, int) else None}}), 201


@bp.post("/api/assignments/move")
@require_role("admin")
def move_assignment():
    body = request.get_json(silent=True) or {}
    from_space_id, to_lot_id = body.get("fromSpaceId"), body.get("toLotId")
    if not isinstance(from_space_id, int) or not isinstance(to_lot_id, int):
        return _err("bad_request", "fromSpaceId and toLotId (integers) are required", 400)

    space = query_one(
        "SELECT id, lot_id, status, assigned_user_id, assigned_student_id FROM spaces WHERE id = %s",
        (from_space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if query_one("SELECT id FROM lots WHERE id = %s", (to_lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)
    if space["status"] != "assigned":
        return _err("conflict", "Source space is not assigned", 409)

    freed_user_id = space["assigned_user_id"]
    freed_student_id = space["assigned_student_id"]
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (from_space_id,))
            cursor.execute(
                "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                "assigned_student_id=NULL WHERE id=%s", (from_space_id,))
            _set_roster_slot(cursor, freed_student_id, freed_user_id, None)
            # Re-queue the occupant's request as PENDING in the new lot (admin
            # then picks a spot there). Open a fresh request if they had none.
            if freed_user_id is not None:
                cursor.execute(
                    "UPDATE interest SET lot_id=%s, space_ids='{}', status='pending' "
                    "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                    (to_lot_id, freed_user_id, space["lot_id"]))
                if cursor.rowcount == 0:
                    cursor.execute(
                        "INSERT INTO interest (user_id, lot_id, space_ids, status) "
                        "VALUES (%s, %s, '{}', 'pending') "
                        "ON CONFLICT DO NOTHING", (freed_user_id, to_lot_id))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": {"from_space_id": from_space_id, "to_lot_id": to_lot_id}})


@bp.delete("/api/assignments/<int:space_id>")
@require_role("admin")
def delete_assignment(space_id):
    space = query_one(
        "SELECT id, lot_id, status, assigned_user_id, assigned_student_id FROM spaces WHERE id = %s",
        (space_id,))
    if space is None:
        return _err("not_found", "Assignment not found", 404)

    freed_user_id = space["assigned_user_id"]
    freed_student_id = space["assigned_student_id"]
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE assignments SET active=FALSE WHERE space_id=%s AND active", (space_id,))
            cursor.execute(
                "UPDATE spaces SET status='available', assigned_user_id=NULL, "
                "assigned_student_id=NULL WHERE id=%s", (space_id,))
            # Put the student's request back in the pending queue so they can be
            # reassigned, and clear their roster slot. One-active-request-per-
            # student (enforced at registration) guarantees no rival pending row.
            if freed_user_id is not None:
                cursor.execute(
                    "UPDATE interest SET status='pending' "
                    "WHERE user_id=%s AND lot_id=%s AND status='fulfilled'",
                    (freed_user_id, space["lot_id"]))
            _set_roster_slot(cursor, freed_student_id, freed_user_id, None)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return "", 204


def _label(cursor, space_id):
    cursor.execute("SELECT label FROM spaces WHERE id = %s", (space_id,))
    row = cursor.fetchone()
    return row["label"] if row else ""
