const iconRoot = window.lucide;
if (iconRoot) iconRoot.createIcons();

const body = document.body;
const refreshIcons = () => iconRoot?.createIcons();
const themeToggle = document.querySelector('#theme-toggle');
const savedTheme = localStorage.getItem('xcLeigh-theme');
if (savedTheme) body.dataset.theme = savedTheme;
themeToggle?.addEventListener('click', () => {
  const dark = body.dataset.theme === 'dark';
  body.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('xcLeigh-theme', body.dataset.theme);
  themeToggle.innerHTML = `<i data-lucide="${dark ? 'moon' : 'sun'}"></i>`;
  themeToggle.setAttribute('aria-label', dark ? '切换深色模式' : '切换浅色模式');
  refreshIcons();
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

const playButton = document.querySelector('#play-toggle');
let playing = false;
playButton?.addEventListener('click', () => {
  playing = !playing;
  playButton.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
  playButton.setAttribute('aria-label', playing ? '暂停' : '播放');
  refreshIcons();
});
const progress = document.querySelector('#progress-range');
const currentTime = document.querySelector('#current-time');
progress?.addEventListener('input', () => {
  const seconds = Math.round((Number(progress.value) / 100) * 188);
  if (currentTime) currentTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
document.querySelector('#playlist-toggle')?.addEventListener('click', (event) => {
  event.currentTarget.classList.toggle('is-active');
});

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
    card.setAttribute('aria-hidden', slot === 'center' ? 'false' : 'true');
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
  if (!card.classList.contains('nav-card-center')) {
    event.preventDefault();
    renderCards(Number(card.dataset.cardIndex));
  }
}, true);
document.querySelector('#previous-card')?.addEventListener('click', () => renderCards(activeCard - 1));
document.querySelector('#next-card')?.addEventListener('click', () => renderCards(activeCard + 1));
dots.forEach((dot) => dot.addEventListener('click', () => renderCards(Number(dot.dataset.dot))));
stage?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') renderCards(activeCard - 1);
  if (event.key === 'ArrowRight') renderCards(activeCard + 1);
});
let startX = null;
stage?.addEventListener('pointerdown', (event) => { startX = event.clientX; stage.setPointerCapture?.(event.pointerId); });
stage?.addEventListener('pointerup', (event) => {
  if (startX === null) return;
  const delta = event.clientX - startX;
  startX = null;
  if (Math.abs(delta) > 45) {
    suppressCardClick = true;
    renderCards(activeCard + (delta < 0 ? 1 : -1));
    window.setTimeout(() => { suppressCardClick = false; }, 0);
    return;
  }
  const clickedCard = document.elementFromPoint(event.clientX, event.clientY)?.closest('.nav-card');
  if (clickedCard && stage.contains(clickedCard) && !clickedCard.classList.contains('nav-card-center')) {
    suppressCardClick = true;
    renderCards(Number(clickedCard.dataset.cardIndex));
    window.setTimeout(() => { suppressCardClick = false; }, 0);
  }
});
stage?.addEventListener('pointercancel', () => { startX = null; });
renderCards(activeCard);

const siteNavViewport = document.querySelector('#site-nav-viewport');
const siteNavCards = [...document.querySelectorAll('.site-nav-card')];
const siteNavStep = () => {
  const card = siteNavCards[0];
  if (!card) return 0;
  const gap = Number.parseFloat(getComputedStyle(document.querySelector('.site-nav-track')).gap) || 0;
  return card.getBoundingClientRect().width + gap;
};
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
