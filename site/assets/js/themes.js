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
   or 'still' (a sprite's own motion wins); all of it stops for
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

/** The themes by name, as used in CONFIG.seasons. */
export const THEMES = {
  autumn: AUTUMN,
  'dark-matter': DARK_MATTER,
  winter: WINTER,
  pauli: PAULI,
  'women-in-science': WOMEN_IN_SCIENCE,
  'pi-day': PI_DAY,
  spring: SPRING,
};
