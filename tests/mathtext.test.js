/**
 * mathtext.test.js — Tests for maths in INSPIRE text (site/assets/js/mathtext.js).
 * Run with: node --test tests/mathtext.test.js
 *
 * parseRichText() and latexToMathml() are pure; the DOM side
 * (renderRichText) is tested in tests/runner.html.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseRichText,
  latexToMathml,
  plainText,
  decodeEntities,
} from '../site/assets/js/mathtext.js';

/** Every element in a tree, depth first. */
function elements(nodes) {
  return nodes.flatMap((n) => (n.type === 'el' ? [n, ...elements(n.children)] : []));
}
const tags = (nodes) => elements(nodes).map((n) => n.tag);

// The abstract from issue #107
const IBD =
  'Inverse beta decay (IBD), <math display="inline"><msub><mover accent="true"><mi>ν</mi>' +
  '<mo stretchy="false">¯</mo></mover><mi>e</mi></msub><mi>p</mi><mo stretchy="false">→</mo>' +
  '<msup><mi>e</mi><mo>+</mo></msup><mi>n</mi>' +
  '<annotation encoding="application/x-tex">\\bar\\nu_e p</annotation></math>, is key.';

describe('parseRichText — MathML', () => {
  it('keeps MathML elements and their safe attributes', () => {
    const nodes = parseRichText(IBD);
    const math = elements(nodes).find((n) => n.tag === 'math');
    assert.equal(math.ns, 'mathml');
    assert.deepEqual(math.attrs, { display: 'inline' });
    assert.ok(tags(nodes).includes('msub'));
    assert.ok(tags(nodes).includes('mover'));
    assert.equal(elements(nodes).find((n) => n.tag === 'mover').attrs.accent, 'true');
  });

  it('drops annotations, which hold the TeX source', () => {
    assert.ok(!tags(parseRichText(IBD)).includes('annotation'));
    assert.doesNotMatch(plainText(IBD), /bar/);
  });

  it('keeps the text around the formula', () => {
    const nodes = parseRichText(IBD);
    assert.equal(nodes[0].text, 'Inverse beta decay (IBD), ');
    assert.equal(nodes.at(-1).text, ', is key.');
  });

  it('drops attributes that are not on the list, or have odd values', () => {
    const nodes = parseRichText(
      '<math onclick="x()" href="javascript:x()" display="block"><mi mathvariant="url(x)">a</mi></math>'
    );
    const [math] = elements(nodes);
    assert.deepEqual(math.attrs, { display: 'block' });
    assert.deepEqual(elements(nodes)[1].attrs, {});
  });

  it('strips namespace prefixes', () => {
    assert.deepEqual(tags(parseRichText('<mml:math><mml:mi>x</mml:mi></mml:math>')), [
      'math',
      'mi',
    ]);
  });

  it('closes elements left open, and drops a tag cut off at the end', () => {
    const nodes = parseRichText('We find <math><mi>ν</mi><mo>+</m');
    assert.deepEqual(tags(nodes), ['math', 'mi', 'mo']);
    assert.equal(plainText('We find <math><mi>ν</mi><mo>+</m'), 'We find ν+');
  });

  it('ignores MathML pieces outside <math>', () => {
    assert.deepEqual(tags(parseRichText('a <mi>b</mi> c')), []);
    assert.equal(plainText('a <mi>b</mi> c'), 'a b c');
  });
});

describe('parseRichText — other markup', () => {
  it('keeps <sub>, <sup> and <i> as HTML', () => {
    const nodes = parseRichText('H<sub>0</sub> and <i>in situ</i>');
    assert.deepEqual(
      elements(nodes).map((n) => [n.ns, n.tag]),
      [
        ['html', 'sub'],
        ['html', 'i'],
      ]
    );
  });

  it('leaves unknown tags, like <script>, as plain text', () => {
    const nodes = parseRichText('a <script>alert(1)</script> b <img src=x onerror=y>');
    assert.deepEqual(tags(nodes), []);
    assert.equal(plainText('a <script>alert(1)</script> b'), 'a <script>alert(1)</script> b');
  });

  it('never keeps attributes on HTML tags', () => {
    const [sub] = elements(parseRichText('<sub onclick="x()" class="y">2</sub>'));
    assert.deepEqual(sub.attrs, {});
  });

  it('decodes entities into text', () => {
    assert.equal(decodeEntities('a &lt; b &amp;&amp; &#957; &#x3bd;'), 'a < b && ν ν');
    assert.equal(plainText('m &lt; 5 GeV'), 'm < 5 GeV');
  });

  it('leaves a lone < alone', () => {
    assert.equal(plainText('m < 5 GeV and x<y'), 'm < 5 GeV and x<y');
  });

  it('unwraps LaTeX text commands outside $…$', () => {
    assert.equal(
      plainText('leptogenesis \\textit{via} a \\emph{modular} model, 5\\%'),
      'leptogenesis via a modular model, 5%'
    );
  });
});

describe('latexToMathml', () => {
  it('builds sub- and superscripts', () => {
    const math = latexToMathml('m_\\nu^2');
    assert.deepEqual(tags([math]), ['math', 'msubsup', 'mi', 'mi', 'mn']);
  });

  it('reads groups and Greek letters', () => {
    assert.equal(plainText('$\\bar{\\nu}_e + p \\to e^+ n$'), 'ν¯e+p→e+n');
  });

  it('maps symbols and keeps numbers together', () => {
    assert.equal(plainText('$B\\simeq 5.357$'), 'B≃5.357');
    assert.equal(plainText('$m \\lesssim 10^{-3}\\,\\mathrm{eV}$'), 'm≲10−3 eV');
  });

  it('builds fractions and roots', () => {
    assert.deepEqual(tags([latexToMathml('\\frac{1}{2}')]), ['math', 'mfrac', 'mn', 'mn']);
    assert.deepEqual(tags([latexToMathml('\\sqrt{s}')]), ['math', 'msqrt', 'mi']);
    assert.deepEqual(tags([latexToMathml('\\sqrt[3]{x}')]), ['math', 'mroot', 'mi', 'mn']);
  });

  it('sets fonts and text', () => {
    const math = latexToMathml('\\mathrm{GeV}');
    assert.equal(elements([math])[1].attrs.mathvariant, 'normal');
    assert.equal(plainText('$E_\\text{th}$'), 'Eth');
  });

  it('keeps unknown commands readable', () => {
    assert.equal(plainText('$\\frobnicate x$'), '\\frobnicatex');
  });

  it('marks $$…$$ as display maths', () => {
    const [math] = parseRichText('$$x$$');
    assert.equal(math.attrs.display, 'block');
  });

  it('ignores escaped dollars', () => {
    assert.equal(plainText('costs \\$5 and \\$6'), 'costs $5 and $6');
  });

  it('does not treat $ inside MathML as LaTeX', () => {
    const nodes = parseRichText('<math><mtext>$x$</mtext></math>');
    assert.equal(plainText('<math><mtext>$x$</mtext></math>'), '$x$');
    assert.deepEqual(tags(nodes), ['math', 'mtext']);
  });
});
