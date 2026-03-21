/**
 * @fileoverview Main UI controller.
 *
 * Handles:
 *  - Theme detection and toggle
 *  - Language toggle
 *  - Trial stepper (unlimited)
 *  - Outcome rows with KaTeX probability rendering on blur
 *  - Tree generation and display
 *  - Zoom / pan on the SVG container
 *  - Tooltip on node hover
 *  - Personalise modal (per-level color pickers)
 *  - SVG, PNG, and clipboard export
 *
 * Depends on globals from: i18n.js, colors.js, tree.js
 */

'use strict';

/* ── DOM references ───────────────────────────────────────────────────── */
var titleInput    = document.getElementById('titleInput');
var trialCountEl  = document.getElementById('trialCount');
var trialHintEl   = document.getElementById('trialHint');
var outcomesTable = document.getElementById('outcomesTable');
var sumDisplay    = document.getElementById('sumDisplay');
var generateBtn   = document.getElementById('generateBtn');
var errorMsg      = document.getElementById('errorMsg');
var treeToolbar   = document.getElementById('treeToolbar');
var treeTitleEl   = document.getElementById('treeTitle');
var svgContainer  = document.getElementById('svgContainer');
var treeEmpty     = document.getElementById('treeEmpty');
var tooltip       = document.getElementById('tooltip');
var modalOverlay  = document.getElementById('modal-overlay');
var modalBody     = document.getElementById('modal-body');

/* ── State ─────────────────────────────────────────────────────────────── */
var trials       = 3;
var rowIdCounter = 0;

/** Last generated tree data object (used for re-render after color changes). */
var lastTreeData = null;

/* ── Zoom / pan state ──────────────────────────────────────────────────── */
var zoom = 1, panX = 0, panY = 0;
var isPanning = false, dragStartX = 0, dragStartY = 0;

/* ── Theme ─────────────────────────────────────────────────────────────── */
var isDark = document.documentElement.dataset.theme === 'dark';

/** Updates the theme icon to reflect the current mode. */
function updateThemeIcon() {
  var icon = document.getElementById('themeIcon');
  icon.className = isDark ? 'ph ph-moon' : 'ph ph-sun';
}

document.getElementById('themeBtn').addEventListener('click', function () {
  isDark = !isDark;
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  updateThemeIcon();
  if (lastTreeData) displayTree(lastTreeData);
});

/* Keep in sync with OS setting changes */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
  /* Only follow OS if the user hasn't manually toggled */
  isDark = e.matches;
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  updateThemeIcon();
  if (lastTreeData) displayTree(lastTreeData);
});

/* ── Language ──────────────────────────────────────────────────────────── */
document.getElementById('langBtn').addEventListener('click', toggleLang);

/* ── Initialise labels & colours ───────────────────────────────────────── */
applyLang();
document.getElementById('langLabel').textContent = t('langLabel');
updateThemeIcon();
initColors(trials, isDark);

/* ── Trial stepper ─────────────────────────────────────────────────────── */
document.getElementById('incBtn').addEventListener('click', function () {
  trials++;
  updateTrialUI();
});

document.getElementById('decBtn').addEventListener('click', function () {
  if (trials > 1) { trials--; updateTrialUI(); }
});

/* Allow typing directly into the trial count display */
trialCountEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); trialCountEl.blur(); }
});

trialCountEl.addEventListener('blur', function () {
  var v = parseInt(trialCountEl.textContent.trim(), 10);
  trials = (!isNaN(v) && v >= 1) ? v : Math.max(1, trials);
  updateTrialUI();
});

/**
 * Syncs the stepper display with the current `trials` value and
 * shows a size warning for large trees.
 */
function updateTrialUI() {
  trialCountEl.textContent = trials;
  var numLeaves = 1;
  var rows = outcomesTable.querySelectorAll('.outcome-row');
  for (var i = 0; i < trials; i++) numLeaves *= rows.length || 2;
  trialHintEl.textContent = numLeaves > 256 ? t('trialWarn') : '';
}

/* ── Outcome rows ──────────────────────────────────────────────────────── */
document.getElementById('addOutcomeBtn').addEventListener('click', function () {
  addOutcome('', '');
});

/**
 * Fills every outcome row with an equal probability of 1/n,
 * where n is the current number of rows.
 */
document.getElementById('autoProbBtn').addEventListener('click', function () {
  var rows = Array.from(outcomesTable.querySelectorAll('.outcome-row'));
  var n    = rows.length;
  if (n < 1) return;

  /* Build the fraction string: simplify using gcd */
  var g       = gcd(1, n);
  var numStr  = String(1 / g);
  var denStr  = String(n / g);
  var fracStr = (n === 1) ? '1' : '1/' + denStr;

  rows.forEach(function (row) {
    var input   = row.querySelector('.prob-input');
    var display = row.querySelector('.prob-rendered');
    input.value = fracStr;

    /* Re-render the KaTeX display if it exists */
    if (display) {
      display.classList.remove('hidden');
      input.classList.add('hidden');
      if (typeof katex !== 'undefined') {
        try {
          katex.render(probToLatex(fracStr), display, {
            throwOnError: false, displayMode: false,
          });
        } catch (_) { display.textContent = fracStr; }
      } else {
        display.textContent = fracStr;
      }
    }
  });

  updateSum();
});

/**
 * Appends a new outcome row with a KaTeX-enabled probability field.
 *
 * @param {string} label - Pre-filled label value.
 * @param {string} prob  - Pre-filled probability string.
 */
function addOutcome(label, prob) {
  label = label || '';
  prob  = prob  || '';

  var id  = ++rowIdCounter;
  var row = document.createElement('div');
  row.className  = 'outcome-row';
  row.dataset.id = id;

  /* Label input */
  var lblInput       = document.createElement('input');
  lblInput.type      = 'text';
  lblInput.className = 'lbl-input';
  lblInput.placeholder = t('colLabel');
  lblInput.maxLength = 8;
  lblInput.value     = label;

  /* Probability field (input + rendered display) */
  var probField = buildProbField(prob);

  /* Delete button */
  var delBtn       = document.createElement('button');
  delBtn.className = 'del-btn';
  delBtn.innerHTML = '<i class="ph ph-trash"></i>';
  delBtn.title     = 'Remove';
  delBtn.addEventListener('click', function () {
    row.remove();
    updateSum();
    updateTrialUI();
  });

  row.appendChild(lblInput);
  row.appendChild(probField.wrap);
  row.appendChild(delBtn);
  outcomesTable.appendChild(row);

  if (prob) probField.renderDisplay();
  updateSum();
  updateTrialUI();
}

/**
 * Creates a probability input with a KaTeX-rendered display that
 * replaces the raw input when focus is lost.
 *
 * @param {string} initialValue
 * @returns {{ wrap: HTMLElement, input: HTMLInputElement, renderDisplay: Function }}
 */
function buildProbField(initialValue) {
  var wrap     = document.createElement('div');
  wrap.className = 'prob-field';

  var input       = document.createElement('input');
  input.type      = 'text';
  input.className = 'prob-input';
  input.placeholder = t('colProb');
  input.value     = initialValue || '';
  input.setAttribute('inputmode', 'decimal');

  var display       = document.createElement('div');
  display.className = 'prob-rendered hidden';

  /* Clicking on the rendered display activates the input */
  display.addEventListener('click', function () {
    display.classList.add('hidden');
    input.classList.remove('hidden');
    input.focus();
  });

  input.addEventListener('input', updateSum);

  input.addEventListener('blur', function () {
    renderDisplay();
    updateSum();
  });

  function renderDisplay() {
    var val = input.value.trim();
    if (!val || isNaN(parseProb(val))) {
      display.classList.add('hidden');
      input.classList.remove('hidden');
      return;
    }
    display.classList.remove('hidden');
    input.classList.add('hidden');
    if (typeof katex !== 'undefined') {
      try {
        katex.render(probToLatex(val), display, {
          throwOnError: false,
          displayMode: false,
          strict: false,
        });
      } catch (_) {
        display.textContent = val;
      }
    } else {
      display.textContent = val;
    }
  }

  wrap.appendChild(input);
  wrap.appendChild(display);
  return { wrap: wrap, input: input, renderDisplay: renderDisplay };
}

/* ── Sum display ───────────────────────────────────────────────────────── */

/**
 * Recomputes the probability sum and updates the indicator element.
 * Renders the result as a KaTeX fraction if possible.
 */
function updateSum() {
  var rows  = Array.from(outcomesTable.querySelectorAll('.outcome-row'));
  var probs = rows.map(function (r) {
    return parseProb(r.querySelector('.prob-input').value);
  });

  if (!rows.length || probs.some(isNaN)) {
    sumDisplay.textContent = '—';
    sumDisplay.className   = 'bad mono';
    return;
  }

  /* Compute exact fractional sum */
  var numS = 0, denL = 1;
  rows.forEach(function (r) {
    var fp = parseFracParts(r.querySelector('.prob-input').value);
    numS   = numS * fp[1] + fp[0] * denL;
    denL   = denL * fp[1];
    var g  = gcd(Math.round(Math.abs(numS)), Math.round(Math.abs(denL)));
    numS  /= g; denL /= g;
  });

  var isOk = Math.abs(numS / denL - 1) < 1e-9;
  sumDisplay.className = isOk ? 'ok mono' : 'bad mono';

  var latex = (Math.round(denL) === 1)
    ? String(Math.round(numS))
    : '\\dfrac{' + Math.round(numS) + '}{' + Math.round(denL) + '}';

  if (typeof katex !== 'undefined') {
    try {
      katex.render(latex, sumDisplay, { throwOnError: false, displayMode: false });
    } catch (_) {
      sumDisplay.textContent = (numS / denL).toFixed(6).replace(/\.?0+$/, '');
    }
  } else {
    sumDisplay.textContent = (numS / denL).toFixed(6).replace(/\.?0+$/, '');
  }
}

/* ── Pre-fill defaults ─────────────────────────────────────────────────── */
addOutcome('H', '1/2');
addOutcome('T', '1/2');
titleInput.value = 'Flipping a fair coin 3 times';

/* ── Generate ──────────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', generate);
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});

/**
 * Validates form inputs, builds the tree, renders the SVG,
 * and shows the toolbar.
 */
function generate() {
  errorMsg.textContent = '';

  var title = (titleInput.value.trim()) || 'Probability Tree';
  var rows  = Array.from(outcomesTable.querySelectorAll('.outcome-row'));

  if (rows.length < 2) { errorMsg.textContent = t('errMinOutcomes'); return; }

  var outcomes = rows.map(function (r) {
    return {
      label: r.querySelector('.lbl-input').value.trim(),
      prob:  r.querySelector('.prob-input').value.trim(),
    };
  });

  if (outcomes.some(function (o) { return !o.label; })) {
    errorMsg.textContent = t('errNoLabel'); return;
  }

  var floats = outcomes.map(function (o) { return parseProb(o.prob); });
  if (floats.some(isNaN)) {
    errorMsg.textContent = t('errInvalidProb'); return;
  }

  var sum = floats.reduce(function (a, b) { return a + b; }, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    errorMsg.textContent = t('errSumNot1'); return;
  }

  /* Ensure we have colours for all levels */
  ensureLevelColors(trials, isDark);

  var root = buildTreeData(outcomes, trials);
  lastTreeData = { title: title, root: root };
  displayTree(lastTreeData);
}

/**
 * Renders `treeData` into the SVG container and wires up all interactions.
 *
 * @param {{ title:string, root:object }} treeData
 */
function displayTree(treeData) {
  treeTitleEl.textContent = treeData.title;
  svgContainer.innerHTML  = buildSVG(treeData, false);
  treeEmpty.style.display = 'none';
  treeToolbar.classList.remove('hidden');

  /* KaTeX post-render: fill all foreignObject prob-katex elements */
  svgContainer.querySelectorAll('.prob-katex').forEach(function (el) {
    var prob = el.dataset.prob;
    if (!prob) return;
    if (typeof katex !== 'undefined') {
      try {
        katex.render(probToLatex(prob), el, {
          throwOnError: false,
          displayMode: false,
          strict: false,
        });
      } catch (_) {
        el.textContent = prob;
      }
    } else {
      el.textContent = prob;
    }
  });

  attachTooltips();
  resetZoomPan();
}

/* ── Tooltips ──────────────────────────────────────────────────────────── */

/**
 * Attaches mouse-enter/leave/move listeners to all non-root node circles
 * to display the cumulative probability of the path to that node.
 */
function attachTooltips() {
  var circles = svgContainer.querySelectorAll('circle[data-path]');
  circles.forEach(function (circle) {
    circle.addEventListener('mouseenter', function () {
      var path    = circle.dataset.path;
      var cumProb = circle.dataset.cumProb;
      /* Build KaTeX string for cumulative probability */
      var latex = probToLatex(cumProb);
      var msg = t('tooltipPath')
        .replace('{path}', path)
        .replace('{prob}', cumProb);

      if (typeof katex !== 'undefined') {
        try {
          /* Render: "P(A → B → C) = \dfrac{1}{8}" */
          var pathPart = 'P(' + path + ') = ';
          var rendered = document.createElement('span');
          katex.render(latex, rendered, { throwOnError: false, displayMode: false });
          tooltip.innerHTML = '';
          tooltip.appendChild(document.createTextNode(pathPart));
          tooltip.appendChild(rendered);
        } catch (_) {
          tooltip.textContent = msg;
        }
      } else {
        tooltip.textContent = msg;
      }
      tooltip.classList.remove('hidden');
    });

    circle.addEventListener('mouseleave', function () {
      tooltip.classList.add('hidden');
    });

    circle.addEventListener('mousemove', function (e) {
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
  });
}

/* ── Zoom / Pan ────────────────────────────────────────────────────────── */

svgContainer.addEventListener('wheel', function (e) {
  e.preventDefault();
  var rect   = svgContainer.getBoundingClientRect();
  var mx     = e.clientX - rect.left;
  var my     = e.clientY - rect.top;
  var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  panX  = mx + factor * (panX - mx);
  panY  = my + factor * (panY - my);
  zoom *= factor;
  zoom  = Math.min(Math.max(zoom, 0.08), 8);
  applyTransform();

  /*
   * If the user is simultaneously dragging (pan + scroll at once), the
   * stored dragStart becomes stale the moment panX/panY change here.
   * Recalculate it so the next mousemove continues from the correct offset
   * instead of snapping the view back.
   */
  if (isPanning) {
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
  }
}, { passive: false });

svgContainer.addEventListener('mousedown', function (e) {
  if (e.button !== 0) return;
  isPanning  = true;
  dragStartX = e.clientX - panX;
  dragStartY = e.clientY - panY;
  svgContainer.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', function (e) {
  if (!isPanning) return;
  panX = e.clientX - dragStartX;
  panY = e.clientY - dragStartY;
  applyTransform();
});

window.addEventListener('mouseup', function () {
  if (isPanning) {
    isPanning = false;
    svgContainer.style.cursor = 'grab';
  }
});

/** Applies the current pan/zoom transform to the SVG element. */
function applyTransform() {
  var svg = svgContainer.querySelector('svg');
  if (!svg) return;
  svg.style.transform       = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
  svg.style.transformOrigin = '0 0';
}

/** Resets zoom and pan to the initial state. */
function resetZoomPan() {
  zoom = 1; panX = 0; panY = 0;
  applyTransform();
}

document.getElementById('resetViewBtn').addEventListener('click', resetZoomPan);

/* ── Personalise Modal ─────────────────────────────────────────────────── */

document.getElementById('personalizeBtn').addEventListener('click', openModal);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('applyColorsBtn').addEventListener('click', applyModalColors);

modalOverlay.addEventListener('click', function (e) {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) closeModal();
});

/** Opens the personalise modal and populates it with current level colours. */
function openModal() {
  buildModalContent();
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/** Closes the personalise modal. */
function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/**
 * Builds the modal body with one colour-row per tree level plus a row
 * for the probability-label text colour.
 */
function buildModalContent() {
  ensureLevelColors(trials, isDark);
  var html = '';

  /* Level colour rows */
  html += '<span class="color-section-title">' + t('colorsLevel') + ' colors</span>';
  for (var d = 0; d <= trials; d++) {
    var color = getColorForDepth(d);
    var label = d === 0 ? t('colorsRoot') : t('colorsLevel') + ' ' + d;
    html += '<div class="color-row">' +
              '<span class="color-row-label">' + label + '</span>' +
              '<label class="color-picker-wrap">' +
                '<span>' + t('colorsBorder') + '</span>' +
                '<input type="color" class="color-swatch-input level-stroke-input"' +
                  ' data-depth="' + d + '" value="' + color.stroke + '">' +
              '</label>' +
              '<label class="color-picker-wrap">' +
                '<span>' + t('colorsFill') + '</span>' +
                '<input type="color" class="color-swatch-input level-fill-input"' +
                  ' data-depth="' + d + '" value="' + color.fill + '">' +
              '</label>' +
            '</div>';
  }

  /* Probability text colour */
  html += '<span class="color-section-title">' + t('colorsProbText') + '</span>';
  html += '<div class="color-row">' +
            '<span class="color-row-label">' + t('colorsProbText') + '</span>' +
            '<label class="color-picker-wrap">' +
              '<span>' + t('colorsText') + '</span>' +
              '<input type="color" class="color-swatch-input" id="probTextColorInput"' +
                ' value="' + probTextColor + '">' +
            '</label>' +
            '<span></span>' +
          '</div>';

  modalBody.innerHTML = html;
}

/**
 * Reads colour inputs from the modal, updates `levelColors` and
 * `probTextColor`, then re-renders the tree if one exists.
 */
function applyModalColors() {
  modalBody.querySelectorAll('.level-stroke-input').forEach(function (inp) {
    var d = parseInt(inp.dataset.depth, 10);
    ensureLevelColors(d, isDark);
    levelColors[d].stroke = inp.value;
  });
  modalBody.querySelectorAll('.level-fill-input').forEach(function (inp) {
    var d = parseInt(inp.dataset.depth, 10);
    ensureLevelColors(d, isDark);
    levelColors[d].fill = inp.value;
  });
  var ptInp = document.getElementById('probTextColorInput');
  if (ptInp) probTextColor = ptInp.value;

  if (lastTreeData) displayTree(lastTreeData);
  closeModal();
}

/* ── Export ────────────────────────────────────────────────────────────── */

document.getElementById('downloadSvgBtn').addEventListener('click', function () {
  if (!lastTreeData) return;
  var svgStr = buildExportSVG(false);
  triggerDownload(new Blob([svgStr], { type: 'image/svg+xml' }), 'stochastic-tree.svg');
});

document.getElementById('downloadPngBtn').addEventListener('click', function () {
  if (!lastTreeData) return;
  exportPng(function (blob) {
    if (blob) triggerDownload(blob, 'stochastic-tree.png');
  });
});

document.getElementById('copyImgBtn').addEventListener('click', function () {
  if (!lastTreeData) return;
  var btn = document.getElementById('copyImgBtn');
  exportPng(function (blob) {
    if (!blob) { errorMsg.textContent = t('errClipboard'); return; }
    if (!navigator.clipboard || !window.ClipboardItem) {
      errorMsg.textContent = t('errClipboard'); return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(function () {
        var orig = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-check"></i><span>' + t('copiedOk') + '</span>';
        btn.classList.add('flash');
        setTimeout(function () {
          btn.innerHTML = orig;
          btn.classList.remove('flash');
        }, 1800);
      })
      .catch(function () { errorMsg.textContent = t('errClipboard'); });
  });
});

/**
 * Builds an export-ready SVG string:
 *  - Transparent background (no background rect)
 *  - Plain-text fraction labels (no foreignObject / KaTeX)
 *  - Exact viewBox tight to tree content (no wasted space)
 *
 * @param {boolean} [solidBg=false]
 *   Pass true to add a white/dark solid background rect (e.g. for JPEG).
 * @returns {string} SVG markup.
 */
function buildExportSVG(solidBg) {
  return buildSVG(lastTreeData, true, !solidBg);
}

/**
 * Renders the full tree as a sharp PNG Blob.
 *
 * Strategy: take the plain-text SVG (exact tree dimensions, transparent bg),
 * draw it onto a canvas at EXPORT_SCALE× — this avoids capturing the
 * clipped / panned / zoomed viewport and guarantees the full tree is included
 * at high resolution.
 *
 * @param {function(Blob|null):void} callback
 */
function exportPng(callback) {
  var svgStr = buildExportSVG(false);   /* transparent background */

  /* Read actual pixel dimensions from the SVG width/height attributes */
  var wMatch = svgStr.match(/\bwidth="(\d+(?:\.\d+)?)"/);
  var hMatch = svgStr.match(/\bheight="(\d+(?:\.\d+)?)"/);
  if (!wMatch || !hMatch) { callback(null); return; }

  var svgW   = parseFloat(wMatch[1]);
  var svgH   = parseFloat(hMatch[1]);
  var SCALE  = 3;   /* 3× = crisp even on a 2× retina print */

  var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var img  = new Image();

  img.onload = function () {
    var canvas    = document.createElement('canvas');
    canvas.width  = Math.ceil(svgW * SCALE);
    canvas.height = Math.ceil(svgH * SCALE);

    var ctx = canvas.getContext('2d');
    /* Transparent by default — no fillRect needed */
    ctx.scale(SCALE, SCALE);
    ctx.drawImage(img, 0, 0, svgW, svgH);

    URL.revokeObjectURL(url);
    canvas.toBlob(callback, 'image/png');
  };

  img.onerror = function () {
    URL.revokeObjectURL(url);
    callback(null);
  };

  img.src = url;
}

/**
 * Triggers a browser file download for the given Blob.
 *
 * @param {Blob}   blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Missing i18n key: colorsText (used in modal) ─────────────────────── */
if (!TRANSLATIONS['en']['colorsText']) TRANSLATIONS['en']['colorsText'] = 'Text';
if (!TRANSLATIONS['pl']['colorsText']) TRANSLATIONS['pl']['colorsText'] = 'Tekst';