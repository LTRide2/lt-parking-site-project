
"""
index (main) view.

URLS include:
/
"""
import flask
import App

@App.app.route('/')
def index():
    """Display / route"""

    context = {}
    return flask.render_template('index.html', **context)