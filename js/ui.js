'use strict';

/* Pulsanti, tema chiaro/scuro, notifiche e modalità offline. */

const UI = (() => {
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const toasts = $('toasts');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function toast(msg, opts) {
    const o = opts || {};
    const el = document.createElement('div');
    el.className = 'toast' + (o.egg ? ' egg' : '');
    el.textContent = msg;
    toasts.appendChild(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 350);
    }, o.ms || 3400);
  }

  /* ----- tema ----- */
  function setTheme(name, persist) {
    root.dataset.theme = name;
    if (persist) Store.set('theme', name);
    themeMeta.content = name === 'dark' ? '#1C1B1A' : '#F4EFE6';
    $('btnTheme').setAttribute('aria-label', name === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro');
    Game.setTheme(name);
    AudioSys.setSong(name);
  }

  function toggleTheme() {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    AudioSys.sfx.toggle();
  }

  systemDark.addEventListener('change', (e) => {
    if (Store.get('theme', null) === null) setTheme(e.matches ? 'dark' : 'light', false);
  });

  /* ----- audio ----- */
  function syncAudioButtons() {
    $('btnMusic').setAttribute('aria-pressed', String(AudioSys.musicOn));
    $('btnSfx').setAttribute('aria-pressed', String(AudioSys.sfxOn));
  }

  function toggleMusic() {
    AudioSys.unlock();
    AudioSys.setMusic(!AudioSys.musicOn);
    syncAudioButtons();
    toast(AudioSys.musicOn ? 'Musica: accesa' : 'Musica: spenta', { ms: 1400 });
  }

  function toggleSfx() {
    AudioSys.unlock();
    AudioSys.setSfx(!AudioSys.sfxOn);
    syncAudioButtons();
    AudioSys.sfx.toggle();
    toast(AudioSys.sfxOn ? 'Effetti: accesi' : 'Effetti: spenti', { ms: 1400 });
  }

  // Dopo il clic il pulsante perde il focus, altrimenti Spazio lo riattiverebbe invece di saltare.
  function bind(id, fn) {
    $(id).addEventListener('click', (e) => { fn(); e.currentTarget.blur(); });
  }
  bind('btnTheme', toggleTheme);
  bind('btnMusic', toggleMusic);
  bind('btnSfx', toggleSfx);
  bind('btnPause', () => Game.togglePause());

  Game.on('pause', (paused) => $('btnPause').classList.toggle('active', paused));
  Game.on('start', () => $('btnPause').classList.remove('active'));

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.code === 'KeyT') toggleTheme();
    else if (e.code === 'KeyM') toggleMusic();
    else if (e.code === 'KeyF') toggleSfx();
  });

  /* ----- pulsante "abbassati" per il touch ----- */
  const duck = $('btnDuck');
  const duckOn = (e) => { e.preventDefault(); AudioSys.unlock(); Game.setDuck(true); };
  const duckOff = () => Game.setDuck(false);
  duck.addEventListener('pointerdown', duckOn);
  duck.addEventListener('pointerup', duckOff);
  duck.addEventListener('pointercancel', duckOff);
  duck.addEventListener('pointerleave', duckOff);
  duck.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ----- stato della rete ----- */
  function syncNet() {
    $('netLabel').textContent = navigator.onLine
      ? 'Sei online. Facciamo finta di no.'
      : 'Nessuna connessione. Perfetto così.';
  }
  window.addEventListener('online', () => { syncNet(); toast('Internet è tornato. Ma tu resta qui.'); });
  window.addEventListener('offline', syncNet);

  /* ----- avvio ----- */
  setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  syncAudioButtons();
  syncNet();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  return { toast, toggleTheme };
})();
