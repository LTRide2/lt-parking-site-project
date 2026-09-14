# webapp/App/views/spaces.py
from flask import Blueprint, request, jsonify

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("spaces", __name__)
ALLOWED = {"available", "disabled"}   # admins toggle these; 'assigned' is set by the assign flow


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _space(space_id):
    row = query_one(serialize.SPACE_SELECT + " WHERE s.id = %s", (space_id,))
    return serialize.space(row) if row else None


@bp.patch("/api/spaces/<int:space_id>")
@require_role("admin")
def update_space(space_id):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ALLOWED:
        return _err("bad_request", "status must be 'available' or 'disabled'", 400)

    space = query_one("SELECT id, status FROM spaces WHERE id = %s", (space_id,))
    if space is None:
        return _err("not_found", "Space not found", 404)
    if space["status"] == "assigned":
        return _err("conflict", "Space is assigned; unassign it first", 409)

    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("UPDATE spaces SET status = %s WHERE id = %s", (status, space_id))
    connection.commit()
    return jsonify({"data": _space(space_id)})


@bp.patch("/api/spaces")
@require_role("admin")
def bulk_update_spaces():
    body = request.get_json(silent=True) or {}
    ids, status = body.get("ids"), body.get("status")
    if not isinstance(ids, list) or status not in ALLOWED:
        return _err("bad_request", "ids (array) and status (available|disabled) required", 400)

    targets = query("SELECT id, status FROM spaces WHERE id = ANY(%s)", (ids,))
    if any(row["status"] == "assigned" for row in targets):
        return _err("conflict", "cannot change an assigned space", 409)

    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute("UPDATE spaces SET status = %s WHERE id = ANY(%s)", (status, ids))
    connection.commit()

    rows = query(serialize.SPACE_SELECT + " WHERE s.id = ANY(%s) ORDER BY s.id", (ids,))
    return jsonify({"data": [serialize.space(row) for row in rows]})
