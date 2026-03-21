/**
 * @fileoverview Level color management.
 *
 * Uses a curated palette of perceptually distinct, aesthetically refined
 * colours for each depth level of the probability tree.
 * Cycles through the palette if the tree is deeper than the palette length.
 *
 * Exposes globals: levelColors, probTextColor,
 *                  ensureLevelColors, initColors, getColorForDepth, hslToHex
 */

'use strict';

/**
 * @typedef  {Object} LevelColor
 * @property {string} stroke - Hex colour for the node border and text.
 * @property {string} fill   - Hex colour for the node background.
 */

/**
 * Curated palettes — each entry is [stroke, fill] for that level.
 * Dark-mode fills are very dark tints of the stroke hue.
 * Light-mode fills are very light tints of the stroke hue.
 *
 * @type {{ dark: string[][], light: string[][] }}
 */
var PALETTE = {
  dark: [
    /* 0 root  */ ['#7da7d4', '#0b1520'],
    /* 1       */ ['#e07b65', '#1e0d0a'],
    /* 2       */ ['#5bba8f', '#071712'],
    /* 3       */ ['#c9a84c', '#1a1508'],
    /* 4       */ ['#a07fc8', '#130d1b'],
    /* 5       */ ['#5fa8c8', '#081519'],
    /* 6       */ ['#d4836e', '#1c0e0b'],
    /* 7       */ ['#74b87a', '#0b1710'],
  ],
  light: [
    /* 0 root  */ ['#2a6099', '#deeaf7'],
    /* 1       */ ['#b8432a', '#fce8e4'],
    /* 2       */ ['#1e7a52', '#d8f2e7'],
    /* 3       */ ['#8c6a10', '#faf0d0'],
    /* 4       */ ['#6040a0', '#ede4f8'],
    /* 5       */ ['#1a6f8a', '#d4eef7'],
    /* 6       */ ['#9e3d28', '#f9e2db'],
    /* 7       */ ['#2d6e34', '#d5f0d8'],
  ],
};

/**
 * Colour entries indexed by tree depth (populated by ensureLevelColors).
 * @type {LevelColor[]}
 */
var levelColors = [];

/** Colour used for the probability fraction text on edges. */
var probTextColor = '#b8700a';

/* ── Tiny HSL helper (kept for external callers if any) ────────────────── */

/**
 * Converts HSL to a CSS hex colour string.
 * @param {number} h - Hue [0,360].
 * @param {number} s - Saturation [0,100].
 * @param {number} l - Lightness [0,100].
 * @returns {string}
 */
function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  var r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    var hue2rgb = function (p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  var hex = function (x) { return Math.round(x * 255).toString(16).padStart(2, '0'); };
  return '#' + hex(r) + hex(g) + hex(b);
}

/* ── Color management ──────────────────────────────────────────────────── */

/**
 * Ensures `levelColors` has entries for depths 0 through `maxDepth`.
 * Cycles through the palette if maxDepth exceeds palette length.
 *
 * @param {number}  maxDepth
 * @param {boolean} isDark
 */
function ensureLevelColors(maxDepth, isDark) {
  var pal = isDark ? PALETTE.dark : PALETTE.light;
  while (levelColors.length <= maxDepth) {
    var entry = pal[levelColors.length % pal.length];
    levelColors.push({ stroke: entry[0], fill: entry[1] });
  }
  probTextColor = isDark ? '#c8922a' : '#8c5a08';
}

/**
 * Resets and regenerates all level colours from the curated palette.
 *
 * @param {number}  maxDepth
 * @param {boolean} isDark
 */
function initColors(maxDepth, isDark) {
  levelColors = [];
  ensureLevelColors(maxDepth, isDark);
}

/**
 * Returns the colour entry for a given depth, clamped to the last entry.
 *
 * @param {number} depth
 * @returns {LevelColor}
 */
function getColorForDepth(depth) {
  var idx = Math.min(depth, levelColors.length - 1);
  return levelColors[idx] || { stroke: '#7da7d4', fill: '#0b1520' };
}