"""
index (main) view.

URLs include:
/
"""
import flask
import App


@App.app.route('/')
def show_index():
    """Display / route."""
        # Connect to database
    connection = App.model.get_db()

    # Query database
    logname = "John Doe"
    cur = connection.execute(
        "SELECT  fullname, email "
        "FROM developer "
        "WHERE fullname != ?",
        (logname, )
    )
    devs = cur.fetchall()

    context = {"devs": devs}
    return flask.render_template("index.html", **context)
