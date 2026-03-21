/**
 * @fileoverview Probability-tree data model and SVG renderer.
 *
 * Public API:
 *  parseProb(s)            — parse probability string to float
 *  gcd(a, b)               — Euclidean GCD
 *  parseFracParts(s)       — parse to [numerator, denominator]
 *  mulProbStrings(probs)   — multiply fractions, return simplified string
 *  probToLatex(s)          — convert fraction string to LaTeX \dfrac{n}{d}
 *  buildTreeData(...)      — build recursive node structure
 *  buildSVG(treeData, forExport) — render tree to SVG markup string
 *
 * Reads globals: levelColors, probTextColor (from colors.js)
 */

'use strict';

/* ── Fraction arithmetic ───────────────────────────────────────────────── */

/**
 * Euclidean greatest common divisor.
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { var tmp = b; b = a % b; a = tmp; }
  return a || 1;
}

/**
 * Parses a probability string to a simplified [numerator, denominator] pair.
 * Supports fractions ("1/6") and decimals ("0.5").
 *
 * @param {string} s
 * @returns {[number, number]}
 */
function parseFracParts(s) {
  var t = (s || '').trim();
  if (t.indexOf('/') !== -1) {
    var parts = t.split('/');
    var n = parseFloat(parts[0].trim());
    var d = parseFloat(parts[1].trim());
    if (!d) return [0, 1];
    var g = gcd(Math.round(Math.abs(n)), Math.round(Math.abs(d)));
    return [n / g, d / g];
  }
  var dec = parseFloat(t);
  if (isNaN(dec)) return [0, 1];
  /* Find minimal denominator up to 10 000 */
  for (var den = 1; den <= 10000; den++) {
    var num = Math.round(dec * den);
    if (Math.abs(num / den - dec) < 1e-9) {
      var g2 = gcd(Math.abs(num), den);
      return [num / g2, den / g2];
    }
  }
  return [Math.round(dec * 10000), 10000];
}

/**
 * Parses a probability string to a float (for validation).
 *
 * @param {string} s
 * @returns {number} float or NaN
 */
function parseProb(s) {
  var t = (s || '').trim();
  if (!t) return NaN;
  if (t.indexOf('/') !== -1) {
    var p = t.split('/');
    var d = Number(p[1]);
    return d ? Number(p[0]) / d : NaN;
  }
  return parseFloat(t);
}

/**
 * Multiplies a list of probability strings and returns a simplified fraction
 * as a display string (e.g. "1/8", "3/4", "1").
 *
 * @param {string[]} probs
 * @returns {string}
 */
function mulProbStrings(probs) {
  if (!probs.length) return '1';
  var num = 1, den = 1;
  for (var i = 0; i < probs.length; i++) {
    var fp = parseFracParts(probs[i]);
    num *= fp[0];
    den *= fp[1];
    var g = gcd(Math.round(Math.abs(num)), Math.round(Math.abs(den)));
    num /= g;
    den /= g;
  }
  num = Math.round(num);
  den = Math.round(den);
  return den === 1 ? String(num) : num + '/' + den;
}

/**
 * Converts a fraction string to a LaTeX expression.
 * "1/2"  → "\\dfrac{1}{2}"
 * "0.25" → "0.25" (kept as-is)
 * "1"    → "1"
 *
 * @param {string} s
 * @returns {string} LaTeX string
 */
function probToLatex(s) {
  s = (s || '').trim();
  var slash = s.indexOf('/');
  if (slash > 0 && slash < s.length - 1) {
    var n = s.substring(0, slash).trim();
    var d = s.substring(slash + 1).trim();
    if (n && d && isFinite(Number(n)) && isFinite(Number(d))) {
      return '\\dfrac{' + n + '}{' + d + '}';
    }
  }
  return s;
}

/* ── Tree builder ──────────────────────────────────────────────────────── */

/**
 * Recursively builds the uniform probability tree node structure.
 *
 * @param {Array<{label:string, prob:string}>} outcomes - All possible outcomes.
 * @param {number} depth   - Remaining levels to build.
 * @param {string} [label='·'] - Label for this node.
 * @param {string} [prob='']   - Probability string on the incoming edge.
 * @returns {{ label:string, probability:string, children:object[] }}
 */
function buildTreeData(outcomes, depth, label, prob) {
  label = (label !== undefined) ? label : '·';
  prob  = (prob  !== undefined) ? prob  : '';
  var node = { label: label, probability: prob, children: [] };
  if (depth === 0) return node;
  for (var i = 0; i < outcomes.length; i++) {
    node.children.push(
      buildTreeData(outcomes, depth - 1, outcomes[i].label, outcomes[i].prob)
    );
  }
  return node;
}

/* ── SVG layout ────────────────────────────────────────────────────────── */

var LEAF_W  = 120;   /* pixels allocated per leaf */
var LEVEL_H = 160;   /* pixels between depth levels */
var R       = 26;    /* node circle radius */
var PAD     = 70;    /* outer canvas padding */

/**
 * Counts leaf nodes in a subtree and stores the count as node._w.
 * @param {object} node
 * @returns {number}
 */
function countLeaves(node) {
  if (!node.children || !node.children.length) { node._w = 1; return 1; }
  var s = 0;
  for (var i = 0; i < node.children.length; i++) s += countLeaves(node.children[i]);
  node._w = s;
  return s;
}

/**
 * Assigns pixel x-position (_x) and depth index (_d) to every node.
 *
 * @param {object} node
 * @param {number} xStart - Left boundary of this node's column.
 * @param {number} totalW - Total width allocated to this node.
 * @param {number} depth
 */
function assignPositions(node, xStart, totalW, depth) {
  node._x = xStart + totalW / 2;
  node._d = depth;
  if (!node.children || !node.children.length) return;
  var cx = xStart;
  for (var i = 0; i < node.children.length; i++) {
    var cw = (node.children[i]._w / node._w) * totalW;
    assignPositions(node.children[i], cx, cw, depth + 1);
    cx += cw;
  }
}

/**
 * Returns the maximum depth in the tree.
 * @param {object} node
 * @returns {number}
 */
function getMaxDepth(node) {
  if (!node.children || !node.children.length) return node._d;
  var m = 0;
  for (var i = 0; i < node.children.length; i++) {
    var d = getMaxDepth(node.children[i]);
    if (d > m) m = d;
  }
  return m;
}

/**
 * Converts node layout coordinates to SVG pixel [x, y].
 * @param {object} node
 * @returns {[number, number]}
 */
function toXY(node) {
  return [node._x + PAD, node._d * LEVEL_H + PAD + R];
}

/* ── SVG builder ───────────────────────────────────────────────────────── */

/**
 * Builds the complete SVG markup string for a probability tree.
 *
 * Non-root node circles carry `data-path` and `data-cum-prob` attributes
 * used by the tooltip system in ui.js.
 *
 * In display mode (forExport=false) each probability label is rendered via a
 * `<foreignObject>` element so KaTeX can produce a proper fraction glyph.
 * In export mode (forExport=true) a plain `<text>` element is used instead.
 *
 * Reads globals: levelColors, probTextColor (colors.js)
 *
 * @param {{ title:string, root:object }} treeData
 * @param {boolean} [forExport=false]
 * @returns {string} SVG markup.
 */
function buildSVG(treeData, forExport) {
  forExport = forExport || false;

  countLeaves(treeData.root);
  var totalW = Math.max(treeData.root._w * LEAF_W, 200);
  assignPositions(treeData.root, 0, totalW, 0);

  var maxD = getMaxDepth(treeData.root);
  var svgW = totalW + 2 * PAD;
  var svgH = (maxD + 1) * LEVEL_H + 2 * PAD;

  var edges = '';
  var nodes = '';

  /* Background colour for probability label patch */
  var isDark   = document.documentElement.dataset.theme === 'dark';
  var patchCol = isDark ? 'rgba(10,13,20,0.90)' : 'rgba(250,248,244,0.92)';

  /**
   * Recursively emits SVG for edges (with prob label) then node circles.
   *
   * @param {object}   node
   * @param {string[]} pathLabels - Labels from root to this node (exclusive).
   * @param {string[]} pathProbs  - Edge prob strings from root to this node.
   */
  function traverse(node, pathLabels, pathProbs) {
    var xy   = toXY(node);
    var nx   = xy[0], ny = xy[1];
    var isLeaf = !node.children || !node.children.length;
    var color  = getColorForDepth(node._d);

    /* Children: draw edges and recurse */
    for (var i = 0; i < (node.children || []).length; i++) {
      var child = node.children[i];
      var cxy   = toXY(child);
      var cx    = cxy[0], cy = cxy[1];

      /* Edge line */
      edges += '<line x1="' + nx + '" y1="' + ny +
               '" x2="' + cx + '" y2="' + cy + '"' +
               ' stroke="' + color.stroke + '" stroke-width="1.8"' +
               ' stroke-linecap="round" opacity="0.55"/>';

      /*
       * Label at 40% along the edge toward the child — centred on the line.
       * The background rect covers the edge at that point (standard style).
       */
      var lx = nx + (cx - nx) * 0.40;
      var ly = ny + (cy - ny) * 0.40;

      if (forExport) {
        /* Plain text label for export */
        edges += '<rect x="' + (lx - 22) + '" y="' + (ly - 11) +
                 '" width="44" height="22" rx="4"' +
                 ' fill="' + patchCol + '"/>';
        edges += '<text x="' + lx + '" y="' + ly +
                 '" text-anchor="middle" dominant-baseline="central"' +
                 ' font-family="JetBrains Mono, monospace"' +
                 ' font-size="12" font-weight="500"' +
                 ' fill="' + probTextColor + '">' + child.probability + '</text>';
      } else {
        /* foreignObject for KaTeX rendering */
        var foW = 72, foH = 36;
        edges += '<rect x="' + (lx - foW / 2) + '" y="' + (ly - foH / 2) +
                 '" width="' + foW + '" height="' + foH + '" rx="6"' +
                 ' fill="' + patchCol + '"/>';
        var safeProb = child.probability
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        edges += '<foreignObject x="' + (lx - foW / 2) +
                 '" y="' + (ly - foH / 2) +
                 '" width="' + foW + '" height="' + foH + '">' +
                 '<div xmlns="http://www.w3.org/1999/xhtml"' +
                 ' class="prob-katex"' +
                 ' data-prob="' + safeProb + '"' +
                 ' style="color:' + probTextColor + '">' +
                 '</div></foreignObject>';
      }

      traverse(child,
               pathLabels.concat([child.label]),
               pathProbs.concat([child.probability]));
    }

    /* Node circle */
    var dataAttrs = '';
    if (pathLabels.length > 0) {
      var safeLabels = pathLabels.map(function (l) {
        return l.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      }).join('\u2192');   /* → separator */
      var cumProb = mulProbStrings(pathProbs);
      dataAttrs = ' data-path="' + safeLabels + '"' +
                  ' data-cum-prob="' + cumProb + '"' +
                  ' style="cursor:pointer"';
    }

    var nColor = getColorForDepth(node._d);
    nodes += '<circle cx="' + nx + '" cy="' + ny + '" r="' + R + '"' +
             ' fill="' + nColor.fill + '"' +
             ' stroke="' + nColor.stroke + '" stroke-width="2.2"' +
             dataAttrs + '/>';

    var fs = node.label.length <= 2 ? 16 :
             node.label.length <= 4 ? 13 : 10;
    nodes += '<text x="' + nx + '" y="' + ny +
             '" text-anchor="middle" dominant-baseline="central"' +
             ' font-family="EB Garamond, Georgia, serif"' +
             ' font-size="' + fs + '" font-weight="600"' +
             ' fill="' + nColor.stroke + '"' +
             ' pointer-events="none">' + node.label + '</text>';
  }

  traverse(treeData.root, [], []);

  return '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '"' +
         ' width="' + svgW + '" height="' + svgH + '"' +
         ' xmlns="http://www.w3.org/2000/svg"' +
         ' xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
         '<rect width="' + svgW + '" height="' + svgH + '"' +
         ' fill="' + (isDark ? '#0d1117' : '#faf8f4') + '" rx="8"/>' +
         edges + nodes +
         '</svg>';
}