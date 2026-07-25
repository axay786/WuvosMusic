/* Wuvos Glassy Music Player - Remix Icon Version */
document.addEventListener('DOMContentLoaded', () => {

  // Global Application State
  const state = {
    allSongs: [],
    songs: [],
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off', // 'off', 'all', 'one'
    likedIds: JSON.parse(localStorage.getItem('wuvos_liked_songs') || '[]'),
    theme: localStorage.getItem('wuvos_theme') || 'dark',
    visualizer: null
  };

  // DOM Elements
  const audio = document.getElementById('audio-engine');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const viewPanes = document.querySelectorAll('.view-pane');
  const navItems = document.querySelectorAll('.nav-item');
  const globalSearch = document.getElementById('global-search');

  // Player Controls Elements
  const playerCover = document.getElementById('player-cover');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const playerLikeBtn = document.getElementById('player-like-btn');
  const ctrlPlayPause = document.getElementById('ctrl-play-pause');
  const ctrlPrev = document.getElementById('ctrl-prev');
  const ctrlNext = document.getElementById('ctrl-next');
  const ctrlShuffle = document.getElementById('ctrl-shuffle');
  const ctrlRepeat = document.getElementById('ctrl-repeat');
  const seekBarContainer = document.getElementById('seek-bar-container');
  const seekBarFill = document.getElementById('seek-bar-fill');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const volumeIcon = document.getElementById('volume-icon');
  const volumeBarContainer = document.getElementById('volume-bar-container');
  const volumeBarFill = document.getElementById('volume-bar-fill');
  const quickRescanBtn = document.getElementById('quick-rescan-btn');

  // --- LOCAL MODE & GIT FALLBACK ---
  const isLocalFileMode = window.location.protocol === 'file:';
  let gitConfig = null;

  async function loadGitConfig() {
    if (window.WUVOS_GIT_CONFIG) return window.WUVOS_GIT_CONFIG;
    if (gitConfig) return gitConfig;
    try {
      const res = await fetch('git_config.json');
      gitConfig = await res.json();
      return gitConfig;
    } catch (e) {
      console.error("Failed to load git_config.json:", e);
      gitConfig = { repo_url: "", branch: "main", token: "" };
      return gitConfig;
    }
  }

  function reMatchGithub(url) {
    const m = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (m) {
      let repoName = m[2];
      if (repoName.endsWith('.git')) {
        repoName = repoName.slice(0, -4);
      }
      return { owner: m[1], repo: repoName };
    }
    return null;
  }

  function generateSongId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 12);
  }

  const GLASS_PALETTES = [
    ["#471396", "#B13BFF"],
    ["#B13BFF", "#FFCC00"],
    ["#090040", "#471396"],
    ["#4C3BCF", "#3DC2EC"],
    ["#4B70F5", "#B13BFF"]
  ];

  function getGradientForTitle(title) {
    let hashVal = 0;
    for (let i = 0; i < title.length; i++) {
      hashVal += title.charCodeAt(i);
    }
    const palette = GLASS_PALETTES[hashVal % GLASS_PALETTES.length];
    return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`;
  }

  async function syncSongsFromGithubClientSide() {
    const config = await loadGitConfig();
    const repoUrl = config.repo_url;
    const branch = config.branch || "main";
    const token = config.token || "";

    const match = reMatchGithub(repoUrl);
    if (!match) {
      console.warn("No valid GitHub repository URL configured in git_config.json.");
      return [];
    }

    const { owner, repo } = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    let response;
    let headers = {};
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    try {
      response = await fetch(apiUrl, { headers });
      if (!response.ok && token) {
        console.warn("Fetch with token failed, retrying without token...");
        response = await fetch(apiUrl, { headers: {} });
      }
    } catch (err) {
      if (token) {
        console.warn("Fetch with token threw error, retrying without token...", err);
        try {
          response = await fetch(apiUrl, { headers: {} });
        } catch (e2) {
          return JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
        }
      } else {
        return JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
      }
    }

    if (!response || !response.ok) {
      console.warn(`GitHub API Notice (${response ? response.status : 'Error'}). Returning stored library cache.`);
      return JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
    }

    const data = await response.json();
    const tree = data.tree || [];
    const songs = [];
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.opus', '.mp4', '.m4v', '.webm', '.mka', '.3gp'];

    tree.forEach(item => {
      if (item.type === "blob") {
        const path = item.path;
        const dotIdx = path.lastIndexOf('.');
        if (dotIdx !== -1) {
          const ext = path.slice(dotIdx).toLowerCase();
          if (audioExtensions.includes(ext)) {
            const parts = path.split('/');
            const langRaw = parts.length > 1 ? parts[0] : "Uncategorized";
            const language = langRaw.charAt(0).toUpperCase() + langRaw.slice(1);
            const qualityRaw = parts.length > 2 ? parts[1] : "normal";
            const isLossless = qualityRaw.toLowerCase() === 'flac' || ext === '.flac';
            const qualityLabel = isLossless ? "24-BIT FLAC" : "HQ Audio";
            const filename = parts[parts.length - 1];
            const cleanName = filename.slice(0, filename.lastIndexOf('.'));
            const titleFormatted = cleanName.replace(/_/g, ' ').replace(/-/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
            const songId = generateSongId(path);
            const quotedPath = path.split('/').map(encodeURIComponent).join('/');
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${quotedPath}`;
            const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : "Root";

            songs.push({
              id: songId,
              sha: item.sha,
              title: titleFormatted,
              filename: filename,
              rel_path: path,
              folder: folderPath,
              language: language,
              quality_raw: qualityRaw.toLowerCase(),
              quality_label: qualityLabel,
              is_lossless: isLossless,
              artist: `${language} Collection`,
              album: folderPath !== "Root" ? `${folderPath} - ${qualityRaw.toUpperCase()}` : `${language} - ${qualityRaw.toUpperCase()}`,
              duration: Math.max(15, Math.floor(item.size / 32000)),
              format: ext.slice(1).toUpperCase(),
              file_size: item.size,
              gradient: getGradientForTitle(titleFormatted),
              stream_url: rawUrl,
              raw_url: rawUrl
            });
          }
        }
      }
    });

    localStorage.setItem('wuvos_synced_songs', JSON.stringify(songs));
    return songs;
  }

  // --- INITIALIZATION ---
  initTheme(state.theme);
  initVisualizer();
  fetchSongs();
  performBackgroundAutoSync();
  setupEventListeners();

  // Theme Switcher
  function initTheme(theme) {
    if (theme !== 'ocean') theme = 'default';

    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('wuvos_theme', theme);

    if (theme === 'default') {
      themeLabel.innerHTML = '<i class="ri-sparkling-fill" style="color:#FFCC00;"></i> Neon Gold';
    } else {
      themeLabel.innerHTML = '<i class="ri-drop-fill" style="color:#3DC2EC;"></i> Ocean Cyan';
    }
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'default' ? 'ocean' : 'default';
    initTheme(nextTheme);
  }

  function initVisualizer() {
    const canvas = document.getElementById('audio-visualizer');
    if (canvas && window.AudioVisualizer) {
      state.visualizer = new AudioVisualizer(audio, canvas);
    }
  }

  // --- DATA FETCHING & AUTOMATIC BACKGROUND SYNC ---
  let isAutoSyncing = false;

  async function performBackgroundAutoSync() {
    if (isAutoSyncing || state.isPlaying) return;
    isAutoSyncing = true;

    const rescanBtn = document.getElementById('quick-rescan-btn');
    let originalHtml = '';
    if (rescanBtn) {
      originalHtml = rescanBtn.innerHTML;
      rescanBtn.innerHTML = '<i class="ri-refresh-line ri-spin" style="color:var(--c-periwinkle);"></i> <span>Syncing Git...</span>';
    }

    try {
      if (isLocalFileMode) {
        // APK / Client-side mode
        const freshSongs = await syncSongsFromGithubClientSide();
        if (freshSongs && freshSongs.length > 0) {
          const localSongs = freshSongs;
          state.allSongs = [...localSongs];
          state.songs = [...localSongs];
          if (state.currentIndex === -1) {
            state.queue = [...state.songs];
          }
          updateBadges(localSongs);
          renderHomeView(state.songs);
          renderSearchGrid(state.songs);
        }
        } else {
          // Website / Server mode (Flask backend)
          const res = await fetch('/api/git/sync', { method: 'POST' });
          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }
          const data = await res.json();
          if (data.success && data.songs) {
            state.allSongs = data.songs;
            state.songs = data.songs;
            if (state.currentIndex === -1) {
              state.queue = [...state.songs];
            }
            updateBadges(state.songs);
            renderHomeView(state.songs);
            renderSearchGrid(state.songs);
          }
        }

      if (rescanBtn) {
        rescanBtn.innerHTML = '<i class="ri-checkbox-circle-fill" style="color:#4EAA25;"></i> <span>Synced!</span>';
        setTimeout(() => {
          if (rescanBtn) {
            rescanBtn.innerHTML = '<i class="ri-refresh-line"></i> <span>Rescan Library</span>';
          }
        }, 2000);
      }
    } catch (e) {
      console.warn("Background auto-sync deferred:", e);
      if (rescanBtn) {
        rescanBtn.innerHTML = '<i class="ri-refresh-line"></i> <span>Rescan Library</span>';
      }
      const currentStored = JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
      if (currentStored.length === 0 && isLocalFileMode) {
        setTimeout(() => {
          isAutoSyncing = false;
          performBackgroundAutoSync();
        }, 5000);
        return;
      }
    }
    isAutoSyncing = false;
  }

  window.addEventListener('online', () => {
    performBackgroundAutoSync();
  });

  // Periodic background auto-sync every 60 seconds
  setInterval(() => {
    performBackgroundAutoSync();
  }, 60000);

  async function fetchSongs(params = {}) {
    if (isLocalFileMode) {
      let localSongs = JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
      state.allSongs = localSongs;
      
      let filtered = [...localSongs];
      if (params.lang) {
        filtered = filtered.filter(s => (s.language || '').toLowerCase() === params.lang.toLowerCase() || (s.folder || '').toLowerCase().includes(params.lang.toLowerCase()));
      }
      if (params.quality) {
        if (params.quality.toLowerCase() === 'flac') {
          filtered = filtered.filter(s => s.is_lossless);
        } else if (params.quality.toLowerCase() === 'normal') {
          filtered = filtered.filter(s => !s.is_lossless);
        }
      }
      if (params.q) {
        const q = params.q.toLowerCase();
        filtered = filtered.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.rel_path.toLowerCase().includes(q) || (s.language || '').toLowerCase().includes(q));
      }

      state.songs = filtered;
      if (state.currentIndex === -1) {
        state.queue = [...state.songs];
      }
      updateBadges(localSongs);
      renderHomeView(state.songs);
      renderSearchGrid(state.songs);

      if (!params.lang && !params.quality && !params.q) {
        performBackgroundAutoSync();
      }
      return;
    }

    try {
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`/api/songs?${queryStr}`);
      const data = await res.json();
      if (data.success) {
        if (!state.allSongs || state.allSongs.length === 0 || (!params.lang && !params.quality && !params.q)) {
          state.allSongs = data.songs;
        }
        state.songs = data.songs;
        if (state.currentIndex === -1) {
          state.queue = [...state.songs];
        }
        updateBadges(state.allSongs.length > 0 ? state.allSongs : state.songs);
        renderHomeView(state.songs);
        renderSearchGrid(state.songs);

        if (!params.lang && !params.quality && !params.q) {
          performBackgroundAutoSync();
        }
      }
    } catch (e) {
      console.error('Failed to load songs:', e);
    }
  }

  function getCategoriesFromSongs(songs) {
    const categoriesMap = {};
    (songs || []).forEach(s => {
      const lang = s.language || "Uncategorized";
      categoriesMap[lang] = (categoriesMap[lang] || 0) + 1;
    });
    return categoriesMap;
  }

  function updateBadges(songs) {
    const fullSongs = (state.allSongs && state.allSongs.length > 0) ? state.allSongs : songs;
    const flacCount = fullSongs.filter(s => s.is_lossless).length;

    const badgeFlac = document.getElementById('badge-flac');
    if (badgeFlac) badgeFlac.textContent = flacCount;

    const totalBadge = document.getElementById('total-songs-count');
    if (totalBadge) totalBadge.textContent = `${songs.length} tracks`;

    const sidebarCatList = document.getElementById('sidebar-categories-list');
    if (sidebarCatList) {
      const categoriesMap = getCategoriesFromSongs(fullSongs);
      let catHtml = `
        <li class="nav-item" data-filter-quality="flac">
          <i class="ri-vip-diamond-line"></i>
          <span>FLAC Audio</span>
          <span class="badge" id="badge-flac">${flacCount}</span>
        </li>
      `;

      const icons = ['ri-global-line', 'ri-music-2-line', 'ri-folder-music-line', 'ri-disc-line', 'ri-headphone-line', 'ri-radio-line'];
      let iconIdx = 0;

      for (const [catName, count] of Object.entries(categoriesMap)) {
        const icon = icons[iconIdx % icons.length];
        iconIdx++;
        catHtml += `
          <li class="nav-item" data-filter-lang="${escapeHtml(catName)}">
            <i class="${icon}"></i>
            <span>${escapeHtml(catName)}</span>
            <span class="badge">${count}</span>
          </li>
        `;
      }
      sidebarCatList.innerHTML = catHtml;

      sidebarCatList.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          const langFilter = item.getAttribute('data-filter-lang');
          const qualityFilter = item.getAttribute('data-filter-quality');

          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          item.classList.add('active');

          if (langFilter) filterByLang(langFilter);
          if (qualityFilter) filterByQuality(qualityFilter);

          const sidebar = document.querySelector('.sidebar');
          const sidebarOverlay = document.getElementById('sidebar-overlay');
          if (sidebar) sidebar.classList.remove('open');
          if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
      });
    }
  }

  // --- RENDERING VIEWS ---
  function renderHomeView(songs) {
    const catGrid = document.getElementById('categories-grid');
    if (catGrid) {
      const fullSongs = (state.allSongs && state.allSongs.length > 0) ? state.allSongs : songs;
      const categoriesMap = getCategoriesFromSongs(fullSongs);

      let cardsHtml = ``;
      let cardIdx = 0;
      for (const [catName, count] of Object.entries(categoriesMap)) {
        const gradient = GLASS_PALETTES[cardIdx % GLASS_PALETTES.length];
        cardIdx++;
        cardsHtml += `
          <div class="music-card" onclick="filterByLang('${escapeHtml(catName)}')">
            <div class="card-cover" style="background: linear-gradient(135deg, ${gradient[0]}, ${gradient[1]});">
              <i class="ri-folder-music-line"></i>
              <div class="play-hover-btn"><i class="ri-play-fill"></i></div>
            </div>
            <div class="card-title">${escapeHtml(catName)}</div>
            <div class="card-artist">${count} ${count === 1 ? 'Track' : 'Tracks'}</div>
            <span class="quality-badge flac">Folder</span>
          </div>
        `;
      }

      cardsHtml += `
        <div class="music-card" onclick="filterByQuality('flac')">
          <div class="card-cover" style="background: linear-gradient(135deg, #4C3BCF, #3DC2EC);">
            <i class="ri-vip-diamond-line"></i>
            <div class="play-hover-btn"><i class="ri-play-fill"></i></div>
          </div>
          <div class="card-title">Lossless FLACs</div>
          <div class="card-artist">High Resolution</div>
          <span class="quality-badge flac">24-BIT FLAC</span>
        </div>
      `;

      catGrid.innerHTML = cardsHtml;
    }

    // Render Songs Table
    const tbody = document.getElementById('songs-list-body');
    tbody.innerHTML = '';

    if (songs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 60px 20px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:12px; color:var(--text-muted);">
              <i class="ri-disc-line" style="font-size: 52px; opacity: 0.4;"></i>
              <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">No songs in library</div>
              <p style="font-size: 13px;">Add music files to your Git repository and click Rescan Library.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    songs.forEach((song, idx) => {
      const isCurrent = state.currentIndex >= 0 && state.queue[state.currentIndex]?.id === song.id;
      const isLiked = state.likedIds.includes(song.id);

      const tr = document.createElement('tr');
      tr.className = `song-row ${isCurrent ? 'active' : ''}`;
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-weight:600;">${idx + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:36px; height:36px; border-radius:10px; background:${song.gradient}; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:16px;">
              <i class="${isCurrent && state.isPlaying ? 'ri-volume-up-fill' : 'ri-music-2-fill'}"></i>
            </div>
            <div>
              <div class="song-title-text">${escapeHtml(song.title)}</div>
              <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(song.artist)}</div>
            </div>
          </div>
        </td>
        <td><span style="font-size:13px; color:var(--text-secondary);">${escapeHtml(song.language)}</span></td>
        <td><span class="quality-badge ${song.is_lossless ? 'flac' : ''}">${song.quality_label}</span></td>
        <td style="text-align: right;">
          <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike('${song.id}')">
            <i class="${isLiked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
          </button>
        </td>
      `;

      tr.addEventListener('click', () => {
        state.queue = [...songs];
        playSongByIndex(idx);
      });

      tbody.appendChild(tr);
    });
  }

  function renderSearchGrid(songs) {
    const searchGrid = document.getElementById('search-grid');
    searchGrid.innerHTML = '';

    songs.forEach(song => {
      const card = document.createElement('div');
      card.className = 'music-card';
      card.innerHTML = `
        <div class="card-cover" style="background:${song.gradient}">
          <i class="ri-music-2-line"></i>
          <div class="play-hover-btn"><i class="ri-play-fill"></i></div>
        </div>
        <div class="card-title">${escapeHtml(song.title)}</div>
        <div class="card-artist">${escapeHtml(song.language)} • ${escapeHtml(song.quality_raw)}</div>
        <span class="quality-badge ${song.is_lossless ? 'flac' : ''}">${song.quality_label}</span>
      `;
      card.addEventListener('click', () => {
        const idx = state.queue.findIndex(s => s.id === song.id);
        if (idx >= 0) playSongByIndex(idx);
        else {
          state.queue = [song];
          playSongByIndex(0);
        }
      });
      searchGrid.appendChild(card);
    });
  }

  async function renderFoldersView() {
    const container = document.getElementById('folder-tree-container');
    container.innerHTML = '<div style="color:var(--text-muted);">Loading folder tree...</div>';
    try {
      let tree = {};
      if (isLocalFileMode) {
        const localSongs = JSON.parse(localStorage.getItem('wuvos_synced_songs') || '[]');
        localSongs.forEach(song => {
          const parts = song.rel_path.split('/');
          const folder = parts.slice(0, -1).join('/') || 'root';
          if (!tree[folder]) {
            tree[folder] = { files: [], count: 0 };
          }
          tree[folder].files.push(song.filename);
          tree[folder].count++;
        });
      } else {
        const res = await fetch('/api/folders');
        const data = await res.json();
        if (data.success) {
          tree = data.tree;
        }
      }

      let html = '<div style="display:flex; flex-direction:column; gap:14px;">';
      for (const [folder, details] of Object.entries(tree)) {
        html += `
          <div class="glass-panel" style="padding:18px;">
            <div style="font-weight:700; color:var(--c-periwinkle); margin-bottom:10px; display:flex; align-items:center; gap:10px;">
              <i class="ri-folder-open-fill" style="font-size:20px;"></i> ${escapeHtml(folder)}
              <span class="badge" style="font-size:11px;">${details.count} files</span>
            </div>
            <ul style="list-style:none; padding-left:26px; display:flex; flex-direction:column; gap:6px;">
              ${details.files.map(f => `<li style="font-size:13px; color:var(--text-secondary);"><i class="ri-file-music-line" style="margin-right:6px;"></i> ${escapeHtml(f)}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      html += '</div>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div style="color:#E63946;">Failed to load folder tree.</div>';
    }
  }

  function renderFavoritesView() {
    const container = document.getElementById('favorites-list-container');
    const likedSongs = state.songs.filter(s => state.likedIds.includes(s.id));
    if (likedSongs.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:20px;">No liked songs yet. Click the heart icon on any song to add it here!</p>`;
      return;
    }

    let html = `<table class="songs-table"><tbody>`;
    likedSongs.forEach((song, idx) => {
      html += `
        <tr class="song-row" onclick="playLikedSong('${song.id}')">
          <td style="width:40px;">${idx + 1}</td>
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:36px; height:36px; border-radius:10px; background:${song.gradient}; display:flex; align-items:center; justify-content:center; color:#FFFFFF;">
                <i class="ri-heart-fill" style="color:#E63946;"></i>
              </div>
              <div>
                <div class="song-title-text">${escapeHtml(song.title)}</div>
                <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(song.artist)}</div>
              </div>
            </div>
          </td>
          <td><span class="quality-badge ${song.is_lossless ? 'flac' : ''}">${song.quality_label}</span></td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // --- AUDIO CONTROLLER ---
  const nextAudioPreloader = new Audio();
  nextAudioPreloader.preload = 'auto';

  function preloadNextSong() {
    if (state.queue.length <= 1 || state.currentIndex === -1) return;
    const nextIdx = (state.currentIndex + 1) % state.queue.length;
    const nextSong = state.queue[nextIdx];
    if (nextSong && (nextSong.stream_url || nextSong.raw_url)) {
      nextAudioPreloader.src = nextSong.stream_url || nextSong.raw_url;
      nextAudioPreloader.load();
    }
  }

  let wakeLockObj = null;

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLockObj || wakeLockObj.released) {
          wakeLockObj = await navigator.wakeLock.request('screen');
        }
      } catch (err) {}
    }
  }

  function releaseWakeLock() {
    if (wakeLockObj) {
      try { wakeLockObj.release(); } catch (err) {}
      wakeLockObj = null;
    }
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.isPlaying) {
      requestWakeLock();
    }
    // Belt-and-braces: whichever direction we're switching, try to nudge
    // the AudioContext back into "running" state if it's playing but the
    // context got suspended by the browser's background power-saving policy.
    if (state.isPlaying && state.visualizer) {
      state.visualizer.resume();
    }
  });

  // Some mobile browsers (notably Android Chrome) suspend the AudioContext
  // a few seconds after backgrounding even if the tab is still executing
  // timers. Poll periodically while a track is playing so we resume it
  // right away instead of only on the next visibilitychange/foreground.
  setInterval(() => {
    if (state.isPlaying && state.visualizer) {
      state.visualizer.resume();
    }
  }, 2000);

  function sanitizeAudioUrl(url, relPath) {
    let target = url || '';
    if (!target && relPath) {
      target = `/api/stream/${relPath}`;
    }
    if (!target) return '';
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        const u = new URL(target);
        const parts = u.pathname.split('/').map(p => encodeURIComponent(decodeURIComponent(p)));
        return u.origin + parts.join('/') + u.search;
      } else {
        const parts = target.split('/').map(p => encodeURIComponent(decodeURIComponent(p)));
        return parts.join('/');
      }
    } catch (e) {
      return target;
    }
  }

  async function playSongByIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    const song = state.queue[index];

    // Update UI immediately for instantaneous feedback
    updatePlayerUI(song);

    let rawPlayUrl = song.stream_url || song.raw_url;
    let playUrl = sanitizeAudioUrl(rawPlayUrl, song.rel_path);

    if (!playUrl && song.rel_path) {
      const config = await loadGitConfig();
      const match = reMatchGithub(config.repo_url);
      if (match) {
        const branch = config.branch || "main";
        const quotedRelPath = song.rel_path.split('/').map(encodeURIComponent).join('/');
        playUrl = `https://raw.githubusercontent.com/${match.owner}/${match.repo}/${branch}/${quotedRelPath}`;
      }
    }

    if (playUrl) {
      audio.src = playUrl;
      audio.play().then(() => {
        state.isPlaying = true;
        ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';
        playerCover.classList.add('playing');
        requestWakeLock();
        if (state.visualizer) {
          state.visualizer.init();
          state.visualizer.resume();
        }
        preloadNextSong();
      }).catch(err => {
        console.error('Audio play error:', err, playUrl);
      });
    }
  }

  function togglePlayPause() {
    if (state.currentIndex === -1 && state.queue.length > 0) {
      playSongByIndex(0);
      return;
    }

    if (state.isPlaying) {
      audio.pause();
      state.isPlaying = false;
      ctrlPlayPause.innerHTML = '<i class="ri-play-fill"></i>';
      playerCover.classList.remove('playing');
      releaseWakeLock();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      syncNativeMediaState();
    } else {
      audio.play().then(() => {
        state.isPlaying = true;
        ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';
        playerCover.classList.add('playing');
        requestWakeLock();
        if (state.visualizer) state.visualizer.resume();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
          updateMediaSessionPosition();
        }
        syncNativeMediaState();
      });
    }
  }

  function playNextSong() {
    if (state.queue.length === 0) return;

    // If Repeat Single Song mode is active, loop current song
    if (state.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play().then(() => {
        state.isPlaying = true;
        ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';
        playerCover.classList.add('playing');
      }).catch(err => console.error('Loop playback error:', err));
      return;
    }

    if (state.isShuffle) {
      const randIdx = Math.floor(Math.random() * state.queue.length);
      playSongByIndex(randIdx);
    } else {
      const nextIdx = (state.currentIndex + 1) % state.queue.length;
      playSongByIndex(nextIdx);
    }
  }

  function playPrevSong() {
    if (state.queue.length === 0) return;

    // If Repeat Single Song mode is active, loop current song
    if (state.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play().then(() => {
        state.isPlaying = true;
        ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';
        playerCover.classList.add('playing');
      }).catch(err => console.error('Loop playback error:', err));
      return;
    }

    const prevIdx = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    playSongByIndex(prevIdx);
  }

  function getSongArtworkUrl(song) {
    if (!song) return '';
    if (song.cover) return song.cover;
    if (song._artworkUrl) return song._artworkUrl;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      const hashVal = (song.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const palette = GLASS_PALETTES[hashVal % GLASS_PALETTES.length];
      
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, palette ? palette[0] : '#471396');
      grad.addColorStop(1, palette ? palette[1] : '#B13BFF');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      
      const circleGrad = ctx.createRadialGradient(256, 256, 20, 256, 256, 200);
      circleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      circleGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(256, 256, 200, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 256, 240);
      
      const url = canvas.toDataURL('image/png');
      song._artworkUrl = url;
      return url;
    } catch (e) {
      return '';
    }
  }

  function updateMediaSessionPosition() {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: audio.currentTime || 0
          });
        } catch (e) {}
      }
    }
  }

  function syncNativeMediaState() {
    const song = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null;
    if (!song) return;

    const title = song.title || 'Unknown Track';
    const artist = song.artist || 'Unknown Artist';
    const album = song.album || 'Wuvos';
    const duration = audio.duration || 0;
    const position = audio.currentTime || 0;
    const isPlaying = state.isPlaying;
    const coverBase64 = getSongArtworkUrl(song);

    if (window.AndroidBridge && window.AndroidBridge.updateMediaState) {
      window.AndroidBridge.updateMediaState(title, artist, album, duration, position, isPlaying, coverBase64);
    }
  }

  // Global bindings for Android Native Lock Screen MediaSession controls
  window.wuvosPlayNext = function() { playNextSong(); };
  window.wuvosPlayPrev = function() { playPrevSong(); };
  window.wuvosTogglePlay = function() { togglePlayPause(); };
  window.wuvosSeekTo = function(seconds) {
    if (audio) {
      audio.currentTime = seconds;
      updateMediaSessionPosition();
      syncNativeMediaState();
    }
  };

  function updatePlayerUI(song) {
    playerTitle.textContent = song.title;
    playerArtist.textContent = `${song.artist} • ${song.quality_label}`;
    playerCover.style.background = song.gradient;
    playerCover.classList.add('playing');
    ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';

    const isLiked = state.likedIds.includes(song.id);
    playerLikeBtn.className = `btn-like ${isLiked ? 'liked' : ''}`;
    playerLikeBtn.innerHTML = `<i class="${isLiked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>`;

    renderHomeView(state.songs);

    if ('mediaSession' in navigator) {
      const artworkUrl = getSongArtworkUrl(song);
      const artworkArray = artworkUrl ? [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' }
      ] : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Wuvos Music',
        artwork: artworkArray
      });
      navigator.mediaSession.playbackState = 'playing';
      updateMediaSessionPosition();
    }

    syncNativeMediaState();
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Mobile Sidebar Drawer
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', () => {
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
      });
    }

    if (mobileSidebarClose) mobileSidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        const langFilter = item.getAttribute('data-filter-lang');
        const qualityFilter = item.getAttribute('data-filter-quality');

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        if (view) switchView(view);
        if (langFilter) filterByLang(langFilter);
        if (qualityFilter) filterByQuality(qualityFilter);

        closeSidebar();
      });
    });

    themeToggleBtn.addEventListener('click', toggleTheme);
    ctrlPlayPause.addEventListener('click', togglePlayPause);
    ctrlNext.addEventListener('click', playNextSong);
    ctrlPrev.addEventListener('click', playPrevSong);

    ctrlShuffle.addEventListener('click', () => {
      state.isShuffle = !state.isShuffle;
      ctrlShuffle.classList.toggle('active', state.isShuffle);
      ctrlShuffle.innerHTML = state.isShuffle 
        ? '<i class="ri-shuffle-fill"></i>' 
        : '<i class="ri-shuffle-line"></i>';
      ctrlShuffle.setAttribute('title', `Shuffle: ${state.isShuffle ? 'ON' : 'OFF'}`);
    });

    ctrlRepeat.addEventListener('click', () => {
      ctrlRepeat.classList.remove('active', 'active-one');
      if (state.repeatMode === 'off') {
        state.repeatMode = 'all';
        ctrlRepeat.classList.add('active');
        ctrlRepeat.innerHTML = '<i class="ri-repeat-2-fill"></i>';
        ctrlRepeat.setAttribute('title', 'Repeat: ALL SONGS');
      } else if (state.repeatMode === 'all') {
        state.repeatMode = 'one';
        ctrlRepeat.classList.add('active', 'active-one');
        ctrlRepeat.innerHTML = '<i class="ri-repeat-one-fill"></i>';
        ctrlRepeat.setAttribute('title', 'Repeat: CURRENT SONG');
      } else {
        state.repeatMode = 'off';
        ctrlRepeat.innerHTML = '<i class="ri-repeat-2-line"></i>';
        ctrlRepeat.setAttribute('title', 'Repeat: OFF');
      }
    });

    playerLikeBtn.addEventListener('click', () => {
      if (state.currentIndex >= 0) {
        toggleLike(state.queue[state.currentIndex].id);
      }
    });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (!state.isPlaying) togglePlayPause();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (state.isPlaying) togglePlayPause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevSong();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNextSong();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          audio.pause();
          state.isPlaying = false;
          ctrlPlayPause.innerHTML = '<i class="ri-play-fill"></i>';
          playerCover.classList.remove('playing');
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
          if (window.AndroidBridge && window.AndroidBridge.stopMediaService) {
            window.AndroidBridge.stopMediaService();
          }
        });

        if ('setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined && audio.duration) {
              audio.currentTime = details.seekTime;
              updateMediaSessionPosition();
            }
          });
          navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            audio.currentTime = Math.max(audio.currentTime - skipTime, 0);
            updateMediaSessionPosition();
          });
          navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            audio.currentTime = Math.min(audio.currentTime + skipTime, audio.duration);
            updateMediaSessionPosition();
          });
        }
      } catch (e) {
        console.warn('Error setting up MediaSession action handlers:', e);
      }
    }

    let lastNativeSyncTime = 0;
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        seekBarFill.style.width = `${pct}%`;
        timeCurrent.textContent = formatTime(audio.currentTime);
        timeTotal.textContent = formatTime(audio.duration);
        updateMediaSessionPosition();

        const now = Date.now();
        if (now - lastNativeSyncTime > 5000) {
          lastNativeSyncTime = now;
          syncNativeMediaState();
        }
      }
    });

    audio.addEventListener('ended', () => {
      if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNextSong();
      }
    });

    audio.addEventListener('error', (e) => {
      console.warn('Audio element error encountered:', e, audio.error);
      if (state.isPlaying) {
        setTimeout(() => {
          playNextSong();
        }, 1500);
      }
    });

    seekBarContainer.addEventListener('click', (e) => {
      const rect = seekBarContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      if (audio.duration) {
        audio.currentTime = pct * audio.duration;
      }
    });

    volumeBarContainer.addEventListener('click', (e) => {
      const rect = volumeBarContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const vol = Math.max(0, Math.min(1, clickX / rect.width));
      audio.volume = vol;
      volumeBarFill.style.width = `${vol * 100}%`;
    });

    volumeIcon.addEventListener('click', () => {
      if (audio.volume > 0) {
        audio.dataset.prevVol = audio.volume;
        audio.volume = 0;
        volumeBarFill.style.width = '0%';
        volumeIcon.innerHTML = '<i class="ri-volume-mute-fill"></i>';
      } else {
        const prev = parseFloat(audio.dataset.prevVol || '0.8');
        audio.volume = prev;
        volumeBarFill.style.width = `${prev * 100}%`;
        volumeIcon.innerHTML = '<i class="ri-volume-up-fill"></i>';
      }
    });

    globalSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query) {
        switchView('search');
        fetchSongs({ q: query });
      } else {
        switchView('home');
        fetchSongs();
      }
    });

    document.getElementById('hero-play-all').addEventListener('click', () => {
      if (state.songs.length > 0) {
        state.queue = [...state.songs];
        playSongByIndex(0);
      }
    });

    document.getElementById('hero-shuffle-all').addEventListener('click', () => {
      if (state.songs.length > 0) {
        state.queue = [...state.songs];
        state.isShuffle = true;
        ctrlShuffle.classList.add('active');
        const randIdx = Math.floor(Math.random() * state.queue.length);
        playSongByIndex(randIdx);
      }
    });

    quickRescanBtn.addEventListener('click', async () => {
      const originalHtml = quickRescanBtn.innerHTML;
      quickRescanBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> <span>Syncing Git...</span>';
      try {
        if (isLocalFileMode) {
          const songs = await syncSongsFromGithubClientSide();
          state.songs = songs;
          state.queue = [...state.songs];
          updateBadges(state.songs);
          renderHomeView(state.songs);
          renderSearchGrid(state.songs);
        } else {
          const res = await fetch('/api/git/sync', { method: 'POST' });
          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }
          const data = await res.json();
          if (data.success) {
            state.songs = data.songs || [];
            state.queue = [...state.songs];
            updateBadges(state.songs);
            renderHomeView(state.songs);
            renderSearchGrid(state.songs);
          } else {
            alert('Git Sync Notice: ' + (data.message || 'Sync failed'));
          }
        }
      } catch (e) {
        console.error("Sync error:", e);
        alert("Sync error: " + e.message);
      } finally {
        quickRescanBtn.innerHTML = originalHtml;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        playNextSong();
      } else if (e.code === 'ArrowLeft') {
        playPrevSong();
      }
    });
  }

  // --- HELPERS ---
  function switchView(viewName) {
    viewPanes.forEach(p => {
      p.style.display = 'none';
      p.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
    }

    if (viewName === 'folders') renderFoldersView();
    if (viewName === 'favorites') renderFavoritesView();
  }

  window.filterByLang = (lang) => {
    switchView('home');
    fetchSongs({ lang });
  };

  window.filterByQuality = (quality) => {
    switchView('home');
    fetchSongs({ quality });
  };

  window.toggleLike = (songId) => {
    if (state.likedIds.includes(songId)) {
      state.likedIds = state.likedIds.filter(id => id !== songId);
    } else {
      state.likedIds.push(songId);
    }
    localStorage.setItem('wuvos_liked_songs', JSON.stringify(state.likedIds));
    updatePlayerUI(state.queue[state.currentIndex] || {});
    renderHomeView(state.songs);
    renderFavoritesView();
  };

  window.playLikedSong = (songId) => {
    const idx = state.songs.findIndex(s => s.id === songId);
    if (idx >= 0) {
      state.queue = [...state.songs];
      playSongByIndex(idx);
    }
  };

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

});
