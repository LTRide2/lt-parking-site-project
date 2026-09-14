import flask
from flask import send_from_directory
import App

@App.app.route('/uploads/<path:filename>', methods=['GET'])
def download_file(filename):
    """Download a file."""
    return send_from_directory(App.app.config['UPLOAD_FOLDER'],
                               filename, as_attachment=True)

