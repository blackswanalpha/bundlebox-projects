/* studio.js — renders the studio FROM system.json and screens/*.json.
   Nothing about a screen is written twice: the picker, the state pills and the
   token table are all built from the declarations the gate reads, so a screen
   and its states cannot drift apart. That property is what the self-test leans
   on and it is the only reason this file is worth having. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  async function load() {
    const system = await (await fetch('system.json')).json();
    const list = await (await fetch('screens/index.json')).json();
    const screens = await Promise.all(list.map(async (n) => (await fetch('screens/' + n)).json()));
    return { system, screens };
  }

  function renderTokens(system, host) {
    for (const [k, v] of Object.entries(system.color.tokens)) {
      const row = el('div', 'token-row');
      const sw = el('span', 'swatch'); sw.style.background = v;
      row.append(sw, el('code', null, '--c-' + k), el('span', 'dim', v));
      host.append(row);
    }
  }

  function renderScreen(s, host, stateHost) {
    host.replaceChildren();
    stateHost.replaceChildren();
    const names = Object.keys(s.states || {});
    let active = names[0];
    const draw = () => {
      const st = s.states[active] || {};
      host.replaceChildren();
      host.dataset.state = active;
      host.append(el('h2', null, s.title));
      host.append(el('p', 'dim', s.lede || ''));
      const badge = el('div', 'state-badge', active.toUpperCase());
      host.append(badge);
      host.append(el('p', null, st.copy || st.note || ''));
      if (st.skeleton) { for (let i = 0; i < 5; i++) host.append(el('div', 'skeleton')); }
    };
    for (const n of names) {
      const b = el('button', 'pill', s.states[n].label || n);
      b.setAttribute('aria-pressed', String(n === active));
      b.addEventListener('click', () => {
        active = n;
        for (const sib of stateHost.children) sib.setAttribute('aria-pressed', String(sib === b));
        draw();
      });
      stateHost.append(b);
    }
    draw();
  }

  load().then(({ system, screens }) => {
    document.title = system.name + ' — designlabs';
    renderTokens(system, $('#tokens'));
    const picker = $('#picker'), stage = $('#stage'), states = $('#states');
    screens.forEach((s, i) => {
      const b = el('button', 'pill', s.title);
      b.addEventListener('click', () => {
        for (const sib of picker.children) sib.setAttribute('aria-pressed', String(sib === b));
        renderScreen(s, stage, states);
      });
      picker.append(b);
      if (i === 0) b.click();
    });
    window.__STUDIO__ = { system, screens };
  }).catch((e) => { $('#stage').textContent = 'Could not load the studio: ' + e.message + '. Serve this over http://, not file://.'; });
})();
