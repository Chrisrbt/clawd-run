'use strict';

/* Easter eggs. If you're reading this file to find them all: well done, but that's cheating. */

(() => {
  const EGGS = [
    { id: 'konami', name: 'Opus Mode', hint: 'An ancient code: up, up, down, down…', how: '↑ ↑ ↓ ↓ ← → ← → B A' },
    { id: 'claude', name: 'Surprise party', hint: 'Call it by its family name.', how: 'Type "claude"' },
    { id: 'sudo', name: 'Permission denied', hint: 'Ask for superpowers, terminal style.', how: 'Type "sudo"' },
    { id: 'neo', name: 'Red pill', hint: 'The chosen one has a three-letter name.', how: 'Type "neo"' },
    { id: 'dino', name: 'Retirement', hint: 'Name the old champion of offline.', how: 'Type "dino"' },
    { id: 'ciao', name: 'Good manners', hint: 'Saying hi is free.', how: 'Type "hello" (or "ciao")' },
    { id: 'hat', name: 'Wardrobe', hint: 'Clawd is ticklish.', how: 'Click Clawd 5 times on the title screen' },
    { id: 'sleep', name: 'Nap time', hint: 'Patience is a virtue.', how: 'Stay idle on the title screen' },
    { id: 'sun', name: 'Cosmic switch', hint: "There's another way to change the theme.", how: 'Click the sun or the moon' },
    { id: 's42', name: 'The answer', hint: 'Life, the universe and everything.', how: 'Reach 42 tokens' },
    { id: 's404', name: 'Score not found', hint: 'A number every developer knows.', how: 'Reach 404 tokens' },
    { id: 'compact', name: 'Context window', hint: 'Run until the context fills up.', how: 'Reach 1000 tokens' },
    { id: 'offline', name: 'Consistency', hint: 'Play it properly: with no network.', how: 'Actually go offline' },
    { id: 'night', name: 'Night owl', hint: 'Some runs only happen late at night.', how: 'Play between midnight and 5 am' },
  ];

  const found = new Set(Store.get('eggs', []).filter((id) => EGGS.some((e) => e.id === id)));
  const counter = document.getElementById('eggCount');
  const dialog = document.getElementById('eggDialog');
  const list = document.getElementById('eggList');

  const syncCounter = () => { counter.textContent = `${found.size}/${EGGS.length}`; };

  function unlock(id) {
    if (found.has(id)) return false;
    found.add(id);
    Store.set('eggs', [...found]);
    syncCounter();
    AudioSys.sfx.secret();
    const egg = EGGS.find((e) => e.id === id);
    UI.toast(`Secret found: ${egg.name} (${found.size}/${EGGS.length})`, { egg: true, ms: 4200 });
    if (found.size === EGGS.length) {
      setTimeout(() => { Game.opus(12); UI.toast('You found them all. Clawd is proud of you.', { egg: true, ms: 6000 }); }, 1200);
    }
    return true;
  }

  /* ----- typed words and the Konami code ----- */
  const hello = () => {
    unlock('ciao');
    Game.say(pick(['Hello!', 'Hey there!', 'Hi! Shall we run?', "Good morning! Or good night, I don't own a clock."]), 2.8);
  };

  const WORDS = {
    claude() {
      unlock('claude');
      Game.party();
      Game.say('Is this the party?');
    },
    sudo() {
      unlock('sudo');
      UI.toast('clawd is not in the sudoers file. This incident will be reported.', { ms: 4200 });
      Game.say('Nice try.');
    },
    neo() {
      unlock('neo');
      const on = Game.toggleMatrix();
      Game.say(on ? 'All I see is code.' : 'Welcome back to the real world.');
    },
    dino() {
      unlock('dino');
      Game.meteor();
      Game.say("The dinosaur retired. I'm the runner now.", 3.4);
    },
    hello,
    ciao: hello,
  };

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let typed = '';
  let konamiAt = 0;

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (document.querySelector('dialog[open]')) return;

    konamiAt = e.code === KONAMI[konamiAt] ? konamiAt + 1 : e.code === KONAMI[0] ? 1 : 0;
    if (konamiAt === KONAMI.length) {
      konamiAt = 0;
      unlock('konami');
      Game.opus(9);
      Game.banner('OPUS MODE: invincible for 9 seconds', 3);
    }

    if (e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-12);
      for (const word of Object.keys(WORDS)) {
        if (typed.endsWith(word)) { typed = ''; WORDS[word](); break; }
      }
    }
  });

  /* ----- game-driven secrets ----- */
  const TICKLE = ['Hey!', 'That tickles!', 'Again?', "I'm going to be offended."];
  let clicks = 0;
  Game.on('clawdClick', () => {
    clicks++;
    if (clicks < 5) { Game.say(TICKLE[clicks - 1], 1.4); return; }
    unlock('hat');
    const hat = Game.nextHat();
    Game.say(hat === 'none' ? 'Better au naturel.' : 'How do I look?', 1.6);
    AudioSys.sfx.toggle();
  });

  Game.on('sleep', () => unlock('sleep'));

  Game.on('sunClick', () => {
    UI.toggleTheme();
    unlock('sun');
  });

  Game.on('score', (score, prev) => {
    const crossed = (n) => prev < n && score >= n;
    if (crossed(42)) { unlock('s42'); Game.say('42. The answer.', 2); }
    if (crossed(404)) { unlock('s404'); Game.glitchHud('404: score not found', 2.4); }
    if (crossed(1000)) { unlock('compact'); Game.banner('Compacting conversation…', 3); Game.squish(); }
  });

  Game.on('start', () => {
    const hour = new Date().getHours();
    if (hour < 5) {
      unlock('night');
      Game.say('At this hour? Fine, but then bed.', 3);
    }
    if (!navigator.onLine) unlock('offline');
  });

  window.addEventListener('offline', () => {
    unlock('offline');
    UI.toast("You're actually offline. Finally, some consistency.");
  });

  /* ----- secrets list ----- */
  function renderList() {
    list.textContent = '';
    for (const egg of EGGS) {
      const li = document.createElement('li');
      const got = found.has(egg.id);
      li.className = got ? 'got' : '';
      const name = document.createElement('strong');
      name.textContent = got ? egg.name : '???';
      const desc = document.createElement('span');
      desc.textContent = got ? egg.how : egg.hint;
      li.append(name, desc);
      list.appendChild(li);
    }
  }

  document.getElementById('btnEggs').addEventListener('click', (e) => {
    renderList();
    UI.openDialog(dialog);
    e.currentTarget.blur();
  });

  /* ----- small extras ----- */
  const baseTitle = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'Hey, come back! · Clawd Run' : baseTitle;
  });

  console.log(
    '%c\n   ██████████\n   ██ ████ ██\n ██████████████\n   ██████████\n   █ █    █ █\n',
    'color:#D97757;font-family:monospace;line-height:1.1'
  );
  console.log('%cHi there, curious one. Clawd says: try typing "neo" while you play.', 'color:#D97757;font-weight:bold');

  syncCounter();
})();
