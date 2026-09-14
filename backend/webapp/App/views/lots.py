# webapp/App/views/lots.py
import os

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from ..db import query, query_one, execute, get_db
from ..auth import require_auth, require_role
from .. import serialize

bp = Blueprint("lots", __name__)

# Default slot size as a fraction of the map, for spots saved without a size.
DEFAULT_SPOT_W = 0.05
DEFAULT_SPOT_H = 0.03


def _err(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _is_frac(value):
    return isinstance(value, (int, float)) and 0 <= value <= 1


def _lot_spaces(lot_id):
    """Every space in a lot, serialized, ordered by id."""
    rows = query(serialize.SPACE_SELECT + " WHERE s.lot_id = %s ORDER BY s.id", (lot_id,))
    return [serialize.space(row) for row in rows]


# ---- read lots & spaces ----------------------------------------------------

@bp.get("/api/lots")
@require_auth
def list_lots():
    rows = query("""
        SELECT l.id, l.name, l.number, l.display_order, l.map_image_url,
               count(s.id)                                     AS capacity,
               count(s.id) FILTER (WHERE s.status='available') AS available_count
        FROM lots l
        LEFT JOIN spaces s ON s.lot_id = l.id
        GROUP BY l.id
        ORDER BY l.display_order, l.id
    """)
    return jsonify({"data": [serialize.lot(row) for row in rows]})


@bp.get("/api/lots/<int:lot_id>/spaces")
@require_auth
def lot_spaces(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)
    return jsonify({"data": _lot_spaces(lot_id)})


# ---- save lot layout (spot positions + sizes) ------------------------------

@bp.put("/api/lots/<int:lot_id>/layout")
@require_role("admin")
def save_layout(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)

    body = request.get_json(silent=True) or {}
    incoming = body.get("spaces")
    if not isinstance(incoming, list):
        return _err("bad_request", "spaces (array) is required", 400)

    # Validate every entry BEFORE opening the transaction (fail fast).
    clean = []
    for entry in incoming:
        label = entry.get("label")
        x, y, rotation = entry.get("x"), entry.get("y"), entry.get("rotation")
        w, h = entry.get("w"), entry.get("h")
        if not isinstance(label, str) or not label.strip():
            return _err("bad_request", "each space needs a non-empty label", 400)
        if not _is_frac(x) or not _is_frac(y):
            return _err("bad_request", "x and y must be numbers in 0..1", 400)
        clean.append({
            "id": entry.get("id"),
            "label": label.strip(),
            "x": float(x), "y": float(y),
            "w": float(w) if _is_frac(w) else DEFAULT_SPOT_W,
            "h": float(h) if _is_frac(h) else DEFAULT_SPOT_H,
            "rotation": float(rotation) if isinstance(rotation, (int, float)) else 0.0,
        })

    keep_ids = {c["id"] for c in clean if isinstance(c["id"], int)}
    existing = query("SELECT id, status FROM spaces WHERE lot_id = %s", (lot_id,))
    to_delete = [row["id"] for row in existing if row["id"] not in keep_ids]
    blocked = [row["id"] for row in existing
               if row["id"] in to_delete and row["status"] == "assigned"]
    if blocked:
        return _err("conflict", f"cannot delete assigned space(s): {blocked}", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            for c in clean:
                if isinstance(c["id"], int):
                    cursor.execute(
                        "UPDATE spaces SET label=%s, pos_x=%s, pos_y=%s, pos_w=%s, "
                        "pos_h=%s, rotation=%s WHERE id=%s AND lot_id=%s",
                        (c["label"], c["x"], c["y"], c["w"], c["h"], c["rotation"],
                         c["id"], lot_id))
                else:
                    cursor.execute(
                        "INSERT INTO spaces (lot_id, label, pos_x, pos_y, pos_w, pos_h, rotation) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                        (lot_id, c["label"], c["x"], c["y"], c["w"], c["h"], c["rotation"]))
            if to_delete:
                cursor.execute("DELETE FROM spaces WHERE id = ANY(%s)", (to_delete,))
        connection.commit()
    except Exception:
        connection.rollback()
        raise

    return jsonify({"data": {"lot_id": lot_id, "spaces": _lot_spaces(lot_id)}})


# ---- create a parking lot --------------------------------------------------

@bp.post("/api/lots")
@require_role("admin")
def create_lot():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    number = body.get("number")
    capacity = body.get("capacity")
    display_order = body.get("display_order")
    if not name:
        return _err("bad_request", "name is required", 400)
    if number is not None and (not isinstance(number, int) or number < 0):
        return _err("bad_request", "number must be a non-negative integer", 400)
    if capacity is not None and (not isinstance(capacity, int) or capacity < 0):
        return _err("bad_request", "capacity must be a non-negative integer", 400)
    if query_one("SELECT id FROM lots WHERE lower(name) = lower(%s)", (name,)):
        return _err("conflict", "A lot with that name already exists", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Default display_order to the end, and the lot number to that order.
            cursor.execute("SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM lots")
            next_order = cursor.fetchone()["next"]
            resolved_order = display_order if isinstance(display_order, int) else next_order
            resolved_number = number if isinstance(number, int) else resolved_order
            cursor.execute("SELECT id FROM lots WHERE number = %s", (resolved_number,))
            if cursor.fetchone():
                connection.rollback()
                return _err("conflict", f"Lot number {resolved_number} is already in use", 409)
            cursor.execute(
                "INSERT INTO lots (name, number, display_order) VALUES (%s, %s, %s) "
                "RETURNING id, name, number, display_order, map_image_url",
                (name, resolved_number, resolved_order))
            lot = cursor.fetchone()
            for index in range(1, (capacity or 0) + 1):
                cursor.execute(
                    "INSERT INTO spaces (lot_id, label) VALUES (%s, %s)",
                    (lot["id"], f"{resolved_number}-{index}"))
        connection.commit()
    except Exception:
        connection.rollback()
        raise

    lot["capacity"] = capacity or 0
    lot["available_count"] = capacity or 0
    return jsonify({"data": serialize.lot(lot)}), 201


# ---- delete a parking lot --------------------------------------------------

@bp.delete("/api/lots/<int:lot_id>")
@require_role("admin")
def delete_lot(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)
    assigned = query(
        "SELECT label FROM spaces WHERE lot_id = %s AND status = 'assigned'", (lot_id,))
    if assigned:
        labels = ", ".join(row["label"] for row in assigned)
        return _err("conflict", f"cannot remove a lot with assigned space(s): {labels}", 409)

    connection = get_db()
    try:
        with connection.cursor() as cursor:
            # Drop this lot's interest rows first; spaces (and their assignments)
            # cascade when the lot is deleted.
            cursor.execute("DELETE FROM interest WHERE lot_id = %s", (lot_id,))
            cursor.execute("DELETE FROM lots WHERE id = %s", (lot_id,))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return "", 204


# ---- upload a lot's map image ----------------------------------------------

@bp.post("/api/lots/<int:lot_id>/map")
@require_role("admin")
def upload_map(lot_id):
    if query_one("SELECT id FROM lots WHERE id = %s", (lot_id,)) is None:
        return _err("not_found", "Lot not found", 404)

    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return _err("bad_request", "a file is required", 400)
    if uploaded.mimetype not in ("image/png", "image/jpeg"):
        return _err("bad_request", "Only PNG or JPG images are allowed", 400)

    extension = ".png" if uploaded.mimetype == "image/png" else ".jpg"
    filename = secure_filename(f"lot_{lot_id}{extension}")
    uploads_dir = os.path.join(current_app.static_folder, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    uploaded.save(os.path.join(uploads_dir, filename))

    # Store an absolute URL so the SPA (served from another origin) can load it.
    # Use execute (not query_one) so the UPDATE is committed, not rolled back.
    url = request.host_url.rstrip("/") + "/static/uploads/" + filename
    row = execute(
        "UPDATE lots SET map_image_url = %s WHERE id = %s "
        "RETURNING id, name, number, display_order, map_image_url", (url, lot_id))
    counts = query_one(
        "SELECT count(*) AS capacity, "
        "count(*) FILTER (WHERE status='available') AS available_count "
        "FROM spaces WHERE lot_id = %s", (lot_id,))
    row["capacity"] = counts["capacity"]
    row["available_count"] = counts["available_count"]
    return jsonify({"data": serialize.lot(row)})
