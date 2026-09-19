# webapp/App/views/health.py
from datetime import datetime, timezone
from flask import Blueprint, jsonify

# A "Blueprint" is a group of related routes. We register it in __init__.py.
bp = Blueprint("health", __name__)


@bp.get("/api/health")
def health():
    now = datetime.now(timezone.utc).isoformat()
    return jsonify({"data": {"status": "ok", "time": now}})
