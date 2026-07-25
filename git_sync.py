import os
import re
import json
import subprocess
import urllib.request
import urllib.parse

CONFIG_FILE = "git_config.json"
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.opus', '.mp4', '.m4v', '.webm', '.mka', '.3gp'}


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
            headers["Authorization"] = f"token {token}"

        try:
            resp = self._fetch_url(api_url, headers)
            data = json.loads(resp.read().decode('utf-8'))
            resp.close()
            tree = data.get("tree", [])
            
            downloaded_count = 0
            synced_rel_paths = set()

            for item in tree:
                path = item.get("path", "")
                if item.get("type") == "blob":
                    ext = os.path.splitext(path)[1].lower()
                    if ext in AUDIO_EXTENSIONS:
                        synced_rel_paths.add(os.path.normpath(path).lower())
                        
                        quoted_path = urllib.parse.quote(path)
                        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{quoted_path}"
                        
                        dest_path = os.path.join(self.base_dir, path)
                        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                        
                        r_raw = self._fetch_url(raw_url, headers)
                        with open(dest_path, "wb") as f_out:
                            f_out.write(r_raw.read())
                        r_raw.close()
                        
                        downloaded_count += 1

            # Clean up local files in songs/ that are no longer present in Git repo
            for root, _, files in os.walk(self.base_dir):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in AUDIO_EXTENSIONS:
                        full_p = os.path.join(root, f)
                        rel_p = os.path.relpath(full_p, self.base_dir)
                        if os.path.normpath(rel_p).lower() not in synced_rel_paths:
                            try:
                                os.remove(full_p)
                            except Exception:
                                pass

            return {
                "success": True,
                "message": f"Successfully synced {downloaded_count} songs from Git repository ({owner}/{repo})!",
                "synced_count": downloaded_count,
                "logs": logs
            }
        except Exception as e:
            logs.append(f"HTTP Sync Error: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to sync repository: {str(e)}",
                "logs": logs
            }

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
