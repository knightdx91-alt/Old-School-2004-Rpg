/* ================================================================
   QUIZ
   ================================================================ */
const quiz = {
  start() {
    state.quizScores = { duality:0, waves:0, terra:0, tempus:0, blood:0 };
    state.quizIndex = 0;
    showScreen('quiz-screen');
    this.render();
  },
  render() {
    const q = QUIZ[state.quizIndex];
    document.getElementById('quiz-progress').textContent = `Question ${state.quizIndex + 1} of ${QUIZ.length}`;
    document.getElementById('quiz-question').textContent = q.q;
    const opts = document.getElementById('quiz-options');
    opts.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt.text;
      btn.onclick = () => quiz.answer(i);
      opts.appendChild(btn);
    });
  },
  answer(i) {
    const opt = QUIZ[state.quizIndex].options[i];
    for (const sygl in opt.weights) state.quizScores[sygl] = (state.quizScores[sygl] || 0) + opt.weights[sygl];
    state.quizIndex++;
    if (state.quizIndex >= QUIZ.length) this.finish();
    else this.render();
  },
  finish() {
    let max = -1, winner = 'duality';
    for (const s in state.quizScores) if (state.quizScores[s] > max) { max = state.quizScores[s]; winner = s; }
    state.recommendedSygl = winner;
    syglSelect.show(true);
  }
};

/* ================================================================
   SYGL SELECT
   ================================================================ */
const syglSelect = {
  show(withRec) {
    showScreen('sygl-screen');
    const rec = document.getElementById('recommendation');
    if (withRec && state.recommendedSygl) {
      const s = SYGLS[state.recommendedSygl];
      rec.innerHTML = `Your answers resonate with <strong style="color:${s.accent}">${s.name}</strong>, the sygl of ${s.originator}. But the choice remains yours.`;
    } else {
      rec.textContent = 'Choose the sygl that calls to you.';
    }
    const grid = document.getElementById('sygl-grid');
    grid.innerHTML = '';
    for (const key in SYGLS) {
      const s = SYGLS[key];
      const card = document.createElement('div');
      card.className = 'sygl-card' + (key === state.recommendedSygl ? ' recommended' : '');
      card.style.setProperty('--accent', s.accent);
      card.innerHTML = `
        <div class="sygl-name">${s.name}</div>
        <div class="sygl-originator">— ${s.originator} —</div>
        <div class="sygl-desc">${s.desc}</div>
        <div class="sygl-stats">
          <span>HP ${s.stats.hp}</span><span>MP ${s.stats.mp}</span>
          <span>ATK ${s.stats.atk}</span><span>DEF ${s.stats.def}</span>
        </div>
        <div class="sygl-spell"><strong>${s.spell.name}</strong> — ${s.spell.dmg[0]}-${s.spell.dmg[1]} dmg${s.spell.type === 'drain' ? ' (heals you)' : ''} • ${s.spell.cost} MP</div>`;
      card.onclick = () => {
        document.querySelectorAll('.sygl-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedSygl = key;
        document.getElementById('confirm-sygl').disabled = false;
      };
      grid.appendChild(card);
    }
  }
};

/* ================================================================
   ORIGINATOR INTRO
   ================================================================ */
const intro = {
  index: 0,
  start() {
    this.index = 0;
    showScreen('intro-screen');
    const s = SYGLS[state.player.sygl];
    document.getElementById('intro-stage').style.setProperty('--accent', s.accent);
    document.getElementById('intro-name').textContent = s.originator;
    document.getElementById('intro-name').style.color = s.accent;
    document.getElementById('intro-name').style.textShadow = `0 0 20px ${s.accent}`;
    document.getElementById('intro-title').textContent = s.title;
    world.buildOriginatorPortrait(state.player.sygl);
    this.show();
  },
  renderPortrait(key) {
    const s = SYGLS[key];
    const svg = document.getElementById('orig-svg');
    let body = '';
    if (key === 'duality') {
      body = `
        <defs><linearGradient id="dual" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#f0d890"/><stop offset="50%" stop-color="#d4a847"/><stop offset="100%" stop-color="#2a1f17"/>
        </linearGradient></defs>
        <ellipse cx="150" cy="380" rx="100" ry="10" fill="rgba(0,0,0,0.5)"/>
        <path d="M150,100 L80,380 L220,380 Z" fill="url(#dual)" opacity="0.9"/>
        <circle cx="150" cy="90" r="34" fill="#e0c8a0"/>
        <path d="M120,80 Q150,40 180,80 L180,100 L120,100 Z" fill="#3a3026"/>
        <path d="M120,80 Q150,40 180,80 L180,100 L150,100 L150,80 Q135,75 120,80 Z" fill="#f0e0c0" opacity="0.5"/>
        <circle cx="138" cy="92" r="3" fill="#1a0f08"/>
        <circle cx="162" cy="92" r="3" fill="#f0d890"/>
        <line x1="150" y1="40" x2="150" y2="380" stroke="${s.accent}" stroke-width="0.5" opacity="0.4"/>`;
    } else if (key === 'waves') {
      body = `
        <ellipse cx="150" cy="380" rx="100" ry="10" fill="rgba(0,0,0,0.5)"/>
        <path d="M150,100 Q90,200 80,380 L220,380 Q210,200 150,100 Z" fill="${s.accent}" opacity="0.85"/>
        <path d="M100,200 Q150,180 200,200 M95,260 Q150,240 205,260 M90,320 Q150,300 210,320" stroke="#a8d8e8" stroke-width="2" fill="none" opacity="0.6"/>
        <circle cx="150" cy="90" r="34" fill="#e0c8a0"/>
        <path d="M115,85 Q150,40 185,85 L195,120 L105,120 Z" fill="#5a3a25"/>
        <circle cx="138" cy="92" r="3" fill="#5a8a8a"/>
        <circle cx="162" cy="92" r="3" fill="#5a8a8a"/>`;
    } else if (key === 'terra') {
      body = `
        <ellipse cx="150" cy="380" rx="110" ry="12" fill="rgba(0,0,0,0.6)"/>
        <rect x="100" y="200" width="100" height="180" fill="#e8d4a8"/>
        <path d="M100,200 L100,180 L200,180 L200,200 Z" fill="#7a6a4a"/>
        <rect x="120" y="160" width="60" height="50" fill="#d8c498"/>
        <circle cx="150" cy="90" r="38" fill="#c8a880"/>
        <path d="M150,52 L120,90 L150,98 L180,90 Z" fill="#3a2818"/>
        <circle cx="138" cy="92" r="3" fill="#1a0f08"/>
        <circle cx="162" cy="92" r="3" fill="#1a0f08"/>
        <path d="M130,170 Q150,180 170,170" stroke="${s.accent}" stroke-width="3" fill="none"/>`;
    } else if (key === 'tempus') {
      body = `
        <ellipse cx="150" cy="380" rx="100" ry="10" fill="rgba(0,0,0,0.6)"/>
        <path d="M150,100 L90,380 L210,380 Z" fill="${s.accent}"/>
        <path d="M150,130 L130,200 L150,200 L120,290 L160,220 L140,220 L165,160 Z" fill="#f0c890" opacity="0.9"/>
        <circle cx="150" cy="90" r="34" fill="#e0c8a0"/>
        <path d="M118,82 Q150,50 182,82 L182,100 L118,100 Z" fill="#1a1018"/>
        <circle cx="138" cy="92" r="3" fill="#c898ea"/>
        <circle cx="162" cy="92" r="3" fill="#c898ea"/>
        <path d="M130,98 Q150,108 170,98" stroke="#3a1a3a" stroke-width="2" fill="none"/>`;
    } else if (key === 'blood') {
      body = `
        <ellipse cx="150" cy="380" rx="90" ry="9" fill="rgba(0,0,0,0.7)"/>
        <path d="M150,110 L85,380 L215,380 Z" fill="#1a0808" opacity="0.95"/>
        <path d="M150,110 L100,380 M150,110 L200,380" stroke="${s.accent}" stroke-width="1" opacity="0.5"/>
        <circle cx="150" cy="95" r="34" fill="#f0e0d0"/>
        <path d="M114,90 Q150,40 186,90 L186,115 L114,115 Z" fill="#0a0408"/>
        <circle cx="138" cy="98" r="3" fill="${s.accent}"/>
        <circle cx="162" cy="98" r="3" fill="${s.accent}"/>
        <path d="M140,118 L148,128 L152,128 L160,118" stroke="${s.accent}" stroke-width="1.5" fill="none"/>
        <circle cx="150" cy="60" r="3" fill="${s.accent}"/>`;
    }
    svg.innerHTML = body;
  },
  show() {
    const s = SYGLS[state.player.sygl];
    document.getElementById('intro-dialogue').textContent = s.dialogue[this.index];
  },
  advance() {
    const s = SYGLS[state.player.sygl];
    this.index++;
    if (this.index >= s.dialogue.length) {
      world.disposePortrait();
      game.startWorld();
    } else {
      this.show();
    }
  }
};
