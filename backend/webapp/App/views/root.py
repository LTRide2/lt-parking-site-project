"""
root of react app.

URLs include:
/root/
"""
import flask
import App


@App.app.route('/root/')
def show_root():
    """Display / root for react application."""
        # Connect to database

    context = {}
    return flask.render_template("root.html", **context)
