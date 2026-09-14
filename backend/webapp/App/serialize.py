"""Turn database rows into the exact JSON shapes the frontend slices consume.

The frontend contract is snake_case for response fields (see the store slices in
the SPA repo). Each function takes a row dict whose keys are the SQL column names
and returns the API dict. Keeping these here avoids drift across the view modules.
"""

# Shared SELECTs so every view reads a space/interest the same way. Callers append
# their own WHERE/ORDER BY and pass the rows straight to space()/interest().
SPACE_SELECT = """
    SELECT s.id, s.lot_id, s.label, s.status,
           s.assigned_user_id, s.assigned_student_id,
           s.pos_x, s.pos_y, s.pos_w, s.pos_h, s.rotation,
           COALESCE(u.name, st.first || ' ' || st.last) AS assigned_user_name
    FROM spaces s
    LEFT JOIN users u ON u.id = s.assigned_user_id
    LEFT JOIN students st ON st.student_id = s.assigned_student_id
"""

INTEREST_SELECT = """
    SELECT i.id, i.user_id, u.name AS user_name, i.lot_id, l.name AS lot_name,
           i.space_ids, i.status, i.created_at,
           ARRAY(SELECT sp.label FROM spaces sp WHERE sp.id = ANY(i.space_ids)) AS space_labels
    FROM interest i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN lots l ON l.id = i.lot_id
"""


def public_user(row):
    """The safe, public view of a user (never exposes password_hash)."""
    return {
        "id": row["id"],
        "role": row["role"],
        "name": row["name"],
        "email": row.get("email"),
    }


def lot(row):
    """A lot with its live capacity/availability counts."""
    return {
        "id": row["id"],
        "name": row["name"],
        "number": row["number"],
        "display_order": row["display_order"],
        "map_image_url": row["map_image_url"],
        "capacity": row["capacity"],
        "available_count": row["available_count"],
    }


def space(row):
    """A parking space; positions/size are normalized fractions (NULL if unset)."""
    return {
        "id": row["id"],
        "lot_id": row["lot_id"],
        "label": row["label"],
        "status": row["status"],
        "x": row["pos_x"],
        "y": row["pos_y"],
        "w": row["pos_w"],
        "h": row["pos_h"],
        "rotation": row["rotation"],
        "assigned_user_id": row["assigned_user_id"],
        "assigned_user_name": row.get("assigned_user_name"),
        "assigned_student_id": row["assigned_student_id"],
    }


def interest(row):
    """A student's request, including their preferred spot ids and labels."""
    created_at = row["created_at"]
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "user_name": row.get("user_name"),
        "lot_id": row["lot_id"],
        "lot_name": row.get("lot_name"),
        "space_ids": row["space_ids"] or [],
        "space_labels": row.get("space_labels") or [],
        "status": row["status"],
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


def student(row):
    """A roster student (business key is student_id, not id)."""
    return {
        "id": row["id"],
        "first": row["first"],
        "last": row["last"],
        "student_id": row["student_id"],
        "email": row["email"],
        "grade": row["grade"],
        "assigned_slot": row["assigned_slot"],
        "parking_status": row["parking_status"],
    }
