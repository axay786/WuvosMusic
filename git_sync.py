import os
import re
import json
import subprocess
import urllib.request
import urllib.parse

import hashlib

CONFIG_FILE = "git_config.json"
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.opus', '.mp4', '.m4v', '.webm', '.mka', '.3gp'}

GLASS_PALETTES = [
    ["#471396", "#B13BFF"],
    ["#B13BFF", "#FFCC00"],
    ["#090040", "#471396"],
    ["#4C3BCF", "#3DC2EC"],
    ["#4B70F5", "#B13BFF"]
]

def get_gradient_for_title(title):
    hash_val = sum(ord(c) for c in title)
    palette = GLASS_PALETTES[hash_val % len(GLASS_PALETTES)]
    return f"linear-gradient(135deg, {palette[0]} 0%, {palette[1]} 100%)"


class GitSyncManager:
    def __init__(self, base_dir="songs"):
        self.base_dir = os.path.abspath(base_dir)
        self.config_path = os.path.abspath(CONFIG_FILE)
        self.config = self.load_config()

    def load_config(self):
        default_config = {
            "repo_url": "",
            "branch": "main",
            "token": "",
            "auto_sync_on_start": True,
            "last_sync": "Never"
        }
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    default_config.update(data)
            except Exception as e:
                print(f"Error loading git config: {e}")
        return default_config

    def save_config(self, new_config):
        self.config.update(new_config)
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving git config: {e}")
            return False

    def sync(self):
        """
        Attempts sync via Git CLI if possible, or falls back to GitHub API / Raw web fetch.
        """
        self.config = self.load_config()
        repo_url = self.config.get("repo_url", "").strip()
        if not repo_url or "your-username" in repo_url:
            return {
                "success": False,
                "message": "No valid Git repository URL configured in git_config.json."
            }

        logs = []
        git_dir = os.path.join(self.base_dir, ".git")

        try:
            if os.path.exists(git_dir):
                cmd = ["git", "pull", "origin", self.config.get("branch", "main")]
                proc = subprocess.run(cmd, cwd=self.base_dir, capture_output=True, text=True, timeout=30)
                if proc.returncode == 0:
                    logs.append("Successfully pulled latest changes from Git repository via CLI.")
                    return {"success": True, "message": "Git pull completed successfully!", "details": proc.stdout}
                else:
                    logs.append(f"Git CLI pull warning: {proc.stderr}")
        except Exception as e:
            logs.append(f"Git CLI unavailable: {str(e)}")

        return self._sync_github_api(repo_url, logs)

    def _sync_github_api(self, repo_url, initial_logs):
        logs = list(initial_logs)
        match = re_match_github(repo_url)
        if not match:
            return {
                "success": False,
                "message": f"Could not parse GitHub repo owner and name from URL: {repo_url}",
                "logs": logs
            }

        owner, repo = match
        branch = self.config.get("branch", "main")
        token = self.config.get("token", "").strip()

        api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        headers = {"User-Agent": "Wuvos-Glassy-Music-Player"}
        if token:
            if token.startswith("ghp_") or token.startswith("github_pat_"):
                headers["Authorization"] = f"Bearer {token}"
            else:
                headers["Authorization"] = f"token {token}"

        try:
            resp = self._fetch_url(api_url, headers)
            data = json.loads(resp.read().decode('utf-8'))
            resp.close()
            tree = data.get("tree", [])
            
            remote_songs = []
            for item in tree:
                path = item.get("path", "")
                if item.get("type") == "blob":
                    ext = os.path.splitext(path)[1].lower()
                    if ext in AUDIO_EXTENSIONS:
                        quoted_path = urllib.parse.quote(path, safe='/')
                        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{quoted_path}"
                        
                        parts = path.split('/')
                        lang_raw = parts[0] if len(parts) > 1 else "Uncategorized"
                        language = lang_raw.title()
                        quality_raw = parts[1] if len(parts) > 2 else "normal"
                        is_lossless = quality_raw.lower() in ['flac', 'flack', 'lossless', 'hd'] or ext == '.flac'
                        quality_label = "24-BIT FLAC" if is_lossless else "HQ Audio"
                        filename = parts[-1]
                        clean_name = os.path.splitext(filename)[0]
                        title_formatted = clean_name.replace('_', ' ').replace('-', ' ').strip().title()
                        folder_path = '/'.join(parts[:-1]) if len(parts) > 1 else "Root"
                        
                        file_size = item.get("size", 1024 * 1024)
                        est_duration = max(15, int(file_size / 32000))
                        song_id = hashlib.md5(path.encode('utf-8')).hexdigest()[:12]

                        song_item = {
                            "id": song_id,
                            "sha": item.get("sha", ""),
                            "title": title_formatted,
                            "filename": filename,
                            "rel_path": path,
                            "folder": folder_path,
                            "language": language,
                            "quality_raw": quality_raw.lower(),
                            "quality_label": quality_label,
                            "is_lossless": is_lossless,
                            "artist": f"{language} Collection",
                            "album": f"{folder_path} - {quality_raw.upper()}" if folder_path != "Root" else f"{language} - {quality_raw.upper()}",
                            "duration": est_duration,
                            "format": ext[1:].upper(),
                            "file_size": file_size,
                            "gradient": get_gradient_for_title(title_formatted),
                            "stream_url": f"/api/stream/{quoted_path}",
                            "raw_url": raw_url
                        }
                        remote_songs.append(song_item)

            # Cache remote songs list to disk
            cache_file = os.path.join(self.base_dir, "remote_cache.json")
            try:
                os.makedirs(self.base_dir, exist_ok=True)
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(remote_songs, f, indent=2)
            except Exception as ce:
                logs.append(f"Cache write notice: {ce}")

            return {
                "success": True,
                "message": f"Successfully synced {len(remote_songs)} songs from Git repository ({owner}/{repo})!",
                "synced_count": len(remote_songs),
                "remote_songs": remote_songs,
                "logs": logs
            }
        except Exception as e:
            err_msg = str(e)
            logs.append(f"HTTP Sync Error: {err_msg}")
            cached_songs = self.get_cached_remote_songs()
            if cached_songs and ("403" in err_msg or "rate limit" in err_msg.lower()):
                return {
                    "success": True,
                    "message": f"GitHub API rate limit reached (60 req/hr). Displaying {len(cached_songs)} cached songs.",
                    "synced_count": len(cached_songs),
                    "remote_songs": cached_songs,
                    "rate_limited": True,
                    "logs": logs
                }
            return {
                "success": False,
                "message": f"GitHub API Sync Notice: {err_msg}. Add a free GitHub token in git_config.json to increase rate limits.",
                "rate_limited": "403" in err_msg or "rate limit" in err_msg.lower(),
                "logs": logs
            }

    def get_cached_remote_songs(self):
        cache_file = os.path.join(self.base_dir, "remote_cache.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _fetch_url(self, url, headers):
        req = urllib.request.Request(url, headers=headers)
        try:
            return urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e:
            if e.code in [401, 403] and "Authorization" in headers:
                clean_headers = {k: v for k, v in headers.items() if k != "Authorization"}
                req_clean = urllib.request.Request(url, headers=clean_headers)
                return urllib.request.urlopen(req_clean, timeout=30)
            raise e

def re_match_github(url):
    m = re.search(r"github\.com/([^/]+)/([^/.]+)", url)
    if m:
        repo_name = m.group(2)
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]
        return m.group(1), repo_name
    return None
