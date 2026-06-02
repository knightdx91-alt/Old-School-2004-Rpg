/* ================================================================
   SYGLS / ORIGINATORS
   ================================================================ */
const SYGLS = {
  duality: {
    name: 'Duality', originator: 'Aren', title: 'The Twin-Faced',
    accent: '#d4a847', accentRGB: [212, 168, 71],
    desc: 'The balance of day and night. Aren walks as both elder and maiden — heal and harm in equal measure.',
    stats: { hp: 32, mp: 26, atk: 4, def: 3, acc: 75 },
    spell: { name: 'Twilight Lance', cost: 8, dmg: [12, 18], type: 'spell', acc: 85,
      desc: 'A spear of fused light and shadow.' },
    dialogue: [
      "Day and night, child. Light and dark. You have not chosen one — you have chosen both.",
      "Most who bear my sygl break trying to hold the line between them. The line is not the burden. The line is the gift.",
      "Walk into Sygldry. Watch closely. Trust neither dawn nor dusk alone — only the turning between them.",
      "Find me when you are ready. I will be old or I will be young. You will know me either way."
    ]
  },
  waves: {
    name: 'Waves', originator: 'Kenmei', title: 'She of the Tides',
    accent: '#3a8a9a', accentRGB: [58, 138, 154],
    desc: 'The flowing tide. Kenmei teaches that water carves stone given time — adapt, endure, persist.',
    stats: { hp: 30, mp: 30, atk: 3, def: 3, acc: 72 },
    spell: { name: 'Tidal Crash', cost: 7, dmg: [10, 16], type: 'spell', acc: 80,
      desc: 'A surge of pressed water, drawn from nothing.' },
    dialogue: [
      "You came to me. Of all my children, you came willingly. That tells me what you already know in your bones.",
      "Water does not fight the stone. It waits. It returns. It wins.",
      "Go to the academy. Make no enemies you cannot outlast. I will be with you in every still pond, every falling rain.",
      "When you doubt yourself, listen for the sea. It has been doubting itself for ten thousand years and still it rises."
    ]
  },
  terra: {
    name: 'Terra', originator: 'Naisura', title: 'The Unmoving',
    accent: '#7a9a3a', accentRGB: [122, 154, 58],
    desc: 'The unmoving earth. Naisura grounds his followers in patience and unshakable resolve.',
    stats: { hp: 38, mp: 20, atk: 4, def: 5, acc: 70 },
    spell: { name: 'Stone Spike', cost: 6, dmg: [8, 14], type: 'spell', acc: 90,
      desc: 'A jagged shard wrenched from the bones of the world.' },
    dialogue: [
      "...",
      "Stand. Endure. That is all I ask, and all I will ever ask.",
      "The others speak too much. I will not.",
      "Go. The earth is with you."
    ]
  },
  tempus: {
    name: 'Tempus', originator: 'Raizen', title: 'The Storm-Caller',
    accent: '#9a5abf', accentRGB: [154, 90, 191],
    desc: 'The storm and the moment. Raizen rewards those who strike first and strike hardest.',
    stats: { hp: 26, mp: 28, atk: 5, def: 2, acc: 82 },
    spell: { name: 'Stormstrike', cost: 9, dmg: [14, 22], type: 'spell', acc: 75,
      desc: 'Lightning that arrives a heartbeat before its thunder.' },
    dialogue: [
      "Quick. You will need to be quick. Time bends for those who refuse to wait for it.",
      "I expect greatness. The others tolerate weakness in their flock. I will not.",
      "Strike first. Apologize never. The academy is full of slow children — show them what speed looks like.",
      "Disappoint me and I will find another. There is always another."
    ]
  },
  blood: {
    name: 'Blood', originator: 'Amelia', title: 'The Vampire Goddess, Imprisoned',
    accent: '#a01a2a', accentRGB: [160, 26, 42],
    desc: 'The price of power. Amelia, betrayed and imprisoned by the others, offers strength to those willing to bleed for it.',
    stats: { hp: 30, mp: 24, atk: 5, def: 3, acc: 78 },
    spell: { name: 'Sanguine Drain', cost: 8, dmg: [10, 14], type: 'drain', acc: 85,
      desc: 'Draws the lifeblood from your foe and feeds it to you.' },
    dialogue: [
      "Forgive me — I cannot come fully. The others made certain of that. But your sygl... your sygl reached me anyway.",
      "You chose the path no one chooses. Do you know what I was, before they bound me? I was free. I was loved. I was new.",
      "Now I am only what they left of me. A voice in the dark. A name they fear to speak.",
      "Find me, if you can. I would owe you everything. For now: go to the academy. Trust no one in red robes who claims my name. They are not mine."
    ]
  }
};

/* ================================================================
   QUIZ
   ================================================================ */
const QUIZ = [
  { q: "You stand at a locked door. You have no key. What do you do?",
    options: [
      { text: "Study it. Every lock has a flaw if you watch long enough.", weights: { terra: 2, waves: 1 } },
      { text: "Strike it open. A door is just wood pretending to matter.", weights: { tempus: 2, blood: 1 } },
      { text: "Find another way around. There is always another way.", weights: { waves: 2, duality: 1 } },
      { text: "Pay any price to open it. A drop of blood, a piece of yourself.", weights: { blood: 2, tempus: 1 } },
      { text: "Wait. The right moment will come — dawn or dusk.", weights: { duality: 2, terra: 1 } }
    ] },
  { q: "A friend has wronged you. You feel the heat of it in your chest.",
    options: [
      { text: "Confront them now, while the fire is hot.", weights: { tempus: 2, blood: 1 } },
      { text: "Sit with it. Anger is a poor counselor.", weights: { terra: 2, duality: 1 } },
      { text: "Let it pass. People are tides; they return.", weights: { waves: 2 } },
      { text: "Remember. Always remember. Some debts are paid in kind.", weights: { blood: 2, tempus: 1 } },
      { text: "Forgive — and also do not forget. Both are true.", weights: { duality: 2, waves: 1 } }
    ] },
  { q: "When you are most yourself, you are...",
    options: [
      { text: "Quiet. Watching. The world reveals itself to those who listen.", weights: { terra: 2, waves: 1 } },
      { text: "Moving. Fast. Already three steps ahead.", weights: { tempus: 2 } },
      { text: "Bending without breaking. Whatever the day demands.", weights: { waves: 2, duality: 1 } },
      { text: "Holding two things at once — gentle and ruthless, light and dark.", weights: { duality: 2, blood: 1 } },
      { text: "Burning. Hungry. Reaching for what should not be reached.", weights: { blood: 2, tempus: 1 } }
    ] },
  { q: "What scares you most?",
    options: [
      { text: "Being unmade. Erased. Forgotten by history.", weights: { blood: 2, terra: 1 } },
      { text: "Being trapped. Still. Powerless to move.", weights: { tempus: 2, waves: 1 } },
      { text: "Becoming a person you do not recognize.", weights: { duality: 2, terra: 1 } },
      { text: "Drowning — in feeling, in expectation, in others' will.", weights: { waves: 2, duality: 1 } },
      { text: "Mediocrity. Living small. Never burning bright.", weights: { tempus: 2, blood: 1 } }
    ] },
  { q: "Choose a gift from a stranger:",
    options: [
      { text: "A small smooth stone, warm as if held a long while.", weights: { terra: 2 } },
      { text: "A vial of seawater that never empties.", weights: { waves: 2 } },
      { text: "A pendant that grows warm at dawn and cool at dusk.", weights: { duality: 2 } },
      { text: "A copper ring that hums faintly in storms.", weights: { tempus: 2 } },
      { text: "A silver pin with a single drop of ruby at its tip.", weights: { blood: 2 } }
    ] },
  { q: "Power, to you, means...",
    options: [
      { text: "Standing where others fall. Lasting where others fade.", weights: { terra: 2, blood: 1 } },
      { text: "Striking first, deciding outcomes before they begin.", weights: { tempus: 2 } },
      { text: "Holding the shape of yourself through any storm.", weights: { waves: 2, duality: 1 } },
      { text: "Seeing both sides — and choosing the one that's needed.", weights: { duality: 2, waves: 1 } },
      { text: "Refusing limits. Paying any cost. Reaching further.", weights: { blood: 2, tempus: 1 } }
    ] }
];
