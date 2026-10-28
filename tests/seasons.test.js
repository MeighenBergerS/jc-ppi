/**
 * seasons.test.js — Tests for the seasonal decorations (seasons.js, themes.js, pixelart.js).
 * Run with: node --test tests/seasons.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../site/assets/js/config.js';
import { themeFor, previewTheme, dayDate } from '../site/assets/js/seasons.js';
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
    assert.equal(themeFor(on(2026, 12, 4)), 'pauli');
    assert.equal(themeFor(on(2026, 12, 6)), 'pauli');
    assert.equal(themeFor(on(2026, 12, 7)), 'autumn');
    assert.equal(themeFor(on(2026, 12, 21)), 'winter');
    assert.equal(themeFor(on(2027, 3, 19)), 'winter');
    assert.equal(themeFor(on(2027, 2, 11)), 'women-in-science');
    assert.equal(themeFor(on(2027, 3, 16)), 'pi-day');
    assert.equal(themeFor(on(2027, 3, 17)), 'winter');
    assert.equal(themeFor(on(2027, 3, 20)), 'spring');
    assert.equal(themeFor(on(2027, 6, 20)), 'spring');
    assert.equal(themeFor(on(2027, 4, 1)), 'april-fools');
    assert.equal(themeFor(on(2027, 3, 31)), 'spring');
    assert.equal(themeFor(on(2027, 4, 2)), 'spring');
    assert.equal(themeFor(on(2027, 5, 18)), 'day-of-light');
    assert.equal(themeFor(on(2027, 6, 7)), 'oscillations');
    assert.equal(themeFor(on(2027, 6, 9)), 'spring');
    assert.equal(themeFor(on(2027, 6, 12)), 'neutrinos-detected');
    assert.equal(themeFor(on(2027, 6, 21)), 'summer');
    assert.equal(themeFor(on(2027, 6, 29)), 'asteroid-day');
    assert.equal(themeFor(on(2027, 7, 1)), 'asteroid-day');
    assert.equal(themeFor(on(2027, 7, 2)), 'higgs');
    assert.equal(themeFor(on(2027, 8, 12)), 'perseids');
    assert.equal(themeFor(on(2027, 9, 21)), 'summer');
    assert.equal(themeFor(on(2026, 10, 6)), 'nobel');
    assert.equal(themeFor(on(2026, 10, 4)), 'nobel');
    assert.equal(themeFor(on(2026, 10, 9)), 'autumn');
  });

  it("lets a day's own window replace dayWindow", () => {
    const one = { ...SEASONS, days: [{ theme: 'x', date: '04-01', window: 0 }] };
    assert.equal(themeFor(on(2027, 4, 1), one), 'x');
    assert.equal(themeFor(on(2027, 4, 2), one), null);
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
      if (theme.tagline) assert.ok(theme.tagline.length < 60, `${name} tagline is short`);
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
        if (scene.seconds) assert.ok(scene.seconds[0] > 0 && scene.seconds[1] >= scene.seconds[0]);
        for (const [i, sprite] of scene.sprites.entries()) {
          assert.deepEqual(spriteProblems(`${name}.${part}[${i}]`, sprite), []);
          if (sprite.label) {
            assert.ok(typeof sprite.label === 'string' && sprite.label.length <= 80, sprite.label);
          }
          assert.ok(
            ['fall', 'zip', 'float', 'twinkle', 'still'].includes(sprite.motion ?? scene.motion),
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

describe('dayDate', () => {
  const nobel = CONFIG.seasons.days.find((d) => d.theme === 'nobel');
  const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

  it('the Nobel rule gives the real announcement days, 2018–2025', () => {
    const announced = {
      2018: 2,
      2019: 8,
      2020: 6,
      2021: 5,
      2022: 4,
      2023: 3,
      2024: 8,
      2025: 7,
    };
    for (const [year, day] of Object.entries(announced)) {
      assert.deepEqual(ymd(dayDate(nobel, Number(year))), [Number(year), 10, day], year);
      assert.equal(dayDate(nobel, Number(year)).getDay(), 2, `${year} is a Tuesday`);
    }
  });

  it('a per-year override wins over the rule', () => {
    const day = { ...nobel, overrides: { 2031: '10-14' } };
    assert.deepEqual(ymd(dayDate(day, 2031)), [2031, 10, 14]);
    assert.deepEqual(ymd(dayDate(day, 2030)), ymd(dayDate(nobel, 2030)));
  });

  it('a fixed date is just that date', () => {
    assert.deepEqual(ymd(dayDate({ date: '10-31' }, 2026)), [2026, 10, 31]);
  });
});
