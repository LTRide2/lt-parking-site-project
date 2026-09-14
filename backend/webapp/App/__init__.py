# webapp/App/__init__.py
from flask import Flask, jsonify
from flask_cors import CORS

from . import config


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.SECRET_KEY

    # Allow the React dev server (and later the real site) to call this API.
    CORS(app, origins=config.CORS_ORIGINS.split(","), supports_credentials=True)

    # Close the DB connection at the end of every request.
    from . import db
    app.teardown_appcontext(db.close_db)

    # Register every blueprint (group of routes).
    from .views import health, auth, lots, spaces, interest, assignments, students
    app.register_blueprint(health.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(lots.bp)
    app.register_blueprint(spaces.bp)
    app.register_blueprint(interest.bp)
    app.register_blueprint(assignments.bp)
    app.register_blueprint(students.bp)

    # Turn any uncaught error into our standard JSON error envelope so the
    # frontend always gets predictable shapes.
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": {"code": "not_found", "message": "Not found"}}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": {"code": "server_error", "message": "Server error"}}), 500

    return app


# Lets `flask run` find the app via FLASK_APP=webapp.App
app = create_app()
