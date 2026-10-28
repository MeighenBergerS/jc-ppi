/* ============================================================
   themes.js — The seasonal themes' pixel art
   ============================================================
   One entry per theme named in CONFIG.seasons (seasons.js picks
   which, by date, and places the art). Each theme can have:
     strip       a sprite tiled along the bottom of the black
                 header, at stripScale
     corners     { sprite, scale }: hung in the header's top-left
                 corner and, mirrored, the top-right
     banner      { sprites, count, motion, scales }: a scene in the
                 header, behind the text
     margin      { sprites, count, motion, scales }: in the
                 window's side margins, on wide screens
     tagline     optional: replaces the tagline while the theme shows
   motion is 'fall', 'zip' (fast and straight), 'float', 'twinkle'
   or 'still' (a sprite's own motion wins). A sprite with once: true
   (or 'still') shows at most once per scene; one with a label shows
   it on hover; all of it stops for
   reduced motion. A scene's optional seconds: [min, max] is how
   long one pass of 'fall' or 'zip' takes. scales are picked at
   random per sprite, for a little depth. Sprites are rows of
   characters plus a palette (pixelart.js): "." is transparent;
   "o" is usually the dark outline.
   ============================================================ */

// ── Autumn ────────────────────────────────────────────────────

// A leaf, tip at the top right, stem at the bottom left
const LEAF_ROWS = [
  '.....oo.',
  '...oorro',
  '..orrrdo',
  '.orrrdro',
  '.orrdrro',
  'orrdrro.',
  'ordrro..',
  'odoo....',
  'o.......',
];
const OUTLINE = '#3b2414';
const leaf = (r, d) => ({ rows: LEAF_ROWS, palette: { o: OUTLINE, r, d } });
const RED_LEAF = leaf('#c2410c', '#7c2d12');
const AMBER_LEAF = leaf('#f59e0b', '#b45309');
const BROWN_LEAF = leaf('#a16207', '#713f12');
const SMALL_LEAF = {
  rows: ['...oo', '.ooro', 'orrdo', 'ordo.', 'oo...'],
  palette: { o: OUTLINE, r: '#ea580c', d: '#9a3412' },
};
const ACORN = {
  rows: [
    '...o...',
    '..obo..',
    '.oBBBo.',
    'oBbBbBo',
    'ooooooo',
    '.oaaao.',
    '.oaAao.',
    '..oAo..',
    '...o...',
  ],
  palette: { o: OUTLINE, b: '#8b5a2b', B: '#5a3412', a: '#d6a461', A: '#a8743a' },
};

const AUTUMN = {
  // A pile of fallen leaves on dark soil
  strip: {
    rows: [
      '........y...............r.......',
      '.......yyy.....o.......rrr......',
      '..r...yyyyy...ooo.....rrrrr...y.',
      '.rrr.yyyyyyy.ooooo...rrrdrrr.yyy',
      'rrrrryyydyyyoooooooyyrrrrrrrryyy',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ],
    palette: { r: '#c2410c', d: '#7c2d12', o: '#ea580c', y: '#f59e0b', b: '#3b2414' },
  },
  stripScale: 4,
  // A branch with leaves, reaching in from the corner
  corners: {
    sprite: {
      rows: [
        'bbbbbbbbbbbbbbbbbbbbbbbb........',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbb....',
        '..bbb....bbb......bbb....bbbbb..',
        '..rrr.....r.......yy.......b....',
        '.rrrrr...rrr.....yyyy......rr...',
        '.rrdrr..rrdrr...yyyyyy....rrrr..',
        '..rrr....rrr.....yydy......rr...',
        '...r......r.......yy............',
      ],
      palette: { b: '#5a3412', r: '#c2410c', d: '#7c2d12', y: '#f59e0b' },
    },
    scale: 4,
  },
  banner: {
    sprites: [RED_LEAF, AMBER_LEAF, BROWN_LEAF, SMALL_LEAF],
    count: 16,
    motion: 'fall',
    scales: [2, 3],
  },
  margin: {
    sprites: [RED_LEAF, AMBER_LEAF, BROWN_LEAF, SMALL_LEAF, ACORN],
    count: 10,
    motion: 'fall',
    scales: [3, 4],
  },
};

// ── Dark Matter Day (Oct 31) ──────────────────────────────────

const WIMP_ROWS = [
  '...ooo...',
  '.oogggoo.',
  '.ogggggo.',
  'oggkgkggo',
  'oggkgkggo',
  'ogggggggo',
  'oGgggggGo',
  'oGGgGgGGo',
  'ogoogoogo',
  '.o..o..o.',
];
// A WIMP, mostly harmless
const WIMP = {
  rows: WIMP_ROWS,
  palette: { o: '#2e1065', g: '#c4b5fd', G: '#a78bfa', k: '#1e1b4b' },
};
// The same WIMP, nearly invisible: you can't see it, but it's there
const PALE_WIMP = {
  rows: WIMP_ROWS,
  palette: { o: '#ddd6fe', g: '#f5f3ff', G: '#ede9fe', k: '#c4b5fd' },
};
// A galaxy in its dark halo
const GALAXY = {
  rows: [
    '..H...H...H..',
    'H...........H',
    '....aaaaa....',
    '..aaasccsaaa.',
    '.aasccccccsaa',
    '..aaasccsaaa.',
    '....aaaaa....',
    'H...........H',
    '..H...H...H..',
  ],
  palette: { H: '#6d5bd0', a: '#818cf8', s: '#e0e7ff', c: '#fde68a' },
};
const STAR = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#a5b4fc', w: '#ffffff' },
  motion: 'twinkle',
};

const DARK_MATTER = {
  // Halo particles and stars
  strip: {
    rows: [
      '....s.........H.......a...H.....',
      '.H........a........H.......s....',
      '........H.......s.......H.....a.',
      '..a..........H......a.....H.....',
      'H.....s...a......H.....a.....H..',
    ],
    palette: { s: '#e0e7ff', H: '#6d5bd0', a: '#818cf8' },
  },
  stripScale: 4,
  banner: {
    sprites: [STAR, STAR, STAR, STAR, WIMP, PALE_WIMP, GALAXY],
    count: 18,
    motion: 'float',
    scales: [2, 3],
  },
  margin: {
    sprites: [WIMP, PALE_WIMP, GALAXY, STAR],
    count: 8,
    motion: 'float',
    scales: [3, 4],
  },
};

// ── Winter ────────────────────────────────────────────────────

const FLAKE_ROWS = ['...w...', '.w.w.w.', '..www..', 'wwwbwww', '..www..', '.w.w.w.', '...w...'];
const SMALL_FLAKE_ROWS = ['..w..', '.wbw.', 'wbwbw', '.wbw.', '..w..'];
const DOT_FLAKE_ROWS = ['.w.', 'www', '.w.'];
// White on the black header; blue in the white margins
const NIGHT = { w: '#f8fafc', b: '#bfdbfe' };
const DAY = { w: '#93c5fd', b: '#3b82f6' };
const flakes = (palette) => [
  { rows: FLAKE_ROWS, palette },
  { rows: SMALL_FLAKE_ROWS, palette },
  { rows: DOT_FLAKE_ROWS, palette },
];

// The IceCube Lab on its stilts, at the South Pole
const ICECUBE_LAB = {
  rows: [
    '......o.........',
    '......o.........',
    '.oooooooooooooo.',
    '.oggggggggggggo.',
    '.ogkkgkkgkkgkgo.',
    '.oggggggggggggo.',
    '.oooooooooooooo.',
    '..o..o....o..o..',
    '..o..o....o..o..',
    'ssssssssssssssss',
  ],
  palette: { o: '#334155', g: '#cbd5e1', k: '#1e293b', s: '#bfdbfe' },
  motion: 'still',
};

const WINTER = {
  // Snow drifts
  strip: {
    rows: [
      '.......ww................ww.....',
      '.....wwwwww.............wwww....',
      '...wwwwwwwwwww.......wwwwwwwww..',
      '.wwwwwwwwwwwwwwww.wwwwwwwwwwwwww',
      'wwwbwwwwwwwwwwwwwwwwwwwwwbwwwwww',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ],
    palette: { w: '#f8fafc', b: '#bfdbfe' },
  },
  stripScale: 4,
  // Icicles along the top corners
  corners: {
    sprite: {
      rows: [
        'wwwwwwwwwwwwwwwwwwwwwwww',
        'cCCcccCCcccCCccccCCcccCc',
        '.Cc...Cc...Cc....Cc...C.',
        '.Cc...C....Cc....Cc.....',
        '.C....C.....C.....C.....',
        '.C..........C...........',
        '.c..........c...........',
      ],
      palette: { w: '#f8fafc', c: '#e0f2fe', C: '#7dd3fc' },
    },
    scale: 4,
  },
  banner: { sprites: flakes(NIGHT), count: 22, motion: 'fall', scales: [2, 3], seconds: [10, 18] },
  margin: {
    sprites: [...flakes(DAY), ...flakes(DAY), ICECUBE_LAB],
    count: 12,
    motion: 'fall',
    scales: [3, 4],
    seconds: [16, 28],
  },
};

// ── Pauli's neutrino letter (Dec 4, 1930) ─────────────────────

// A neutrino in each flavour, with a short trail above it
const NU_ROWS = ['..a..', '..a..', '.aAa.', 'aAwAa', '.aAa.'];
const nu = (a, A) => ({ rows: NU_ROWS, palette: { a, A, w: '#ffffff' } });
const NEUTRINOS = [nu('#93c5fd', '#3b82f6'), nu('#86efac', '#22c55e'), nu('#f9a8d4', '#ec4899')];
// "Dear radioactive ladies and gentlemen…", sealed
const LETTER = {
  rows: [
    'oooooooooooo',
    'owwwwwwwwwwo',
    'oowwwwwwwwoo',
    'owowwwwwwowo',
    'owwowwwwowwo',
    'owwwoRRowwwo',
    'owwwwRRwwwwo',
    'owwwwwwwwwwo',
    'oooooooooooo',
  ],
  palette: { o: '#57534e', w: '#fef3c7', R: '#b91c1c' },
  motion: 'float',
};

const PAULI = {
  // A wall of photomultiplier tubes, as in a neutrino detector
  strip: {
    rows: [
      '..yy......yy......yy......yy....',
      '.yYYy....yYYy....yYYy....yYYy...',
      'yYwYYy..yYwYYy..yYwYYy..yYwYYy..',
      'yYYYYy..yYYYYy..yYYYYy..yYYYYy..',
      'gggggggggggggggggggggggggggggggg',
    ],
    palette: { y: '#facc15', Y: '#ca8a04', w: '#fef9c3', g: '#475569' },
  },
  stripScale: 4,
  tagline: 'Dear radioactive ladies and gentlemen…',
  banner: { sprites: NEUTRINOS, count: 20, motion: 'zip', scales: [2, 3], seconds: [2.5, 5] },
  margin: {
    sprites: [...NEUTRINOS, ...NEUTRINOS, LETTER],
    count: 10,
    motion: 'zip',
    scales: [3, 4],
    seconds: [4, 8],
  },
};

// ── Women and Girls in Science (Feb 11) ───────────────────────
// Symbols of their work, not portraits; each is named on hover.

const NOETHER = {
  label: 'Emmy Noether: every symmetry gives a conservation law',
  rows: [
    '.....m.....',
    '..a..m..a..',
    '.aa..m..aa.',
    'aaaa.m.aaaa',
    '.aa..m..aa.',
    '..a..m..a..',
    '.....m.....',
    '...........',
    '..eeeeeee..',
    '...........',
    '..eeeeeee..',
  ],
  palette: { m: '#94a3b8', a: '#a78bfa', e: '#facc15' },
};
const WU = {
  label: 'Chien-Shiung Wu: parity violation, seen in cobalt-60 decay',
  rows: [
    '....s....',
    '...sss...',
    '..s.s.s..',
    '....s....',
    '..nnnnn..',
    '.nnNnNnn.',
    '.nnnnnnn.',
    '..nnnnn..',
    '....e....',
    '..eeeee..',
    '...eee...',
    '....e....',
  ],
  palette: { s: '#38bdf8', n: '#f97316', N: '#9a3412', e: '#facc15' },
};
const MEITNER = {
  label: 'Lise Meitner: nuclear fission',
  rows: [
    '..nnn.....nnn..',
    '.nnNnn...nnNnn.',
    '.nNnnn.f.nnnNn.',
    '.nnNnn...nnNnn.',
    '..nnn.....nnn..',
  ],
  palette: { n: '#f97316', N: '#9a3412', f: '#fde68a' },
};
const CURIE = {
  label: 'Marie Curie: radioactivity; polonium and radium',
  rows: [
    '...ooo...',
    '...ogo...',
    '...ogo...',
    '..oggGo..',
    '.ogggggo.',
    'ogGgggGgo',
    'oggggggGo',
    '.ooooooo.',
  ],
  palette: { o: '#94a3b8', g: '#86efac', G: '#22c55e' },
};
const BELL_BURNELL = {
  label: 'Jocelyn Bell Burnell: pulsars',
  rows: ['..p.....p.....', '..p.....p.....', '.ppp...ppp....', 'llplllllplllll'],
  palette: { p: '#38bdf8', l: '#64748b' },
};
const RUBIN = { ...GALAXY, label: 'Vera Rubin: galaxy rotation, evidence for dark matter' };
const SPARKLE = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#c084fc', w: '#ffffff' },
  motion: 'twinkle',
};
const PIONEERS = [NOETHER, WU, MEITNER, CURIE, BELL_BURNELL, RUBIN];

const WOMEN_IN_SCIENCE = {
  // A row of atoms
  strip: {
    rows: [
      '.....a..........',
      '..aa.a.aa.......',
      '.a..aaa..a......',
      'a..a.n.a..a.....',
      '.a..aaa..a......',
      '..aa.a.aa.......',
      '.....a..........',
    ],
    palette: { a: '#c084fc', n: '#facc15' },
  },
  stripScale: 4,
  banner: {
    sprites: [...PIONEERS, SPARKLE, SPARKLE, SPARKLE],
    count: 14,
    motion: 'float',
    scales: [2, 3],
  },
  margin: { sprites: PIONEERS, count: 6, motion: 'float', scales: [3, 4] },
};

// ── Pi Day and Einstein's birthday (Mar 14) ───────────────────

const PI_ROWS = ['ppppppp', '.p..p..', '.p..p..', '.p..p..', '.p..p.p', 'p...pp.'];
const PIE_ROWS = ['..ccccc..', '.cCcCcCc.', 'cCcCcCcCc', 'ttttttttt', '.ttttttt.'];
const PIE = { rows: PIE_ROWS, palette: { c: '#f59e0b', C: '#b45309', t: '#94a3b8' } };

// E = mc², in a small pixel font
const GLYPHS = {
  E: ['EEE', 'E..', 'EE.', 'E..', 'EEE'],
  '=': ['...', 'EEE', '...', 'EEE', '...'],
  m: ['.....', 'EEEE.', 'E.E.E', 'E.E.E', 'E.E.E'],
  c: ['...', '.EE', 'E..', 'E..', '.EE'],
  '²': ['EE.', '..E', '.E.', 'EEE', '...'],
};
const EMC2_ROWS = [0, 1, 2, 3, 4].map((y) =>
  ['E', '=', 'm', 'c', '²'].map((ch) => GLYPHS[ch][y]).join('.')
);
const emc2 = (colour) => ({
  label: 'E = mc²: Einstein was born on March 14, 1879',
  rows: EMC2_ROWS,
  palette: { E: colour },
});

const PI_DAY = {
  // π and pie
  strip: {
    rows: [
      'ppppppp...........',
      '.p..p......ccccc..',
      '.p..p.....cCcCcCc.',
      '.p..p....cCcCcCcCc',
      '.p..p.p..ttttttttt',
      'p...pp....ttttttt.',
    ],
    palette: { p: '#fde68a', c: '#f59e0b', C: '#b45309', t: '#94a3b8' },
  },
  stripScale: 4,
  banner: {
    sprites: [{ rows: PI_ROWS, palette: { p: '#fde68a' } }, PIE, emc2('#fde68a')],
    count: 14,
    motion: 'float',
    scales: [2, 3],
  },
  margin: {
    sprites: [{ rows: PI_ROWS, palette: { p: '#b45309' } }, PIE, emc2('#b45309')],
    count: 8,
    motion: 'float',
    scales: [3, 4],
  },
};

// ── Spring ────────────────────────────────────────────────────

const FLOWER = {
  rows: ['.p.p.', 'ppppp', '.pyp.', 'ppppp', '.p.p.'],
  palette: { p: '#f9a8d4', y: '#facc15' },
};
const PETAL = { rows: ['pp.', '.pp'], palette: { p: '#fbcfe8' } };
const BLUEBIRD = {
  rows: [
    '....ooo...',
    '...obbbo..',
    '..obbbkbo.',
    'oobbbbbbyo',
    '.obbbbbbo.',
    '..oowwoo..',
    '....o.o...',
  ],
  palette: { o: '#1e3a5f', b: '#38bdf8', k: '#0f172a', y: '#f59e0b', w: '#fde68a' },
  motion: 'float',
};

const SPRING = {
  // Grass with buds and flowers
  strip: {
    rows: [
      '....p..........y..........p.....',
      '...ppp........yyy........ppp....',
      '....p..g.......y....g.....p..g..',
      '.g..g.gg..g..g.g..g.gg.g..g.gg..',
      'gGgggGgggGgggGgggGgggGgggGgggGgg',
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    ],
    palette: { p: '#f9a8d4', y: '#facc15', g: '#4ade80', G: '#15803d' },
  },
  stripScale: 4,
  // A blossoming branch, reaching in from the corner
  corners: {
    sprite: {
      rows: [
        'bbbbbbbbbbbbbbbbbbbbbbbb........',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbb....',
        '..bbb....bbb......bbb....bbbbb..',
        '.p.p.....p.p......p.p.....p.p...',
        'ppppp...ppppp....ppppp...ppppp..',
        '.pyp.....pyp......pyp.....pyp...',
        'ppppp...ppppp....ppppp...ppppp..',
        '.p.p.....p.p......p.p.....p.p...',
      ],
      palette: { b: '#5a3412', p: '#f9a8d4', y: '#facc15' },
    },
    scale: 4,
  },
  banner: {
    sprites: [PETAL, PETAL, FLOWER],
    count: 18,
    motion: 'fall',
    scales: [2, 3],
    seconds: [12, 20],
  },
  margin: {
    sprites: [PETAL, FLOWER, FLOWER, BLUEBIRD],
    count: 10,
    motion: 'fall',
    scales: [3, 4],
    seconds: [18, 30],
  },
};

// ── April Fools' (Apr 1, that day only) ──────────────────────

// Schrödinger's cat: peeking out, and the closed box. Both twinkle in
// and out, a superposition until someone looks.
const CAT_IN_BOX = {
  label: "Schrödinger's cat: alive",
  rows: [
    '...k....k...',
    '...kk..kk...',
    '...kkkkkk...',
    '...kgkkgk...',
    '...kkknkk...',
    'bbbbbbbbbbbb',
    'bBBBBBBBBBBb',
    'bBBBBBBBBBBb',
    'bBBBBBBBBBBb',
    'bbbbbbbbbbbb',
  ],
  palette: { k: '#9ca3af', g: '#22c55e', n: '#f472b6', b: '#78350f', B: '#d97706' },
  motion: 'twinkle',
};
const CLOSED_BOX = {
  label: "Schrödinger's cat: who knows?",
  rows: [
    'bbbbbbbbbbbb',
    'bBBBBqqBBBBb',
    'bBBBBBBqBBBb',
    'bBBBBBqBBBBb',
    'bBBBBBBBBBBb',
    'bBBBBBqBBBBb',
    'bbbbbbbbbbbb',
  ],
  palette: { b: '#78350f', B: '#d97706', q: '#fef3c7' },
  motion: 'twinkle',
};
const DUCK = {
  label: 'A rubber duck, for debugging',
  rows: ['...yyy...', '..yykyy..', '..yyyyyoo', '.yyyyyyy.', 'yyyyyyyyy', 'yYyyyyyYy', '.YYYYYYY.'],
  palette: { y: '#facc15', Y: '#ca8a04', k: '#111827', o: '#f97316' },
};

const APRIL_FOOLS = {
  // Rubber ducks swimming
  strip: {
    rows: [
      '...yy...........',
      '..ykyo..........',
      'yyyyy...........',
      '.yyyy...........',
      'wwwWwwwwWwwwwWww',
      'WWWWWWWWWWWWWWWW',
    ],
    palette: { y: '#facc15', k: '#111827', o: '#f97316', w: '#38bdf8', W: '#0369a1' },
  },
  stripScale: 4,
  tagline: 'From argument to arXiv — every week.',
  banner: {
    sprites: [DUCK, DUCK, CAT_IN_BOX, CLOSED_BOX],
    count: 12,
    motion: 'float',
    scales: [2, 3],
  },
  margin: { sprites: [DUCK, CAT_IN_BOX, CLOSED_BOX], count: 8, motion: 'float', scales: [3, 4] },
};

// ── International Day of Light (May 16) ───────────────────────

const SPECTRUM = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'];
// White light into a prism, a spectrum out
const PRISM = {
  label: 'A prism: white light is every colour',
  rows: [
    '.......t............',
    '......tct...........',
    '.....tccct.rrrrrrrrr',
    'wwwwwtccccyyyyyyyyyy',
    '....tcccccgggggggggg',
    '...tccccccccbbbbbbbb',
    '..ttttttttttvvvvvvvv',
  ],
  palette: {
    t: '#e2e8f0',
    c: '#64748b',
    w: '#ffffff',
    r: SPECTRUM[0],
    y: SPECTRUM[2],
    g: SPECTRUM[3],
    b: SPECTRUM[4],
    v: SPECTRUM[5],
  },
};
const LASER = {
  label: 'The first laser shone on May 16, 1960',
  rows: ['ggggg.........', 'gGGGgRRRRRRRRR', 'ggggg.........'],
  palette: { g: '#334155', G: '#94a3b8', R: '#ef4444' },
};
const PHOTON = {
  rows: ['.y.', 'ywy', '.y.'],
  palette: { y: '#fde68a', w: '#ffffff' },
  motion: 'twinkle',
};

const DAY_OF_LIGHT = {
  // A spectrum along the banner
  strip: {
    rows: [
      '0000000000000000',
      '1111111111111111',
      '2222222222222222',
      '3333333333333333',
      '4444444444444444',
      '5555555555555555',
    ],
    palette: Object.fromEntries(SPECTRUM.map((c, i) => [String(i), c])),
  },
  stripScale: 2,
  banner: {
    sprites: [PRISM, LASER, PHOTON, PHOTON, PHOTON],
    count: 16,
    motion: 'float',
    scales: [2, 3],
  },
  margin: { sprites: [PRISM, LASER, PHOTON], count: 8, motion: 'float', scales: [3, 4] },
};

// ── Neutrino oscillations (Jun 5, 1998) ───────────────────────

// One period of a wave per flavour: e (blue), μ (green), τ (pink)
const WAVE_HEIGHTS = [2, 1, 0, 0, 1, 2, 3, 4, 4, 3];
const OSCILLATION_ROWS = [0, 1, 2, 3, 4].map((y) =>
  ['e', 'm', 't'].map((f) => WAVE_HEIGHTS.map((h) => (h === y ? f : '.')).join('')).join('')
);
const SUPER_K = {
  label: 'Super-Kamiokande: neutrinos change flavour (June 5, 1998)',
  rows: [
    '.oooooooooooo.',
    'oyyyyyyyyyyyyo',
    'oywwwwwwwwwwyo',
    'oywwwwwwwwwwyo',
    'oywwwwwwwwwwyo',
    'oywwwwcwwwwwyo',
    'oywwwcwcwwwwyo',
    'oywwwwcwwwwwyo',
    'oywwwwwwwwwwyo',
    'oyyyyyyyyyyyyo',
    '.oooooooooooo.',
  ],
  palette: { o: '#475569', y: '#facc15', w: '#1e3a8a', c: '#e0f2fe' },
  motion: 'still',
  once: true,
};

const OSCILLATIONS = {
  strip: { rows: OSCILLATION_ROWS, palette: { e: '#60a5fa', m: '#4ade80', t: '#f472b6' } },
  stripScale: 4,
  banner: { sprites: [...NEUTRINOS, SUPER_K], count: 18, motion: 'float', scales: [2, 3] },
  margin: {
    sprites: [...NEUTRINOS, ...NEUTRINOS, SUPER_K],
    count: 9,
    motion: 'float',
    scales: [3, 4],
  },
};

// ── Neutrinos detected (Jun 14, 1956) ─────────────────────────

// An electron antineutrino (the bar on top), as from a reactor
const ANTINEUTRINO = {
  rows: ['aaaaa', '.....', '..a..', '.aAa.', 'aAwAa', '.aAa.'],
  palette: { a: '#93c5fd', A: '#3b82f6', w: '#ffffff' },
};
const TELEGRAM = {
  label: 'Telegram to Pauli, June 14, 1956: neutrinos detected',
  rows: [
    'oooooooooooo',
    'oPPPPPPPPPPo',
    'oPlllllllPPo',
    'oPPPPPPPPPPo',
    'oPllllllPPPo',
    'oPPPPPPPPPPo',
    'oPllllllllPo',
    'oPPPPPPPPPPo',
    'oooooooooooo',
  ],
  palette: { o: '#57534e', P: '#fef3c7', l: '#78716c' },
  motion: 'float',
  once: true,
};

const NEUTRINOS_DETECTED = {
  // Reactor cooling towers, steaming
  strip: {
    rows: [
      '...sss......',
      '.sssssss....',
      '.ccccccC....',
      '..ccccC.....',
      '...ccC......',
      '...ccC......',
      '..ccccC.....',
      '.cccccCC....',
      'cccccccCC...',
      'gggggggggggg',
    ],
    palette: { s: '#6b7280', c: '#e5e7eb', C: '#9ca3af', g: '#4b5563' },
  },
  stripScale: 3,
  tagline: 'We have definitely detected neutrinos',
  banner: { sprites: [ANTINEUTRINO], count: 20, motion: 'zip', scales: [2, 3], seconds: [2.5, 5] },
  margin: {
    sprites: [ANTINEUTRINO, ANTINEUTRINO, ANTINEUTRINO, TELEGRAM],
    count: 9,
    motion: 'zip',
    scales: [3, 4],
    seconds: [4, 8],
  },
};

// ── Summer ────────────────────────────────────────────────────

const FIREFLY = {
  rows: ['.f.', 'fFf', '.f.'],
  palette: { f: '#fef08a', F: '#facc15' },
  motion: 'twinkle',
};
const DAY_FIREFLY = {
  rows: ['.f.', 'fFf', '.f.'],
  palette: { f: '#facc15', F: '#ca8a04' },
  motion: 'twinkle',
};
// A meteor: head at the bottom left, as it moves down and to the left
const METEOR = {
  rows: [
    '.......o',
    '......o.',
    '.....y..',
    '....y...',
    '...W....',
    '..W.....',
    '.w......',
    'w.......',
  ],
  palette: { w: '#ffffff', W: '#e0f2fe', y: '#fde68a', o: '#f97316' },
  motion: 'zip',
};
const SUN = {
  rows: [
    '.....y.....',
    '..y..y..y..',
    '...yyyyy...',
    '..yYYYYYy..',
    'yyyYYYYYyyy',
    '..yYYYYYy..',
    '...yyyyy...',
    '..y..y..y..',
    '.....y.....',
  ],
  palette: { y: '#facc15', Y: '#f59e0b' },
  motion: 'float',
  once: true,
};

const SUMMER = {
  // A meadow at night, with fireflies
  strip: {
    rows: [
      '....f...........f.......f.......',
      '..........f.........f...........',
      '...hhh..........hhhh............',
      '.hhhhhhh......hhhhhhhh.....hhh..',
      'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    ],
    palette: { f: '#fde047', h: '#166534', H: '#14532d' },
  },
  stripScale: 4,
  banner: {
    sprites: [FIREFLY, FIREFLY, FIREFLY, FIREFLY, METEOR],
    count: 22,
    motion: 'twinkle',
    scales: [2, 3],
    seconds: [3, 6],
  },
  margin: { sprites: [SUN, DAY_FIREFLY, DAY_FIREFLY], count: 8, motion: 'twinkle', scales: [3, 4] },
};

// ── Asteroid Day (Jun 30) ─────────────────────────────────────

const ROCK = { o: '#57534e', g: '#a8a29e', G: '#d6d3d1' };
const ASTEROIDS = [
  { rows: ['.ooo..', 'oGgGo.', 'oggggo', '.oGgo.', '..oo..'], palette: ROCK },
  { rows: ['.oo.', 'oggo', 'ogGo', '.oo.'], palette: ROCK },
  {
    rows: ['..oooo..', '.oggGgo.', 'oggggGgo', 'ogGggggo', '.oggggo.', '..oooo..'],
    palette: ROCK,
  },
];
const EARTH = {
  label: 'Asteroid Day: the Tunguska impact, June 30, 1908',
  rows: [
    '...ooo...',
    '.oobbgoo.',
    '.obggbbo.',
    'obbbggbbo',
    'obgggbbbo',
    'obbgbbggo',
    '.obbbgbo.',
    '.oobbboo.',
    '...ooo...',
  ],
  palette: { o: '#1e3a8a', b: '#3b82f6', g: '#22c55e' },
  motion: 'float',
  once: true,
};

const ASTEROID_DAY = {
  // A belt of rocks
  strip: {
    rows: [
      '..oo..........o.......ooo.......',
      '.oGgo...oo...ogo.....oGggo..o...',
      '.oggo..ogGo...o......ogggo.ogo..',
      '..oo....oo............ooo...o...',
    ],
    palette: ROCK,
  },
  stripScale: 4,
  banner: {
    sprites: [...ASTEROIDS, ...ASTEROIDS, EARTH],
    count: 14,
    motion: 'float',
    scales: [2, 3],
  },
  margin: { sprites: [...ASTEROIDS, EARTH], count: 8, motion: 'float', scales: [3, 4] },
};

// ── Higgs boson discovery (Jul 4, 2012) ───────────────────────

// An event display: a detector ring, two tracks and two photons (H → γγ)
const HIGGS_EVENT = {
  label: 'The Higgs boson, discovered July 4, 2012 (ATLAS and CMS)',
  rows: [
    '....ooooo....',
    '..oo.....oo..',
    '.oy.......po.',
    '.o.y.....p.o.',
    'o...y...p...o',
    'o....y.p....o',
    'o.....c.....o',
    'o....p.y....o',
    'o...p...y...o',
    '.o.p.....y.o.',
    '.op.......yo.',
    '..oo.....oo..',
    '....ooooo....',
  ],
  palette: { o: '#64748b', y: '#facc15', p: '#4ade80', c: '#ffffff' },
  motion: 'float',
  once: true,
};
const SPARK = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#fde68a', w: '#ffffff' },
  motion: 'twinkle',
};

const HIGGS = {
  // Detector layers: muon chambers, calorimeters, tracker
  strip: {
    rows: [
      'bbbb.bbbb.bbbb.b',
      '................',
      'rrrrrrrrrrrrrrrr',
      'gggggggggggggggg',
      '................',
      'y.y.y.y.y.y.y.y.',
    ],
    palette: { b: '#3b82f6', r: '#ef4444', g: '#22c55e', y: '#facc15' },
  },
  stripScale: 3,
  banner: {
    sprites: [HIGGS_EVENT, SPARK, SPARK, SPARK, SPARK],
    count: 14,
    motion: 'twinkle',
    scales: [2, 3],
  },
  margin: { sprites: [HIGGS_EVENT, SPARK, SPARK], count: 6, motion: 'twinkle', scales: [3, 4] },
};

// ── Perseids (Aug 12) ─────────────────────────────────────────

const NIGHT_STAR = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#c7d2fe', w: '#ffffff' },
  motion: 'twinkle',
};
const DAY_METEOR = {
  ...METEOR,
  palette: { w: '#1e3a8a', W: '#3b82f6', y: '#f59e0b', o: '#fdba74' },
};

const PERSEIDS = {
  // Stars over dark hills
  strip: {
    rows: [
      '...s..........s.........s.......',
      '.........s..........s........s..',
      '....nnn..........nnnn...........',
      '..nnnnnnn.....nnnnnnnnn....nnn..',
      'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    ],
    palette: { s: '#e0e7ff', n: '#1e293b' },
  },
  stripScale: 4,
  banner: {
    sprites: [METEOR, METEOR, NIGHT_STAR, NIGHT_STAR],
    count: 20,
    motion: 'zip',
    scales: [2, 3],
    seconds: [2, 4],
  },
  margin: { sprites: [DAY_METEOR], count: 6, motion: 'zip', scales: [3, 4], seconds: [3, 6] },
};

// ── Nobel Prize in Physics (early October) ────────────────────

const MEDAL = {
  label: 'The Nobel Prize in Physics is announced this week',
  rows: ['.r...r.', '..r.r..', '...r...', '..ggg..', '.gGGGg.', '.gGgGg.', '.gGGGg.', '..ggg..'],
  palette: { r: '#2563eb', g: '#ca8a04', G: '#facc15' },
  motion: 'float',
};
const GOLD_SPARK = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#facc15', w: '#fef9c3' },
  motion: 'twinkle',
};

const NOBEL = {
  // A row of medals
  strip: { rows: MEDAL.rows.map((r) => `${r}.`), palette: MEDAL.palette },
  stripScale: 3,
  banner: {
    sprites: [MEDAL, GOLD_SPARK, GOLD_SPARK, GOLD_SPARK],
    count: 16,
    motion: 'float',
    scales: [2, 3],
  },
  margin: { sprites: [MEDAL, GOLD_SPARK], count: 6, motion: 'float', scales: [3, 4] },
};

/** The themes by name, as used in CONFIG.seasons. */
export const THEMES = {
  autumn: AUTUMN,
  'dark-matter': DARK_MATTER,
  winter: WINTER,
  pauli: PAULI,
  'women-in-science': WOMEN_IN_SCIENCE,
  'pi-day': PI_DAY,
  spring: SPRING,
  'april-fools': APRIL_FOOLS,
  'day-of-light': DAY_OF_LIGHT,
  oscillations: OSCILLATIONS,
  'neutrinos-detected': NEUTRINOS_DETECTED,
  summer: SUMMER,
  'asteroid-day': ASTEROID_DAY,
  higgs: HIGGS,
  perseids: PERSEIDS,
  nobel: NOBEL,
};
