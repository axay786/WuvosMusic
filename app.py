import os
import re
import json
from flask import Flask, render_template, jsonify, request, send_file, Response
from music_scanner import MusicScanner
from git_sync import GitSyncManager

app = Flask(__name__, static_folder="static", template_folder="templates")

scanner = MusicScanner(base_dir="songs")
git_manager = GitSyncManager(base_dir="songs")

# Auto-sync on startup if enabled in git_config.json
try:
    if git_manager.config.get("auto_sync_on_start", True):
        print("Auto-syncing music from Git repository...")
        git_manager.sync()
except Exception as e:
    print(f"Auto sync notice: {e}")

PLAYLISTS_FILE = "playlists.json"

def load_playlists():
    if os.path.exists(PLAYLISTS_FILE):
        try:
            with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return [
        {"id": "favs", "name": "Liked Songs", "song_ids": []},
        {"id": "flac_favs", "name": "High Res FLACs", "song_ids": []}
    ]

def save_playlists(playlists):
    try:
        with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
            json.dump(playlists, f, indent=2)
    except Exception as e:
        print(f"Error saving playlists: {e}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/songs", methods=["GET"])
def get_songs():
    songs = scanner.scan()
    
    # Query parameters
    lang = request.args.get("lang")
    quality = request.args.get("quality")
    query = request.args.get("q")

    if lang:
        songs = [s for s in songs if s["language"].lower() == lang.lower()]
    if quality:
        if quality.lower() == "flac":
            songs = [s for s in songs if s["is_lossless"]]
        elif quality.lower() == "normal":
            songs = [s for s in songs if not s["is_lossless"]]
    if query:
        q = query.lower()
        songs = [s for s in songs if q in s["title"].lower() or q in s["artist"].lower() or q in s["rel_path"].lower()]

    return jsonify({"success": True, "count": len(songs), "songs": songs})

@app.route("/api/folders", methods=["GET"])
def get_folders():
    tree = scanner.get_folder_tree()
    return jsonify({"success": True, "tree": tree})

@app.route("/api/playlists", methods=["GET", "POST"])
def manage_playlists():
    if request.method == "POST":
        data = request.json or []
        save_playlists(data)
        return jsonify({"success": True, "playlists": data})
    else:
        playlists = load_playlists()
        return jsonify({"success": True, "playlists": playlists})

@app.route("/api/git/sync", methods=["POST", "GET"])
def trigger_git_sync():
    res = git_manager.sync()
    songs = scanner.scan()
    res["song_count"] = len(songs)
    res["songs"] = songs
    return jsonify(res)

@app.route("/api/stream/<path:song_path>")
def stream_audio(song_path):
    """
    Audio streaming endpoint with HTTP Range header (206 Partial Content) support
    for instant seeking and scrubbing.
    """
    full_path = os.path.join(scanner.base_dir, song_path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        return jsonify({"error": "File not found"}), 404

    file_size = os.path.getsize(full_path)
    range_header = request.headers.get('Range', None)
    
    ext = os.path.splitext(full_path)[1].lower()
    mime_types = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac'
    }
    content_type = mime_types.get(ext, 'application/octet-stream')

    if not range_header:
        return send_file(full_path, mimetype=content_type)

    byte1, byte2 = 0, None
    m = re.search(r'bytes=(\d+)-(\d+)?', range_header)
    if m:
        g = m.groups()
        byte1 = int(g[0])
        if g[1]:
            byte2 = int(g[1])

    if byte2 is None:
        byte2 = file_size - 1

    length = byte2 - byte1 + 1

    def generate():
        with open(full_path, 'rb') as f:
            f.seek(byte1)
            remaining = length
            chunk_size = 1024 * 64
            while remaining > 0:
                read_len = min(remaining, chunk_size)
                data = f.read(read_len)
                if not data:
                    break
                remaining -= len(data)
                yield data

    rv = Response(generate(), 206, mimetype=content_type, direct_passthrough=True)
    rv.headers.add('Content-Range', f'bytes {byte1}-{byte2}/{file_size}')
    rv.headers.add('Accept-Ranges', 'bytes')
    rv.headers.add('Content-Length', str(length))
    return rv

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

