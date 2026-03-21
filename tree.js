/**
 * @fileoverview Probability tree data model and SVG renderer.
 *
 * Exposes:
 *  - parseProb(s)          — parse probability string to float
 *  - buildTreeData(...)    — build tree node structure
 *  - buildSVG(treeData)    — render tree to SVG string
 *
 * Each non-root node in the SVG carries:
 *  data-path      — comma-separated path of labels from root to this node
 *  data-cum-prob  — cumulative probability as a simplified fraction string
 */

// ── Fraction arithmetic ──────────────────────────────────────────────────────

/**
 * Euclidean GCD of two non-negative integers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { var tmp = b; b = a % b; a = tmp; }
  return a;
}

/**
 * Parses a probability string (fraction or decimal) into [numerator, denominator].
 * Simplifies the fraction before returning.
 *
 * @param {string} s - e.g. "1/6", "0.5", "2/3"
 * @returns {[number, number]} Simplified [num, den].
 */
function parseFracParts(s) {
  var t = s.trim();
  if (t.indexOf('/') !== -1) {
    var parts = t.split('/');
    var n = parseInt(parts[0].trim(), 10);
    var d = parseInt(parts[1].trim(), 10);
    if (!d) return [0, 1];
    var g = gcd(Math.abs(n), Math.abs(d));
    return [n / g, d / g];
  }
  var dec = parseFloat(t);
  if (isNaN(dec)) return [0, 1];
  // Find the smallest denominator that reproduces the decimal exactly (up to 10000)
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
 * Multiplies a list of probability strings and returns a simplified fraction string.
 * Returns "1" if the list is empty.
 *
 * @param {string[]} probs - Array of probability strings.
 * @returns {string} e.g. "1/8", "1/36", "1"
 */
function mulProbStrings(probs) {
  if (!probs.length) return '1';
  var num = 1, den = 1;
  for (var i = 0; i < probs.length; i++) {
    var parts = parseFracParts(probs[i]);
    num *= parts[0];
    den *= parts[1];
    var g = gcd(Math.abs(num), den);
    num /= g;
    den /= g;
  }
  return den === 1 ? String(num) : num + '/' + den;
}

/**
 * Parses a probability string to a float (for validation in ui.js).
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

// ── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Recursively builds a uniform tree node structure.
 * Every node fans out to the same set of outcomes at each level.
 *
 * @param {Array<{label:string, prob:string}>} outcomes - Outcome definitions.
 * @param {number} depth   - Remaining levels to build.
 * @param {string} [label='·'] - Label for this node.
 * @param {string} [prob='']   - Probability string on the edge leading to this node.
 * @returns {object} Node: { label, probability, children[] }
 */
function buildTreeData(outcomes, depth, label, prob) {
  label = label !== undefined ? label : '·';
  prob  = prob  !== undefined ? prob  : '';
  var node = { label: label, probability: prob, children: [] };
  if (depth === 0) return node;
  for (var i = 0; i < outcomes.length; i++) {
    node.children.push(
      buildTreeData(outcomes, depth - 1, outcomes[i].label, outcomes[i].prob)
    );
  }
  return node;
}

// ── SVG layout constants ─────────────────────────────────────────────────────

/** Pixels allocated per leaf node (horizontal spacing). */
var LEAF_W  = 120;
/** Vertical distance between depth levels in pixels. */
var LEVEL_H = 155;
/** Node circle radius in pixels. */
var R       = 26;
/** Canvas padding in pixels. */
var PAD     = 64;

// ── SVG layout helpers ───────────────────────────────────────────────────────

/**
 * Counts leaf nodes in a subtree; stores result as node._w.
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
 * Assigns pixel x-position (_x) and depth (_d) to every node.
 * @param {object} node
 * @param {number} xStart - Left boundary of the column allocated to this node.
 * @param {number} totalW - Width allocated to this node.
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
 * Returns the maximum depth found in the tree.
 * @param {object} node
 * @returns {number}
 */
function getMaxDepth(node) {
  if (!node.children || !node.children.length) return node._d;
  var max = 0;
  for (var i = 0; i < node.children.length; i++) {
    var d = getMaxDepth(node.children[i]);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Converts node layout coordinates to SVG pixel [x, y].
 * @param {object} node
 * @returns {[number, number]}
 */
function toXY(node) {
  return [node._x + PAD, node._d * LEVEL_H + PAD + R];
}

// ── SVG renderer ─────────────────────────────────────────────────────────────

/**
 * Builds the complete SVG markup for a probability tree.
 * Non-root nodes receive data-path and data-cum-prob attributes for tooltip use.
 *
 * @param {{title:string, root:object}} treeData
 * @returns {string} SVG markup string.
 */
function buildSVG(treeData) {
  countLeaves(treeData.root);
  var totalW = Math.max(treeData.root._w * LEAF_W, 200);
  assignPositions(treeData.root, 0, totalW, 0);

  var maxD = getMaxDepth(treeData.root);
  var svgW = totalW + 2 * PAD;
  var svgH = (maxD + 1) * LEVEL_H + 2 * PAD;

  var edges = '';
  var nodes = '';

  /**
   * Recursively emits SVG edges (with probability badges) then node circles.
   * @param {object} node
   * @param {string[]} pathLabels - Labels of ancestors (not including this node).
   * @param {string[]} pathProbs  - Prob strings of edges traversed so far.
   */
  function traverse(node, pathLabels, pathProbs) {
    var xy   = toXY(node);
    var nx   = xy[0], ny = xy[1];
    var isLeaf = !node.children || !node.children.length;

    for (var i = 0; i < (node.children || []).length; i++) {
      var child   = node.children[i];
      var cxy     = toXY(child);
      var cx      = cxy[0], cy = cxy[1];

      // Edge line
      edges += '<line x1="' + nx + '" y1="' + ny + '" x2="' + cx + '" y2="' + cy + '"'
             + ' stroke="#2d4159" stroke-width="2" stroke-linecap="round"/>';

      // Probability badge — offset to the right of the edge direction
      var dx  = cx - nx, dy = cy - ny;
      var len = Math.sqrt(dx*dx + dy*dy) || 1;
      var lx  = (nx + cx) / 2 + (dy / len) * 22;
      var ly  = (ny + cy) / 2 - (dx / len) * 22;

      edges += '<rect x="' + (lx-30) + '" y="' + (ly-13) + '" width="60" height="22" rx="5"'
             + ' fill="#111827" opacity=".94"/>'
             + '<text x="' + lx + '" y="' + (ly+6) + '" text-anchor="middle"'
             + ' font-family="JetBrains Mono,monospace" font-size="12" font-weight="500"'
             + ' fill="#ffa657">' + child.probability + '</text>';

      traverse(child,
               pathLabels.concat([child.label]),
               pathProbs.concat([child.probability]));
    }

    // Node circle
    var stroke = isLeaf ? '#ffa657' : '#58a6ff';
    var fill   = isLeaf ? '#1a1006' : '#061526';

    var dataAttrs = '';
    if (pathLabels.length > 0) {
      // Escape labels for attribute safety
      var safeLabels = pathLabels.map(function(l) {
        return l.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      }).join(',');
      var cumProb = mulProbStrings(pathProbs);
      dataAttrs = ' data-path="' + safeLabels + '" data-cum-prob="' + cumProb + '"'
                + ' style="cursor:pointer;"';
    }

    nodes += '<circle cx="' + nx + '" cy="' + ny + '" r="' + R + '"'
           + ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.5"'
           + dataAttrs + '/>';

    var fs = node.label.length <= 2 ? 14 : node.label.length <= 4 ? 11 : 9;
    nodes += '<text x="' + nx + '" y="' + (ny + fs/2 - 1) + '" text-anchor="middle"'
           + ' font-family="Outfit,sans-serif" font-size="' + fs + '" font-weight="700"'
           + ' fill="' + stroke + '" pointer-events="none">' + node.label + '</text>';
  }

  traverse(treeData.root, [], []);

  return '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '"'
       + ' width="' + svgW + '" height="' + svgH + '"'
       + ' xmlns="http://www.w3.org/2000/svg">'
       + '<rect width="' + svgW + '" height="' + svgH + '" fill="#0d1117" rx="8"/>'
       + edges
       + nodes
       + '</svg>';
}