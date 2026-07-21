import os
import re
import hashlib
from pathlib import Path

# Supported audio extensions
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.opus'}

# Curated dynamic album cover gradients matching user palette
GLASS_PALETTES = [
    ["#471396", "#B13BFF"],
    ["#B13BFF", "#FFCC00"],
    ["#090040", "#471396"],
    ["#4C3BCF", "#3DC2EC"],
    ["#4B70F5", "#B13BFF"]
]

class MusicScanner:
    def __init__(self, base_dir="songs"):
        self.base_dir = os.path.abspath(base_dir)

    def generate_song_id(self, rel_path):
        return hashlib.md5(rel_path.encode('utf-8')).hexdigest()[:12]

    def get_gradient_for_title(self, title):
        hash_val = sum(ord(c) for c in title)
        palette = GLASS_PALETTES[hash_val % len(GLASS_PALETTES)]
        return f"linear-gradient(135deg, {palette[0]} 0%, {palette[1]} 100%)"

    def scan(self):
        """
        Recursively scans the songs folder and builds structured song metadata list.
        Supports folder structures like:
        songs/english/normal/song.mp3
        songs/Hindi/flac/song.flac
        """
        songs = []
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir, exist_ok=True)
            return songs

        for root, _, files in os.walk(self.base_dir):
            for file in sorted(files):
                ext = os.path.splitext(file)[1].lower()
                if ext in AUDIO_EXTENSIONS:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.base_dir).replace('\\', '/')
                    path_parts = rel_path.split('/')

                    # Infer metadata from folder hierarchy (Titlecase language)
                    lang_raw = path_parts[0] if len(path_parts) > 1 else "Uncategorized"
                    language = lang_raw.title()
                    
                    quality_raw = path_parts[1] if len(path_parts) > 2 else "normal"
                    
                    # Normalize quality tag (flac/flack -> FLAC, normal -> HQ)
                    is_lossless = quality_raw.lower() in ['flac', 'flack', 'lossless', 'hd'] or ext == '.flac'
                    quality_label = "24-BIT FLAC" if is_lossless else "HQ Audio"
                    
                    # Clean formatted title from filename
                    clean_name = os.path.splitext(file)[0]
                    title_formatted = clean_name.replace('_', ' ').replace('-', ' ').strip().title()
                    
                    # File size & estimate duration
                    file_size = os.path.getsize(full_path)
                    est_duration = max(15, int(file_size / 32000))

                    song_id = self.generate_song_id(rel_path)
                    
                    song_item = {
                        "id": song_id,
                        "title": title_formatted,
                        "filename": file,
                        "rel_path": rel_path,
                        "language": language,
                        "quality_raw": quality_raw.lower(),
                        "quality_label": quality_label,
                        "is_lossless": is_lossless,
                        "artist": f"{language} Collection",
                        "album": f"{language} - {quality_raw.upper()}",
                        "duration": est_duration,
                        "format": ext[1:].upper(),
                        "file_size": file_size,
                        "gradient": self.get_gradient_for_title(title_formatted),
                        "stream_url": f"/api/stream/{rel_path}"
                    }
                    songs.append(song_item)
        return songs

    def get_folder_tree(self):
        """
        Builds a hierarchical directory tree object for folder navigation.
        """
        tree = {}
        if not os.path.exists(self.base_dir):
            return tree

        for root, dirs, files in os.walk(self.base_dir):
            rel_path = os.path.relpath(root, self.base_dir).replace('\\', '/')
            if rel_path == '.':
                rel_path = ""
            
            audio_files = [f for f in files if os.path.splitext(f)[1].lower() in AUDIO_EXTENSIONS]
            if rel_path or audio_files:
                tree[rel_path or "root"] = {
                    "dirs": dirs,
                    "files": audio_files,
                    "count": len(audio_files)
                }
        return tree
