/**
 * seasons.test.js — Tests for the seasonal decorations (seasons.js, themes.js, pixelart.js).
 * Run with: node --test tests/seasons.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../site/assets/js/config.js';
import { themeFor, previewTheme } from '../site/assets/js/seasons.js';
import { THEMES } from '../site/assets/js/themes.js';
import {
  spriteProblems,
  spriteRuns,
  spriteSize,
  spriteDataUrl,
  mirrorSprite,
} from '../site/assets/js/pixelart.js';

const on = (y, m, d) => new Date(y, m - 1, d, 12);

const SEASONS = {
  enabled: true,
  dayWindow: 2,
  base: [
    { theme: 'winter', from: '12-21', to: '03-19' },
    { theme: 'autumn', from: '09-22', to: '12-20' },
  ],
  days: [
    { theme: 'dark-matter', date: '10-31' },
    { theme: 'new-year', date: '01-01' },
  ],
};

describe('themeFor', () => {
  it('gives the season', () => {
    assert.equal(themeFor(on(2026, 10, 10), SEASONS), 'autumn');
    assert.equal(themeFor(on(2027, 2, 1), SEASONS), 'winter');
    assert.equal(themeFor(on(2026, 7, 1), SEASONS), null);
  });

  it('handles seasons that wrap past New Year, inclusive at both ends', () => {
    assert.equal(themeFor(on(2026, 12, 21), SEASONS), 'winter');
    assert.equal(themeFor(on(2027, 3, 19), SEASONS), 'winter');
    assert.equal(themeFor(on(2027, 3, 20), SEASONS), null);
    assert.equal(themeFor(on(2026, 12, 20), SEASONS), 'autumn');
  });

  it('lets a physics day win within its window', () => {
    for (const d of [29, 30, 31]) assert.equal(themeFor(on(2026, 10, d), SEASONS), 'dark-matter');
    assert.equal(themeFor(on(2026, 11, 2), SEASONS), 'dark-matter');
    assert.equal(themeFor(on(2026, 10, 28), SEASONS), 'autumn');
    assert.equal(themeFor(on(2026, 11, 3), SEASONS), 'autumn');
  });

  it('finds a physics day across New Year', () => {
    assert.equal(themeFor(on(2026, 12, 30), SEASONS), 'new-year');
    assert.equal(themeFor(on(2027, 1, 3), SEASONS), 'new-year');
  });

  it('is off when disabled', () => {
    assert.equal(themeFor(on(2026, 10, 31), { ...SEASONS, enabled: false }), null);
  });

  it('uses CONFIG.seasons by default', () => {
    assert.equal(themeFor(on(2026, 10, 31)), 'dark-matter');
    assert.equal(themeFor(on(2026, 10, 1)), 'autumn');
  });
});

describe('previewTheme', () => {
  it('reads ?season= for known themes and none', () => {
    assert.equal(previewTheme('?season=autumn'), 'autumn');
    assert.equal(previewTheme('?x=1&season=dark-matter'), 'dark-matter');
    assert.equal(previewTheme('?season=none'), 'none');
  });

  it('ignores unknown themes and other parameters', () => {
    assert.equal(previewTheme('?season=toString'), null);
    assert.equal(previewTheme('?season=<script>'), null);
    assert.equal(previewTheme(''), null);
  });
});

describe('themes', () => {
  it('every theme in CONFIG.seasons has art', () => {
    const named = [...CONFIG.seasons.base, ...CONFIG.seasons.days].map((s) => s.theme);
    for (const name of named) assert.ok(THEMES[name], `${name} has no entry in themes.js`);
  });

  it('every sprite is valid, and the scenes are well formed', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      assert.deepEqual(spriteProblems(`${name}.strip`, theme.strip), []);
      if (theme.corners)
        assert.deepEqual(spriteProblems(`${name}.corners`, theme.corners.sprite), []);
      for (const part of ['banner', 'margin']) {
        const scene = theme[part];
        if (!scene) continue;
        assert.ok(scene.sprites.length > 0 && scene.count > 0, `${name}.${part}`);
        assert.ok(
          scene.scales.every((k) => Number.isInteger(k) && k > 0),
          `${name}.${part} scales`
        );
        for (const [i, sprite] of scene.sprites.entries()) {
          assert.deepEqual(spriteProblems(`${name}.${part}[${i}]`, sprite), []);
          assert.ok(
            ['fall', 'float', 'twinkle'].includes(sprite.motion ?? scene.motion),
            `${name}.${part}[${i}] motion`
          );
        }
      }
    }
  });
});

describe('pixelart', () => {
  const sprite = { rows: ['.ab', 'bb.'], palette: { a: '#112233', b: '#445566' } };

  it('reports bad rows, keys and colours', () => {
    assert.deepEqual(spriteProblems('s', sprite), []);
    assert.match(
      spriteProblems('s', { rows: ['ab', 'a'], palette: { a: '#000000', b: '#ffffff' } })[0],
      /row 1: 1 px, expected 2/
    );
    assert.match(
      spriteProblems('s', { rows: ['ax'], palette: { a: '#000000' } })[0],
      /"x" not in palette/
    );
    assert.match(spriteProblems('s', { rows: ['a'], palette: { a: 'red' } })[0], /not #rrggbb/);
    assert.match(spriteProblems('s', { rows: [], palette: {} })[0], /no rows/);
  });

  it('merges runs of one colour and skips transparency', () => {
    assert.deepEqual(spriteRuns(sprite), [
      { x: 1, y: 0, w: 1, colour: '#112233' },
      { x: 2, y: 0, w: 1, colour: '#445566' },
      { x: 0, y: 1, w: 2, colour: '#445566' },
    ]);
    assert.deepEqual(spriteSize(sprite), { width: 3, height: 2 });
  });

  it('mirrors left to right', () => {
    assert.deepEqual(mirrorSprite(sprite).rows, ['ba.', '.bb']);
    assert.equal(mirrorSprite(sprite).palette, sprite.palette);
  });

  it('draws an SVG data URL at the scale, and refuses invalid sprites', () => {
    const svg = decodeURIComponent(spriteDataUrl(sprite, 4).split(',')[1]);
    assert.match(svg, /width="12" height="8"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.equal(svg.match(/<rect /g).length, 3);
    assert.throws(() => spriteDataUrl({ rows: ['a'], palette: { a: 'x"/><script>' } }));
  });
});
