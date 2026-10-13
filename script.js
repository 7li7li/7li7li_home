const iconMarkup = (name) => `<img class="ui-icon" data-icon="${name}" src="assets/icons/${name}.svg" alt="" aria-hidden="true" />`;

const body = document.body;
const themeToggle = document.querySelector('#theme-toggle');
const savedTheme = localStorage.getItem('xcLeigh-theme');
if (savedTheme) body.dataset.theme = savedTheme;
themeToggle?.addEventListener('click', () => {
  const dark = body.dataset.theme === 'dark';
  body.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('xcLeigh-theme', body.dataset.theme);
  themeToggle.innerHTML = iconMarkup(dark ? 'moon' : 'sun');
  themeToggle.setAttribute('aria-label', dark ? '切换深色模式' : '切换浅色模式');
});

const copy = document.querySelector('.profile-copy');
const languageOptions = [...document.querySelectorAll('.lang-option')];
document.querySelector('.language-switch')?.addEventListener('click', () => {
  const current = languageOptions.find((item) => item.classList.contains('is-active'))?.dataset.lang || 'zh';
  const lang = current === 'zh' ? 'en' : 'zh';
  languageOptions.forEach((item) => item.classList.toggle('is-active', item.dataset.lang === lang));
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  if (copy) copy.textContent = copy.dataset[lang === 'zh' ? 'copyZh' : 'copyEn'];
});

const audio = document.querySelector('#audio-player');
const playButton = document.querySelector('#play-toggle');
const previousTrackButton = document.querySelector('#previous-track');
const nextTrackButton = document.querySelector('#next-track');
const volumeToggle = document.querySelector('#volume-toggle');
const volumeIcon = document.querySelector('#volume-icon');
const volumeRange = document.querySelector('#volume-range');
const lyricsToggle = document.querySelector('#lyrics-toggle');
const progress = document.querySelector('#progress-range');
const currentTime = document.querySelector('#current-time');
const durationTime = document.querySelector('#duration-time');
const trackTitle = document.querySelector('#track-title');
const trackArtist = document.querySelector('#track-artist');
const albumArt = document.querySelector('#album-art');
const musicCard = document.querySelector('.music-card');
const playlistToggle = document.querySelector('#playlist-toggle');
const playlistPanel = document.querySelector('#playlist-panel');
const playlistItemsContainer = document.querySelector('#playlist-items');
const playlistCount = document.querySelector('#playlist-count');
const lyricsPanel = document.querySelector('#lyrics-panel');
const lyricsStatus = document.querySelector('#lyrics-status');
const lyricsList = document.querySelector('#lyrics-list');
const MUSIC_CONFIG_URL = 'music_config.json';
const DEFAULT_COVER = 'music/A1 TRIP、大籽、Lil E - 放空.jpg';
const DEFAULT_VOLUME = 0.5;
const fallbackMusicConfig = Array.isArray(window.MUSIC_CONFIG) ? window.MUSIC_CONFIG : null;
let musicTracks = [];
let playlistItems = [];
let activeTrack = 0;
let lastVolume = DEFAULT_VOLUME;
let activeLyrics = [];
let activeLyricIndex = -1;
let lyricRequestId = 0;

const resolveAssetUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    return new URL(value, document.baseURI).href;
  } catch {
    return value;
  }
};

const normalizeTrack = (track, index) => {
  if (!track || typeof track !== 'object') return null;
  const title = String(track.name ?? track.title ?? '').trim();
  const src = resolveAssetUrl(track.url ?? track.src ?? track.audio);
  if (!title || !src) return null;
  return {
    id: String(track.id ?? `${title}-${index}`),
    title,
    artist: String(track.artist ?? track.author ?? '未知歌手').trim() || '未知歌手',
    src,
    cover: resolveAssetUrl(track.cover ?? track.pic ?? '') || DEFAULT_COVER,
    lrc: resolveAssetUrl(track.lrc ?? ''),
    lyrics: typeof track.lyrics === 'string' ? track.lyrics : '',
  };
};

const readStoredVolume = () => {
  const stored = localStorage.getItem('xcLeigh-volume');
  if (stored === null) return DEFAULT_VOLUME;
  const value = Number(stored);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
};

const updateVolumeIcon = (value) => {
  if (!volumeIcon) return;
  const icon = value <= 0 ? 'volume-x' : value <= 0.3 ? 'volume-1' : 'volume-2';
  volumeIcon.src = `assets/icons/${icon}.svg`;
  volumeIcon.dataset.icon = icon;
  volumeToggle?.setAttribute('aria-label', value <= 0 ? '取消静音' : '静音');
};

const setVolume = (value, persist = true) => {
  const nextVolume = Math.min(1, Math.max(0, Number(value)));
  if (!Number.isFinite(nextVolume)) return;
  if (audio) audio.volume = nextVolume;
  if (volumeRange) volumeRange.value = String(nextVolume);
  if (nextVolume > 0) lastVolume = nextVolume;
  updateVolumeIcon(nextVolume);
  if (persist) localStorage.setItem('xcLeigh-volume', String(nextVolume));
};

setVolume(readStoredVolume(), false);

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const setPlayingState = (isPlaying) => {
  musicCard?.classList.toggle('is-playing', isPlaying);
  if (playButton) {
    playButton.innerHTML = iconMarkup(isPlaying ? 'pause' : 'play');
    playButton.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
    playButton.setAttribute('aria-pressed', String(isPlaying));
  }
};

const renderPlaylist = () => {
  if (!playlistItemsContainer) return;
  playlistItemsContainer.replaceChildren();
  musicTracks.forEach((track, index) => {
    const item = document.createElement('button');
    item.className = 'playlist-item';
    item.type = 'button';
    item.dataset.trackIndex = String(index);

    const title = document.createElement('span');
    title.textContent = track.title;
    const artist = document.createElement('small');
    artist.textContent = track.artist;
    item.append(title, artist);
    playlistItemsContainer.append(item);
  });
  playlistItems = [...playlistItemsContainer.querySelectorAll('.playlist-item')];
  if (playlistCount) playlistCount.textContent = `${musicTracks.length} 首歌曲`;
};

const parseLrc = (text) => {
  const parsedLines = [];
  const timePattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  String(text || '').split(/\r?\n/).forEach((rawLine) => {
    const matches = [...rawLine.matchAll(timePattern)];
    if (!matches.length) return;
    const lineText = rawLine.replace(timePattern, '').trim();
    if (!lineText) return;
    matches.forEach((match) => {
      const fraction = (match[3] || '').padEnd(3, '0').slice(0, 3);
      parsedLines.push({
        time: Number(match[1]) * 60 + Number(match[2]) + Number(fraction || 0) / 1000,
        text: lineText,
      });
    });
  });
  return parsedLines.sort((left, right) => left.time - right.time);
};

const renderLyricsMessage = (message) => {
  if (lyricsStatus) lyricsStatus.textContent = message;
  if (!lyricsList) return;
  lyricsList.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'lyrics-empty';
  empty.textContent = message;
  lyricsList.append(empty);
};

const renderLyrics = (lines) => {
  if (!lyricsList) return;
  lyricsList.replaceChildren();
  if (!lines.length) {
    renderLyricsMessage('暂无歌词');
    return;
  }
  if (lyricsStatus) lyricsStatus.textContent = `${lines.length} 行`;
  lines.forEach((line, index) => {
    const item = document.createElement('button');
    item.className = 'lyric-line';
    item.type = 'button';
    item.dataset.lyricIndex = String(index);
    item.dataset.time = String(line.time);
    item.setAttribute('role', 'listitem');
    item.textContent = line.text;
    lyricsList.append(item);
  });
};

const updateLyrics = () => {
  if (!audio || !lyricsList || !activeLyrics.length) return;
  let nextIndex = -1;
  for (let index = 0; index < activeLyrics.length; index += 1) {
    if (activeLyrics[index].time > audio.currentTime) break;
    nextIndex = index;
  }
  if (nextIndex === activeLyricIndex) return;
  activeLyricIndex = nextIndex;
  lyricsList.querySelectorAll('.lyric-line').forEach((line, index) => {
    line.classList.toggle('is-active', index === activeLyricIndex);
  });
  const activeLine = lyricsList.querySelector('.lyric-line.is-active');
  if (activeLine && !lyricsPanel?.hidden) {
    activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const loadLyrics = async (track) => {
  const requestId = ++lyricRequestId;
  activeLyrics = [];
  activeLyricIndex = -1;
  renderLyricsMessage('歌词加载中…');
  if (!track.lrc) {
    renderLyricsMessage('暂无歌词');
    return;
  }
  try {
    let lyricsText = track.lyrics;
    if (!lyricsText) {
      const response = await fetch(track.lrc, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`歌词加载失败：${response.status}`);
      lyricsText = await response.text();
    }
    const lines = parseLrc(lyricsText);
    if (requestId !== lyricRequestId) return;
    activeLyrics = lines;
    renderLyrics(lines);
    updateLyrics();
  } catch (error) {
    if (requestId !== lyricRequestId) return;
    console.warn(error);
    renderLyricsMessage('暂无歌词');
  }
};

const updateProgress = () => {
  if (!audio || !progress) return;
  const duration = audio.duration;
  progress.value = Number.isFinite(duration) && duration > 0 ? String((audio.currentTime / duration) * 100) : '0';
  if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
};

const renderTrack = (index, autoplay = false) => {
  if (!audio || !musicTracks.length) return;
  activeTrack = (index + musicTracks.length) % musicTracks.length;
  const track = musicTracks[activeTrack];
  audio.pause();
  audio.src = track.src;
  audio.load();
  if (trackTitle) trackTitle.textContent = track.title;
  if (trackArtist) trackArtist.textContent = track.artist;
  if (albumArt) {
    albumArt.src = track.cover;
    albumArt.alt = `${track.title} 专辑封面`;
  }
  if (progress) progress.value = '0';
  if (currentTime) currentTime.textContent = '0:00';
  if (durationTime) durationTime.textContent = '0:00';
  playlistItems.forEach((item) => item.classList.toggle('is-active', Number(item.dataset.trackIndex) === activeTrack));
  setPlayingState(false);
  void loadLyrics(track);
  if (autoplay) {
    void audio.play().catch(() => setPlayingState(false));
  }
};

playButton?.addEventListener('click', () => {
  if (!audio) return;
  if (audio.paused) {
    void audio.play().catch(() => setPlayingState(false));
  } else {
    audio.pause();
  }
});
previousTrackButton?.addEventListener('click', () => {
  if (!audio) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    updateProgress();
    return;
  }
  renderTrack(activeTrack - 1, !audio.paused);
});
nextTrackButton?.addEventListener('click', () => {
  renderTrack(activeTrack + 1, Boolean(audio && !audio.paused));
});
volumeRange?.addEventListener('input', (event) => setVolume(event.target.value));
volumeToggle?.addEventListener('click', () => {
  if (!audio) return;
  if (audio.volume > 0) {
    lastVolume = audio.volume;
    setVolume(0);
  } else {
    setVolume(lastVolume || DEFAULT_VOLUME);
  }
});
progress?.addEventListener('input', () => {
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = (Number(progress.value) / 100) * audio.duration;
  if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
});
audio?.addEventListener('loadedmetadata', () => {
  if (durationTime) durationTime.textContent = formatTime(audio.duration);
  updateProgress();
});
audio?.addEventListener('timeupdate', () => {
  updateProgress();
  updateLyrics();
});
audio?.addEventListener('loadedmetadata', updateLyrics);
audio?.addEventListener('play', () => setPlayingState(true));
audio?.addEventListener('pause', () => setPlayingState(false));
audio?.addEventListener('ended', () => renderTrack(activeTrack + 1, true));
audio?.addEventListener('error', () => {
  setPlayingState(false);
  if (durationTime) durationTime.textContent = '0:00';
});

const setPlaylistOpen = (isOpen) => {
  if (!playlistPanel || !playlistToggle) return;
  playlistPanel.hidden = !isOpen;
  playlistToggle.classList.toggle('is-active', isOpen);
  playlistToggle.setAttribute('aria-expanded', String(isOpen));
};
const setLyricsOpen = (isOpen) => {
  if (!lyricsPanel || !lyricsToggle) return;
  lyricsPanel.hidden = !isOpen;
  lyricsToggle.classList.toggle('is-active', isOpen);
  lyricsToggle.setAttribute('aria-expanded', String(isOpen));
  lyricsToggle.setAttribute('aria-label', isOpen ? '关闭歌词' : '打开歌词');
  if (isOpen) updateLyrics();
};
playlistToggle?.addEventListener('click', () => {
  const isOpen = Boolean(playlistPanel?.hidden);
  setPlaylistOpen(isOpen);
  if (isOpen) setLyricsOpen(false);
});
lyricsToggle?.addEventListener('click', () => {
  const isOpen = Boolean(lyricsPanel?.hidden);
  setLyricsOpen(isOpen);
  if (isOpen) setPlaylistOpen(false);
});
playlistItemsContainer?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('.playlist-item') : null;
  if (!target || !playlistItemsContainer.contains(target)) return;
  renderTrack(Number(target.dataset.trackIndex), true);
  setPlaylistOpen(false);
});
document.addEventListener('click', (event) => {
  if (musicCard && !musicCard.contains(event.target)) {
    setPlaylistOpen(false);
    setLyricsOpen(false);
  }
});
lyricsList?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('.lyric-line') : null;
  if (!target || !lyricsList.contains(target) || !audio) return;
  const time = Number(target.dataset.time);
  if (!Number.isFinite(time)) return;
  audio.currentTime = time;
  updateProgress();
  updateLyrics();
});

const loadMusicConfig = async () => {
  try {
    let config;
    try {
      const response = await fetch(MUSIC_CONFIG_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`音乐配置加载失败：${response.status}`);
      config = await response.json();
    } catch (fetchError) {
      if (!fallbackMusicConfig) throw fetchError;
      config = fallbackMusicConfig;
    }
    const entries = Array.isArray(config) ? config : Array.isArray(config.tracks) ? config.tracks : [];
    musicTracks = entries.map(normalizeTrack).filter(Boolean);
    if (!musicTracks.length) throw new Error('音乐配置中没有可播放歌曲');
    renderPlaylist();
    renderTrack(0);
  } catch (error) {
    console.error(error);
    if (playlistCount) playlistCount.textContent = '加载失败';
    if (trackTitle) trackTitle.textContent = '音乐加载失败';
    if (trackArtist) trackArtist.textContent = '请检查 music_config.json';
    if (playlistItemsContainer) {
      playlistItemsContainer.textContent = '暂无可播放歌曲';
    }
  }
};

void loadMusicConfig();

const stage = document.querySelector('.nav-stage');
const cards = [...document.querySelectorAll('.nav-card')];
const dots = [...document.querySelectorAll('.carousel-dot')];
let activeCard = 1;
function renderCards(index) {
  activeCard = (index + cards.length) % cards.length;
  cards.forEach((card, cardIndex) => {
    const position = (cardIndex - activeCard + cards.length) % cards.length;
    const slot = position === 0 ? 'center' : position === 1 ? 'right' : 'left';
    card.classList.remove('nav-card-left', 'nav-card-center', 'nav-card-right', 'is-focused');
    card.classList.add(`nav-card-${slot}`);
    card.classList.toggle('is-focused', slot === 'center');
    card.setAttribute('aria-hidden', 'false');
  });
  dots.forEach((dot, indexValue) => dot.classList.toggle('is-active', indexValue === activeCard));
}
let suppressCardClick = false;
stage?.addEventListener('click', (event) => {
  const card = event.target.closest('.nav-card');
  if (!card || !stage.contains(card)) return;
  if (suppressCardClick) {
    event.preventDefault();
    suppressCardClick = false;
    return;
  }
  if (event.target.closest('.nav-card-link')) return;
  event.preventDefault();
  renderCards(Number(card.dataset.cardIndex));
});
document.querySelector('#previous-card')?.addEventListener('click', () => renderCards(activeCard - 1));
document.querySelector('#next-card')?.addEventListener('click', () => renderCards(activeCard + 1));
dots.forEach((dot) => dot.addEventListener('click', () => renderCards(Number(dot.dataset.dot))));
stage?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') renderCards(activeCard - 1);
  if (event.key === 'ArrowRight') renderCards(activeCard + 1);
});
let startX = null;
let startY = null;
let stagePointerId = null;
let stagePointerOnLink = false;
let stagePointerMoved = false;
stage?.addEventListener('pointerdown', (event) => {
  suppressCardClick = false;
  stagePointerId = event.pointerId;
  stagePointerOnLink = Boolean(event.target.closest('.nav-card-link'));
  startX = event.clientX;
  startY = event.clientY;
  stagePointerMoved = false;
});
document.addEventListener('pointermove', (event) => {
  if (event.pointerId !== stagePointerId) return;
  if (startX === null || startY === null) return;
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
    stagePointerMoved = true;
    stage.classList.add('is-dragging');
    if (!stage.hasPointerCapture?.(event.pointerId)) stage.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }
});
document.addEventListener('pointerup', (event) => {
  if (event.pointerId !== stagePointerId) return;
  if (startX === null || startY === null) return;
  const delta = event.clientX - startX;
  const didMove = stagePointerMoved;
  const startedOnLink = stagePointerOnLink;
  startX = null;
  startY = null;
  stage.classList.remove('is-dragging');
  stagePointerId = null;
  stagePointerOnLink = false;
  stagePointerMoved = false;
  if (didMove) {
    suppressCardClick = true;
    window.setTimeout(() => { suppressCardClick = false; }, 500);
  }
  if (Math.abs(delta) > 45) {
    renderCards(activeCard + (delta < 0 ? 1 : -1));
    return;
  }
  if (startedOnLink || didMove) return;
  const clickedCard = event.target.closest('.nav-card');
  if (clickedCard && stage.contains(clickedCard) && !event.target.closest('.nav-card-link')) {
    suppressCardClick = true;
    renderCards(Number(clickedCard.dataset.cardIndex));
    window.setTimeout(() => { suppressCardClick = false; }, 300);
  }
});
document.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== stagePointerId) return;
  startX = null;
  startY = null;
  stage.classList.remove('is-dragging');
  stagePointerId = null;
  stagePointerOnLink = false;
  stagePointerMoved = false;
});
stage?.addEventListener('lostpointercapture', () => {
  if (stagePointerId === null) return;
  startX = null;
  startY = null;
  stage.classList.remove('is-dragging');
  stagePointerId = null;
  stagePointerOnLink = false;
  stagePointerMoved = false;
});
stage?.addEventListener('dragstart', (event) => event.preventDefault());
renderCards(activeCard);

const siteNavViewport = document.querySelector('#site-nav-viewport');
const siteNavCards = [...document.querySelectorAll('.site-nav-card')];
const siteNavStep = () => {
  const card = siteNavCards[0];
  if (!card) return 0;
  const gap = Number.parseFloat(getComputedStyle(document.querySelector('.site-nav-track')).gap) || 0;
  return card.getBoundingClientRect().width + gap;
};
let siteNavPointerId = null;
let siteNavStartX = 0;
let siteNavStartY = 0;
let siteNavStartScrollLeft = 0;
let siteNavIsDragging = false;
let siteNavSuppressClick = false;
let siteNavSuppressTimer = 0;
const finishSiteNavPointer = (event) => {
  if (siteNavPointerId === null || event.pointerId !== siteNavPointerId) return;
  if (siteNavIsDragging) {
    siteNavSuppressClick = true;
    window.clearTimeout(siteNavSuppressTimer);
    siteNavSuppressTimer = window.setTimeout(() => { siteNavSuppressClick = false; }, 500);
  }
  if (siteNavViewport?.hasPointerCapture?.(event.pointerId)) siteNavViewport.releasePointerCapture(event.pointerId);
  siteNavViewport?.classList.remove('is-dragging');
  siteNavPointerId = null;
  siteNavIsDragging = false;
};
siteNavViewport?.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  siteNavPointerId = event.pointerId;
  siteNavStartX = event.clientX;
  siteNavStartY = event.clientY;
  siteNavStartScrollLeft = siteNavViewport.scrollLeft;
  siteNavIsDragging = false;
});
document.addEventListener('pointermove', (event) => {
  if (event.pointerId !== siteNavPointerId) return;
  const deltaX = event.clientX - siteNavStartX;
  const deltaY = event.clientY - siteNavStartY;
  if (!siteNavIsDragging) {
    if (Math.abs(deltaX) < 8) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      siteNavPointerId = null;
      return;
    }
    siteNavIsDragging = true;
    siteNavViewport.classList.add('is-dragging');
    siteNavViewport.setPointerCapture?.(event.pointerId);
  }
  event.preventDefault();
  siteNavViewport.scrollLeft = siteNavStartScrollLeft - deltaX;
});
document.addEventListener('pointerup', (event) => finishSiteNavPointer(event));
document.addEventListener('pointercancel', finishSiteNavPointer);
siteNavViewport?.addEventListener('lostpointercapture', finishSiteNavPointer);
siteNavViewport?.addEventListener('dragstart', (event) => event.preventDefault());
siteNavViewport?.addEventListener('click', (event) => {
  if (!siteNavSuppressClick) return;
  event.preventDefault();
  event.stopPropagation();
  siteNavSuppressClick = false;
  window.clearTimeout(siteNavSuppressTimer);
});
document.querySelector('#site-nav-prev')?.addEventListener('click', () => {
  siteNavViewport?.scrollBy({ left: -siteNavStep(), behavior: 'smooth' });
});
document.querySelector('#site-nav-next')?.addEventListener('click', () => {
  siteNavViewport?.scrollBy({ left: siteNavStep(), behavior: 'smooth' });
});
siteNavViewport?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    siteNavViewport.scrollBy({ left: -siteNavStep(), behavior: 'smooth' });
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    siteNavViewport.scrollBy({ left: siteNavStep(), behavior: 'smooth' });
  }
});
