/* Wuvos Glassy Music Player - Remix Icon Version */
document.addEventListener('DOMContentLoaded', () => {

  // Global Application State
  const state = {
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

  // --- INITIALIZATION ---
  initTheme(state.theme);
  initVisualizer();
  fetchSongs();
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

  // --- DATA FETCHING ---
  async function fetchSongs(params = {}) {
    try {
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`/api/songs?${queryStr}`);
      const data = await res.json();
      if (data.success) {
        state.songs = data.songs;
        state.queue = [...state.songs];
        updateBadges(state.songs);
        renderHomeView(state.songs);
        renderSearchGrid(state.songs);
      }
    } catch (e) {
      console.error('Failed to load songs:', e);
    }
  }

  function updateBadges(songs) {
    const englishCount = songs.filter(s => (s.language || '').toLowerCase() === 'english').length;
    const hindiCount = songs.filter(s => (s.language || '').toLowerCase() === 'hindi').length;
    const flacCount = songs.filter(s => s.is_lossless).length;

    document.getElementById('badge-english').textContent = englishCount;
    document.getElementById('badge-hindi').textContent = hindiCount;
    document.getElementById('badge-flac').textContent = flacCount;
    document.getElementById('total-songs-count').textContent = `${songs.length} tracks`;
  }

  // --- RENDERING VIEWS ---
  function renderHomeView(songs) {
    // Render Category Cards with Remix Icons
    const catGrid = document.getElementById('categories-grid');
    catGrid.innerHTML = `
      <div class="music-card" onclick="filterByLang('English')">
        <div class="card-cover" style="background: linear-gradient(135deg, #471396, #B13BFF);">
          <i class="ri-global-line"></i>
          <div class="play-hover-btn"><i class="ri-play-fill"></i></div>
        </div>
        <div class="card-title">English Hits</div>
        <div class="card-artist">Songs Collection</div>
        <span class="quality-badge flac">FLAC & HQ</span>
      </div>

      <div class="music-card" onclick="filterByLang('Hindi')">
        <div class="card-cover" style="background: linear-gradient(135deg, #B13BFF, #FFCC00);">
          <i class="ri-music-2-line"></i>
          <div class="play-hover-btn"><i class="ri-play-fill"></i></div>
        </div>
        <div class="card-title">Hindi Collection</div>
        <div class="card-artist">Songs Collection</div>
        <span class="quality-badge flac">FLAC & HQ</span>
      </div>

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
      const res = await fetch('/api/folders');
      const data = await res.json();
      if (data.success) {
        let html = '<div style="display:flex; flex-direction:column; gap:14px;">';
        for (const [folder, details] of Object.entries(data.tree)) {
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
      }
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
  function playSongByIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    const song = state.queue[index];

    audio.src = song.stream_url;
    audio.play().then(() => {
      state.isPlaying = true;
      updatePlayerUI(song);
      if (state.visualizer) {
        state.visualizer.init();
        state.visualizer.resume();
      }
    }).catch(err => {
      console.error('Audio play error:', err);
    });
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
    } else {
      audio.play().then(() => {
        state.isPlaying = true;
        ctrlPlayPause.innerHTML = '<i class="ri-pause-fill"></i>';
        playerCover.classList.add('playing');
        if (state.visualizer) state.visualizer.resume();
      });
    }
  }

  function playNextSong() {
    if (state.queue.length === 0) return;
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
    const prevIdx = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    playSongByIndex(prevIdx);
  }

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
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album
      });
    }
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
    });

    ctrlRepeat.addEventListener('click', () => {
      if (state.repeatMode === 'off') state.repeatMode = 'all';
      else if (state.repeatMode === 'all') state.repeatMode = 'one';
      else state.repeatMode = 'off';

      ctrlRepeat.classList.toggle('active', state.repeatMode !== 'off');
      ctrlRepeat.setAttribute('title', `Repeat: ${state.repeatMode.toUpperCase()}`);
    });

    playerLikeBtn.addEventListener('click', () => {
      if (state.currentIndex >= 0) {
        toggleLike(state.queue[state.currentIndex].id);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        seekBarFill.style.width = `${pct}%`;
        timeCurrent.textContent = formatTime(audio.currentTime);
        timeTotal.textContent = formatTime(audio.duration);
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
        const res = await fetch('/api/git/sync', { method: 'POST' });
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
      } catch (e) {
        console.error("Sync error:", e);
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
