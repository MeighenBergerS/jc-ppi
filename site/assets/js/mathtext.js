/* ============================================================
   mathtext.js — Titles and abstracts with maths, safely
   ============================================================
   INSPIRE text can carry MathML (<math><msub>…</math>), LaTeX in
   $…$, a few inline HTML tags (<sub>, <i>) and LaTeX text commands
   (\textit{…}). This module turns such text into DOM nodes the
   browser renders natively: MathML stays MathML, LaTeX becomes
   MathML, and everything else is plain text.

   The text is untrusted, so it is never handed to innerHTML. It is
   parsed into a plain tree first (parseRichText, pure and tested
   in Node), keeping only the MathML elements and attributes below
   and <sub>, <sup>, <i>, <em>, <b>, <strong>; any other tag keeps
   its text and loses the tag. The DOM is then built from that
   tree with createElement / createElementNS (renderRichText).
   ============================================================ */

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

const MATH_TAGS = new Set([
  'math',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'mspace',
  'mrow',
  'mfrac',
  'msqrt',
  'mroot',
  'mstyle',
  'merror',
  'mpadded',
  'mphantom',
  'menclose',
  'msub',
  'msup',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mmultiscripts',
  'mprescripts',
  'none',
  'mtable',
  'mtr',
  'mtd',
  'semantics',
]);
// Dropped with their content: they hold the TeX source or other markup, not display.
const MATH_DROP = new Set(['annotation', 'annotation-xml']);
const MATH_ATTRS = new Set([
  'display',
  'mathvariant',
  'accent',
  'accentunder',
  'stretchy',
  'fence',
  'separator',
  'form',
  'largeop',
  'movablelimits',
  'symmetric',
  'lspace',
  'rspace',
  'linethickness',
  'displaystyle',
  'scriptlevel',
  'columnalign',
  'rowalign',
  'columnspan',
  'rowspan',
  'notation',
  'width',
  'height',
  'depth',
  'voffset',
]);
const HTML_TAGS = new Set(['sub', 'sup', 'i', 'em', 'b', 'strong']);
const SAFE_VALUE = /^[\w .%#+-]*$/;

// ── Markup parsing ────────────────────────────────────────────

const TAG_RE =
  /<(\/?)(?:[a-zA-Z][\w-]*:)?([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;

/** Decodes the HTML/XML entities that turn up in INSPIRE text. */
export function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

const isKnownTag = (name) => MATH_TAGS.has(name) || MATH_DROP.has(name) || HTML_TAGS.has(name);

/**
 * Parses text with MathML and a few HTML tags into a tree of
 * { type: 'text', text } and { type: 'el', ns: 'mathml'|'html', tag, attrs, children }.
 * Unknown tags are unwrapped (their text kept), not rendered.
 */
function _parseMarkup(src) {
  // A tag cut off at the end (a truncated abstract) is dropped, not shown,
  // when it could be the start of one of ours: "…<mo>+</m" but not "x<y".
  const cut = src.match(/<\/?(?:[a-zA-Z][\w-]*:)?([a-zA-Z][\w-]*)(?:\s[^<>]*)?$/);
  if (
    cut &&
    [...MATH_TAGS, ...MATH_DROP, ...HTML_TAGS].some((t) => t.startsWith(cut[1].toLowerCase()))
  )
    src = src.slice(0, cut.index);
  const root = { type: 'el', tag: '#root', ns: 'html', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const inMath = () => stack.some((n) => n.ns === 'mathml');
  let last = 0;

  const pushText = (text) => {
    if (text) top().children.push({ type: 'text', text: decodeEntities(text) });
  };

  for (const m of src.matchAll(TAG_RE)) {
    const [whole, closing, rawName, rawAttrs, selfClosing] = m;
    const name = rawName.toLowerCase();
    if (!isKnownTag(name)) continue; // left in place as text
    pushText(src.slice(last, m.index));
    last = m.index + whole.length;

    if (closing) {
      const i = stack.map((n) => n.tag).lastIndexOf(name);
      if (i > 0) stack.length = i; // close it and anything left open inside
      continue;
    }
    const ns = MATH_TAGS.has(name) || MATH_DROP.has(name) ? 'mathml' : 'html';
    if (ns === 'mathml' && name !== 'math' && !inMath()) continue; // stray MathML piece
    const attrs = {};
    for (const a of rawAttrs.matchAll(ATTR_RE)) {
      const key = a[1].toLowerCase().replace(/^.*:/, '');
      const value = a[2] ?? a[3] ?? a[4] ?? '';
      if (ns === 'mathml' && MATH_ATTRS.has(key) && SAFE_VALUE.test(value)) attrs[key] = value;
    }
    const node = { type: 'el', ns, tag: name, attrs, children: [] };
    top().children.push(node);
    if (!selfClosing) stack.push(node);
  }
  pushText(src.slice(last));
  return root.children;
}

/** Removes dropped elements (annotations) from a parsed tree. */
function _prune(nodes) {
  return nodes
    .filter((n) => !(n.type === 'el' && MATH_DROP.has(n.tag)))
    .map((n) => (n.type === 'el' ? { ...n, children: _prune(n.children) } : n));
}

// ── LaTeX ─────────────────────────────────────────────────────

const GREEK = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ϵ',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  varrho: 'ϱ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'ϕ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  ell: 'ℓ',
  hbar: 'ℏ',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  emptyset: '∅',
};
const OPERATORS = {
  sim: '∼',
  simeq: '≃',
  approx: '≈',
  propto: '∝',
  equiv: '≡',
  cong: '≅',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftrightarrow: '⇔',
  longrightarrow: '⟶',
  mapsto: '↦',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  ll: '≪',
  gg: '≫',
  lesssim: '≲',
  gtrsim: '≳',
  neq: '≠',
  ne: '≠',
  times: '×',
  pm: '±',
  mp: '∓',
  cdot: '⋅',
  circ: '∘',
  star: '⋆',
  dagger: '†',
  ast: '∗',
  otimes: '⊗',
  oplus: '⊕',
  odot: '⊙',
  perp: '⊥',
  parallel: '∥',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  cup: '∪',
  cap: '∩',
  ldots: '…',
  cdots: '⋯',
  dots: '…',
  prime: '′',
  langle: '⟨',
  rangle: '⟩',
  sum: '∑',
  prod: '∏',
  int: '∫',
  oint: '∮',
  degree: '°',
  lbrace: '{',
  rbrace: '}',
  vert: '|',
  mid: '∣',
  setminus: '∖',
  forall: '∀',
  exists: '∃',
  neg: '¬',
};
const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'log',
  'ln',
  'exp',
  'min',
  'max',
  'lim',
  'det',
  'dim',
]);
const ACCENTS = {
  bar: '¯',
  overline: '‾',
  hat: '^',
  widehat: '^',
  tilde: '~',
  widetilde: '~',
  vec: '→',
  dot: '˙',
  ddot: '¨',
};
const VARIANTS = {
  mathrm: 'normal',
  rm: 'normal',
  mathbf: 'bold',
  bf: 'bold',
  mathit: 'italic',
  mathcal: 'script',
  mathbb: 'double-struck',
  mathsf: 'sans-serif',
  boldsymbol: 'bold-italic',
  mathfrak: 'fraktur',
};
const TEXTS = new Set(['text', 'textrm', 'textit', 'textbf', 'mbox', 'operatorname']);
const SPACES = {
  ',': '0.17em',
  ':': '0.22em',
  ';': '0.28em',
  ' ': '0.25em',
  quad: '1em',
  qquad: '2em',
  '!': '0em',
};

const el = (tag, children = [], attrs = {}) => ({ type: 'el', ns: 'mathml', tag, attrs, children });
const txt = (tag, text, attrs = {}) => el(tag, [{ type: 'text', text }], attrs);
const row = (nodes) => (nodes.length === 1 ? nodes[0] : el('mrow', nodes));

/**
 * Converts a LaTeX formula (without the $ signs) to a MathML tree:
 * { type: 'el', ns: 'mathml', tag: 'math', … }. Covers sub- and
 * superscripts, Greek letters, common symbols, accents, \frac, \sqrt,
 * font commands and \text; anything else is kept as text.
 * @param {string} src
 * @param {boolean} [display]
 */
export function latexToMathml(src, display = false) {
  let i = 0;

  function readGroup() {
    // One argument: {…} or a single token
    while (src[i] === ' ') i++;
    if (src[i] === '{') {
      i++;
      const nodes = readUntil('}');
      i++;
      return row(nodes);
    }
    const one = readAtom();
    return one ?? el('mrow');
  }

  function readRaw() {
    while (src[i] === ' ') i++;
    if (src[i] !== '{') return src[i++] ?? '';
    let depth = 0;
    const start = i + 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(start, i++);
  }

  function readCommand() {
    i++; // backslash
    if (!/[a-zA-Z]/.test(src[i] ?? '')) {
      const ch = src[i++] ?? '';
      if (SPACES[ch]) return el('mspace', [], { width: SPACES[ch] });
      return txt('mo', ch);
    }
    let name = '';
    while (/[a-zA-Z]/.test(src[i] ?? '')) name += src[i++];
    if (GREEK[name])
      return txt('mi', GREEK[name], /^[A-Z]/.test(name) ? { mathvariant: 'normal' } : {});
    if (OPERATORS[name]) return txt('mo', OPERATORS[name]);
    if (FUNCTIONS.has(name)) return txt('mi', name, { mathvariant: 'normal' });
    if (SPACES[name]) return el('mspace', [], { width: SPACES[name] });
    if (ACCENTS[name])
      return el('mover', [readGroup(), txt('mo', ACCENTS[name])], { accent: 'true' });
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac')
      return el('mfrac', [readGroup(), readGroup()]);
    if (name === 'sqrt') {
      while (src[i] === ' ') i++;
      if (src[i] === '[') {
        const end = src.indexOf(']', i);
        const index = latexToMathml(src.slice(i + 1, end)).children;
        i = end + 1;
        return el('mroot', [readGroup(), row(index)]);
      }
      return el('msqrt', [readGroup()]);
    }
    if (TEXTS.has(name))
      return txt(
        name === 'text' || name === 'mbox' ? 'mtext' : 'mi',
        readRaw(),
        name.startsWith('text') || name === 'mbox' ? {} : { mathvariant: 'normal' }
      );
    if (VARIANTS[name]) {
      const inner = readGroup();
      return el('mstyle', [inner], { mathvariant: VARIANTS[name] });
    }
    if (
      name === 'left' ||
      name === 'right' ||
      name === 'big' ||
      name === 'Big' ||
      name === 'bigg'
    ) {
      while (src[i] === ' ') i++;
      if (src[i] === '.') {
        i++;
        return null;
      }
      const d = src[i] === '\\' ? readCommand() : txt('mo', src[i++]);
      return d;
    }
    return txt('mtext', `\\${name}`);
  }

  function readAtom() {
    const ch = src[i];
    if (ch == null) return null;
    if (ch === '\\') return readCommand();
    if (ch === '{') {
      i++;
      const nodes = readUntil('}');
      i++;
      return row(nodes);
    }
    if (/[0-9.]/.test(ch)) {
      let n = '';
      while (/[0-9.]/.test(src[i] ?? '')) n += src[i++];
      return txt('mn', n);
    }
    i++;
    if (/[a-zA-Z]/.test(ch)) return txt('mi', ch);
    if (ch === "'") return txt('mo', '′');
    if (ch === '~') return el('mspace', [], { width: '0.25em' });
    return txt('mo', ch === '-' ? '−' : ch);
  }

  function readUntil(end) {
    const nodes = [];
    while (i < src.length && src[i] !== end) {
      if (src[i] === ' ') {
        i++;
        continue;
      }
      if (src[i] === '^' || src[i] === '_') {
        let base = nodes.pop() ?? el('mrow');
        let sub = null;
        let sup = null;
        while (src[i] === '^' || src[i] === '_') {
          const kind = src[i++];
          const arg = readGroup();
          if (kind === '_') sub = arg;
          else sup = arg;
        }
        if (base.tag === 'msub' && sup && !sub) {
          sub = base.children[1];
          base = base.children[0];
        }
        nodes.push(
          sub && sup
            ? el('msubsup', [base, sub, sup])
            : el(sub ? 'msub' : 'msup', [base, sub ?? sup])
        );
        continue;
      }
      const atom = readAtom();
      if (atom) nodes.push(atom);
    }
    return nodes;
  }

  const nodes = readUntil(undefined);
  return el('math', nodes, display ? { display: 'block' } : {});
}

// ── Text around the maths ─────────────────────────────────────

/** Replaces LaTeX text commands outside $…$ with their plain content. */
function _cleanTextLatex(text) {
  return text
    .replace(/\\(?:textit|textbf|textrm|textsf|texttt|emph|text|mathrm|mbox)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\([%&_#$])/g, '$1')
    .replace(/~/g, ' ');
}

/** Splits a text node's text into text and $…$ / $$…$$ LaTeX nodes. */
function _splitLatex(text) {
  const out = [];
  const re = /\$\$([^$]+?)\$\$|(?<!\\)\$([^$]+?)(?<!\\)\$/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last)
      out.push({ type: 'text', text: _cleanTextLatex(text.slice(last, m.index)) });
    out.push(latexToMathml((m[1] ?? m[2]).trim(), m[1] != null));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: _cleanTextLatex(text.slice(last)) });
  return out;
}

function _expandLatex(nodes, inMath = false) {
  return nodes.flatMap((n) => {
    if (n.type === 'text') return inMath ? [n] : _splitLatex(n.text);
    return [{ ...n, children: _expandLatex(n.children, inMath || n.ns === 'mathml') }];
  });
}

// ── Public API ────────────────────────────────────────────────

/**
 * Parses INSPIRE text into a safe tree: text, whitelisted inline HTML,
 * and MathML (from MathML markup or $…$ LaTeX). Pure; no DOM.
 * @param {string} text
 * @returns {object[]} Nodes: { type: 'text', text } or { type: 'el', ns, tag, attrs, children }.
 */
export function parseRichText(text) {
  return _expandLatex(_prune(_parseMarkup(String(text ?? ''))));
}

/**
 * The text without markup, for places that need a plain string
 * (word counts, tooltips, emails). MathML keeps its characters;
 * LaTeX keeps its readable symbols.
 * @param {string} text
 * @returns {string}
 */
export function plainText(text) {
  const flat = (nodes) =>
    nodes
      .map((n) => (n.type === 'text' ? n.text : n.tag === 'mspace' ? ' ' : flat(n.children)))
      .join('');
  return flat(parseRichText(text)).replace(/\s+/g, ' ').trim();
}

/**
 * Builds DOM nodes from parseRichText() output.
 * @param {object[]} nodes
 * @param {Document} [doc]
 * @returns {DocumentFragment}
 */
export function renderRichText(nodes, doc = document) {
  const frag = doc.createDocumentFragment();
  for (const n of nodes) {
    if (n.type === 'text') {
      frag.appendChild(doc.createTextNode(n.text));
      continue;
    }
    const node =
      n.ns === 'mathml' ? doc.createElementNS(MATHML_NS, n.tag) : doc.createElement(n.tag);
    for (const [k, v] of Object.entries(n.attrs)) node.setAttribute(k, v);
    node.appendChild(renderRichText(n.children, doc));
    frag.appendChild(node);
  }
  return frag;
}

/**
 * Replaces `el`'s content with `text`, rendering its maths.
 * @param {Element} el
 * @param {string} text
 */
export function setRichText(el, text) {
  el.replaceChildren(renderRichText(parseRichText(text), el.ownerDocument));
}
