'use strict';

/* Buttons, light/dark theme, toasts, records and offline mode. */

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

  /* ----- dialogs ----- */
  function openDialog(dialog) {
    if (Game.state === 'playing') Game.togglePause();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.querySelectorAll('.dlg-close').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  });

  /* ----- theme ----- */
  function setTheme(name, persist) {
    root.dataset.theme = name;
    if (persist) Store.set('theme', name);
    themeMeta.content = name === 'dark' ? '#1C1B1A' : '#F4EFE6';
    $('btnTheme').setAttribute('aria-label', name === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
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
    toast(AudioSys.musicOn ? 'Music: on' : 'Music: off', { ms: 1400 });
  }

  function toggleSfx() {
    AudioSys.unlock();
    AudioSys.setSfx(!AudioSys.sfxOn);
    syncAudioButtons();
    AudioSys.sfx.toggle();
    toast(AudioSys.sfxOn ? 'Sound effects: on' : 'Sound effects: off', { ms: 1400 });
  }

  // Drop focus after a click, otherwise Space would press the button again instead of jumping.
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

  /* ----- touch "duck" button ----- */
  const duck = $('btnDuck');
  const duckOn = (e) => { e.preventDefault(); AudioSys.unlock(); Game.setDuck(true); };
  const duckOff = () => Game.setDuck(false);
  duck.addEventListener('pointerdown', duckOn);
  duck.addEventListener('pointerup', duckOff);
  duck.addEventListener('pointercancel', duckOff);
  duck.addEventListener('pointerleave', duckOff);
  duck.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ----- records ----- */
  const MAX_RUNS = 10;
  const recDialog = $('recDialog');
  const fmtDate = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  Game.on('over', (score) => {
    Store.set('plays', Store.get('plays', 0) + 1);
    const runs = Store.get('runs', []);
    runs.push({ s: score, t: Date.now() });
    runs.sort((a, b) => b.s - a.s || b.t - a.t);
    Store.set('runs', runs.slice(0, MAX_RUNS));
  });

  function renderRecords() {
    $('recBest').textContent = Game.best.toLocaleString('en-US');
    $('recLast').textContent = Game.last === null ? '–' : Game.last.toLocaleString('en-US');
    $('recPlays').textContent = Store.get('plays', 0).toLocaleString('en-US');
    const list = $('recList');
    list.textContent = '';
    const runs = Store.get('runs', []);
    if (!runs.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No runs yet. Go play one.';
      list.appendChild(li);
      return;
    }
    runs.forEach((r, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = '#' + (i + 1);
      const score = document.createElement('strong');
      score.textContent = r.s.toLocaleString('en-US');
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = fmtDate(r.t);
      li.append(rank, score, date);
      list.appendChild(li);
    });
  }

  $('btnRecords').addEventListener('click', (e) => {
    renderRecords();
    openDialog(recDialog);
    e.currentTarget.blur();
  });

  $('recReset').addEventListener('click', () => {
    if (!window.confirm('Delete your best score, last run and run history? This cannot be undone.')) return;
    Game.resetRecords();
    Store.set('runs', []);
    Store.set('plays', 0);
    renderRecords();
    toast('Records cleared.');
  });

  /* ----- network status ----- */
  function syncNet() {
    $('netLabel').textContent = navigator.onLine
      ? "You're online. Let's pretend you're not."
      : 'No connection. Perfect.';
  }
  window.addEventListener('online', () => { syncNet(); toast("The internet is back. You can stay, though."); });
  window.addEventListener('offline', syncNet);

  /* ----- boot ----- */
  setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  syncAudioButtons();
  syncNet();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  return { toast, toggleTheme, openDialog };
})();
