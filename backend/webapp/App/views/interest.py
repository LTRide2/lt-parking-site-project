# webapp/App/views/interest.py
from flask import Blueprint, request, jsonify, g

from ..db import query, query_one, get_db
from ..auth import require_role
from .. import serialize

bp = Blueprint("interest", __name__)


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _interest(interest_id):
    row = query_one(serialize.INTEREST_SELECT + " WHERE i.id = %s", (interest_id,))
    return serialize.interest(row) if row else None


def _coerce_ids(raw):
    """Turn an incoming spaceIds value into a list of ints, dropping non-numbers."""
    if not isinstance(raw, list):
        return []
    ids = []
    for value in raw:
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            ids.append(value)
        elif isinstance(value, str) and value.strip().lstrip("-").isdigit():
            ids.append(int(value))
    return ids


@bp.post("/api/interest")
@require_role("student")
def create_interest():
    body = request.get_json(silent=True) or {}
    lot_id = body.get("lotId")
    if not isinstance(lot_id, int) or query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("bad_request", "Unknown lot", 400)

    requested_ids = _coerce_ids(body.get("spaceIds"))
    if len(requested_ids) == 0:
        return _err("bad_request", "Pick an available spot", 400)
    if len(requested_ids) > 1:
        return _err("bad_request", "Only one spot can be requested", 400)
    available = query(
        "SELECT id FROM spaces WHERE lot_id = %s AND status = 'available' AND id = ANY(%s)",
        (lot_id, requested_ids))
    if len(available) != len(requested_ids):
        return _err("conflict", "The chosen spot is no longer available", 409)

    # One active request per student: an assigned student (fulfilled request)
    # cannot open a second request while still holding a spot.
    if query_one("SELECT id FROM interest WHERE user_id = %s AND status = 'fulfilled'", (g.user["id"],)):
        return _err("conflict", "You already have a parking spot assigned", 409)

    existing = query_one(
        "SELECT id FROM interest WHERE user_id = %s AND status = 'pending'", (g.user["id"],))
    connection = get_db()
    try:
        with connection.cursor() as cursor:
            if existing:
                cursor.execute(
                    "UPDATE interest SET lot_id = %s, space_ids = %s, created_at = now() "
                    "WHERE id = %s RETURNING id",
                    (lot_id, requested_ids, existing["id"]))
                status_code = 200
            else:
                cursor.execute(
                    "INSERT INTO interest (user_id, lot_id, space_ids, status) "
                    "VALUES (%s, %s, %s, 'pending') RETURNING id",
                    (g.user["id"], lot_id, requested_ids))
                status_code = 201
            interest_id = cursor.fetchone()["id"]
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return jsonify({"data": _interest(interest_id)}), status_code


@bp.get("/api/interest/me")
@require_role("student")
def my_interest():
    row = query_one(
        serialize.INTEREST_SELECT + " WHERE i.user_id = %s AND i.status <> 'cancelled' "
        "ORDER BY i.id DESC LIMIT 1", (g.user["id"],))
    return jsonify({"data": serialize.interest(row) if row else None})


@bp.delete("/api/interest/me")
@require_role("student")
def withdraw_interest():
    connection = get_db()
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE interest SET status = 'cancelled' "
            "WHERE user_id = %s AND status = 'pending'", (g.user["id"],))
    connection.commit()
    return "", 204


@bp.get("/api/interest")
@require_role("admin")
def list_interest():
    status = request.args.get("status")
    sql = serialize.INTEREST_SELECT
    params = ()
    if status:
        sql += " WHERE i.status = %s"
        params = (status,)
    sql += " ORDER BY i.created_at ASC, i.id ASC"
    rows = query(sql, params)
    return jsonify({"data": [serialize.interest(row) for row in rows]})
