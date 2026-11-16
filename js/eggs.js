'use strict';

/* Easter egg. Se stai leggendo questo file per trovarli tutti: bravo, ma è barare. */

(() => {
  const EGGS = [
    { id: 'konami', name: 'Opus Mode', hint: 'Un codice antico: su, su, giù, giù…', how: '↑ ↑ ↓ ↓ ← → ← → B A' },
    { id: 'claude', name: 'Festa a sorpresa', hint: 'Chiamalo con il nome di famiglia.', how: 'Scrivi "claude"' },
    { id: 'sudo', name: 'Permesso negato', hint: 'Chiedi i superpoteri come in un terminale.', how: 'Scrivi "sudo"' },
    { id: 'neo', name: 'Pillola rossa', hint: 'Il prescelto ha un nome di tre lettere.', how: 'Scrivi "neo"' },
    { id: 'dino', name: 'Pensionamento', hint: "Nomina il vecchio campione dell'offline.", how: 'Scrivi "dino"' },
    { id: 'ciao', name: 'Buone maniere', hint: 'Salutare è gratis.', how: 'Scrivi "ciao"' },
    { id: 'hat', name: 'Guardaroba', hint: 'Clawd soffre il solletico.', how: 'Clicca Clawd 5 volte nella schermata iniziale' },
    { id: 'sleep', name: 'Pisolino', hint: 'La pazienza è una virtù.', how: 'Resta fermo nella schermata iniziale' },
    { id: 'sun', name: 'Interruttore cosmico', hint: "C'è un altro modo per cambiare tema.", how: 'Clicca il sole o la luna' },
    { id: 's42', name: 'La risposta', hint: 'Vita, universo e tutto quanto.', how: 'Raggiungi 42 token' },
    { id: 's404', name: 'Punteggio non trovato', hint: 'Un numero che ogni sviluppatore conosce.', how: 'Raggiungi 404 token' },
    { id: 'compact', name: 'Context window', hint: 'Corri finché il contesto non si riempie.', how: 'Raggiungi 1000 token' },
    { id: 'offline', name: 'Coerenza', hint: 'Gioca come si deve: senza rete.', how: 'Vai offline per davvero' },
    { id: 'night', name: 'Nottambulo', hint: 'Certe partite si fanno solo a notte fonda.', how: 'Gioca tra mezzanotte e le 5' },
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
    UI.toast(`Segreto trovato: ${egg.name} (${found.size}/${EGGS.length})`, { egg: true, ms: 4200 });
    if (found.size === EGGS.length) {
      setTimeout(() => { Game.opus(12); UI.toast('Li hai trovati tutti. Clawd è fiero di te.', { egg: true, ms: 6000 }); }, 1200);
    }
    return true;
  }

  /* ----- parole digitate e codice Konami ----- */
  const WORDS = {
    claude() {
      unlock('claude');
      Game.party();
      Game.say('È qui la festa?');
    },
    sudo() {
      unlock('sudo');
      UI.toast('clawd is not in the sudoers file. This incident will be reported.', { ms: 4200 });
      Game.say('Bel tentativo.');
    },
    neo() {
      unlock('neo');
      const on = Game.toggleMatrix();
      Game.say(on ? 'Vedo solo codice.' : 'Bentornato nel mondo reale.');
    },
    dino() {
      unlock('dino');
      Game.meteor();
      Game.say('Il dinosauro è in pensione. Adesso corro io.', 3.4);
    },
    ciao() {
      unlock('ciao');
      Game.say(pick(['Ciao!', 'Ehilà!', 'Ciao, corriamo?', 'Buongiorno! O buonanotte, non ho un orologio.']), 2.8);
    },
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
      Game.banner('OPUS MODE: invincibile per 9 secondi', 3);
    }

    if (e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-12);
      for (const word of Object.keys(WORDS)) {
        if (typed.endsWith(word)) { typed = ''; WORDS[word](); break; }
      }
    }
  });

  /* ----- segreti legati al gioco ----- */
  const TICKLE = ['Ehi!', 'Fa il solletico!', 'Ancora?', 'Guarda che mi offendo.'];
  let clicks = 0;
  Game.on('clawdClick', () => {
    clicks++;
    if (clicks < 5) { Game.say(TICKLE[clicks - 1], 1.4); return; }
    unlock('hat');
    const hat = Game.nextHat();
    Game.say(hat === 'none' ? 'Meglio al naturale.' : 'Come mi sta?', 1.6);
    AudioSys.sfx.toggle();
  });

  Game.on('sleep', () => unlock('sleep'));

  Game.on('sunClick', () => {
    UI.toggleTheme();
    unlock('sun');
  });

  Game.on('score', (score, prev) => {
    const crossed = (n) => prev < n && score >= n;
    if (crossed(42)) { unlock('s42'); Game.say('42. La risposta.', 2); }
    if (crossed(404)) { unlock('s404'); Game.glitchHud('404: punteggio non trovato', 2.4); }
    if (crossed(1000)) { unlock('compact'); Game.banner('Compacting conversation…', 3); Game.squish(); }
  });

  Game.on('start', () => {
    const hour = new Date().getHours();
    if (hour < 5) {
      unlock('night');
      Game.say('A quest\'ora? Va bene, ma poi a letto.', 3);
    }
    if (!navigator.onLine) unlock('offline');
  });

  window.addEventListener('offline', () => {
    unlock('offline');
    UI.toast('Sei offline per davvero. Finalmente un po\' di coerenza.');
  });

  /* ----- elenco dei segreti ----- */
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
    if (Game.state === 'playing') Game.togglePause();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    e.currentTarget.blur();
  });
  document.getElementById('eggClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ----- piccoli extra ----- */
  const baseTitle = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'Ehi, torna qui! · Clawd Run' : baseTitle;
  });

  console.log(
    '%c\n   ██████████\n   ██ ████ ██\n ██████████████\n   ██████████\n   █ █    █ █\n',
    'color:#D97757;font-family:monospace;line-height:1.1'
  );
  console.log('%cCiao, curiosone. Clawd dice: prova a scrivere "neo" mentre giochi.', 'color:#D97757;font-weight:bold');

  syncCounter();
})();
