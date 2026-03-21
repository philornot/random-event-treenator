/**
 * @fileoverview UI controller.
 * Handles the form, generates the tree, manages tooltips and exports.
 * Depends on globals from i18n.js and tree.js being loaded first.
 */

// ── DOM refs ─────────────────────────────────────────────────────────────────
var titleInput    = document.getElementById('titleInput');
var trialCountEl  = document.getElementById('trialCount');
var trialHintEl   = document.getElementById('trialHint');
var outcomesTable = document.getElementById('outcomesTable');
var sumDisplay    = document.getElementById('sumDisplay');
var generateBtn   = document.getElementById('generateBtn');
var errorMsg      = document.getElementById('errorMsg');
var treeWrap      = document.getElementById('treeWrap');
var treeTitleEl   = document.getElementById('treeTitle');
var svgContainer  = document.getElementById('svgContainer');
var exportBtns    = document.getElementById('exportBtns');
var tooltip       = document.getElementById('tooltip');

// ── State ─────────────────────────────────────────────────────────────────────
/** @type {number} Current number of trials (= tree depth). */
var trials = 3;
var MIN_TRIALS = 1;
var MAX_TRIALS = 5;

/** @type {string} SVG markup of the last generated tree (for export). */
var lastSvgStr = '';

/** @type {number} Auto-increment counter for outcome row IDs. */
var rowIdCounter = 0;

// ── Initialise i18n ───────────────────────────────────────────────────────────
applyLang();
document.getElementById('langBtn').textContent = t('langBtnLabel');
document.getElementById('langBtn').addEventListener('click', function() {
  toggleLang();
});

// ── Trial stepper ─────────────────────────────────────────────────────────────
document.getElementById('incBtn').addEventListener('click', function() {
  if (trials < MAX_TRIALS) { trials++; renderTrialUI(); }
});
document.getElementById('decBtn').addEventListener('click', function() {
  if (trials > MIN_TRIALS) { trials--; renderTrialUI(); }
});

/**
 * Updates the stepper display and shows a size warning for large trees.
 */
function renderTrialUI() {
  trialCountEl.textContent = trials;
  var hints = ['', '', '', t('trialWarnLarge'), t('trialWarnVeryLarge')];
  trialHintEl.textContent = hints[trials] || '';
}

// ── Outcomes table ────────────────────────────────────────────────────────────

/**
 * Appends a new outcome row to the outcomes table.
 *
 * @param {string} [label=''] - Pre-filled label value.
 * @param {string} [prob='']  - Pre-filled probability value.
 */
function addOutcome(label, prob) {
  label = label || '';
  prob  = prob  || '';

  var id  = ++rowIdCounter;
  var div = document.createElement('div');
  div.className  = 'outcome-row';
  div.dataset.id = id;

  var lblInput  = document.createElement('input');
  lblInput.type        = 'text';
  lblInput.className   = 'lbl-input';
  lblInput.placeholder = t('labelPlaceholder');
  lblInput.maxLength   = 6;
  lblInput.value       = label;

  var probInput  = document.createElement('input');
  probInput.type        = 'text';
  probInput.className   = 'prob-input';
  probInput.placeholder = t('probPlaceholder');
  probInput.value       = prob;
  probInput.addEventListener('input', updateSum);

  var delBtn = document.createElement('button');
  delBtn.className   = 'del-btn';
  delBtn.title       = '✕';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', function() {
    div.remove();
    updateSum();
  });

  div.appendChild(lblInput);
  div.appendChild(probInput);
  div.appendChild(delBtn);
  outcomesTable.appendChild(div);
  updateSum();
}

document.getElementById('addOutcomeBtn').addEventListener('click', function() {
  addOutcome();
});

/**
 * Recalculates the probability sum and updates the indicator element.
 */
function updateSum() {
  var rows   = outcomesTable.querySelectorAll('.outcome-row');
  var probs  = [];
  for (var i = 0; i < rows.length; i++) {
    probs.push(parseProb(rows[i].querySelector('.prob-input').value));
  }

  if (!rows.length || probs.some(isNaN)) {
    sumDisplay.textContent = '—';
    sumDisplay.className   = 'bad';
    return;
  }

  var sum = probs.reduce(function(a, b) { return a + b; }, 0);
  var displayStr = sum.toFixed(10).replace(/\.?0+$/, '');
  sumDisplay.textContent = displayStr;
  sumDisplay.className   = Math.abs(sum - 1) < 1e-9 ? 'ok' : 'bad';
}

// ── Default values ────────────────────────────────────────────────────────────
addOutcome('H', '1/2');
addOutcome('T', '1/2');
titleInput.value = 'Flipping a fair coin 3 times';

// ── Generate ──────────────────────────────────────────────────────────────────
generateBtn.addEventListener('click', generate);
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});

/**
 * Validates form inputs, builds the tree data model, renders the SVG,
 * and wires up export buttons and tooltips.
 */
function generate() {
  errorMsg.textContent = '';

  var title   = titleInput.value.trim() || 'Probability Tree';
  var rows    = Array.from(outcomesTable.querySelectorAll('.outcome-row'));

  // Validation
  if (rows.length < 2) { errorMsg.textContent = t('errMinOutcomes'); return; }

  var outcomes = rows.map(function(r) {
    return {
      label: r.querySelector('.lbl-input').value.trim(),
      prob:  r.querySelector('.prob-input').value.trim(),
    };
  });

  if (outcomes.some(function(o) { return !o.label; })) {
    errorMsg.textContent = t('errNoLabel'); return;
  }

  var floats = outcomes.map(function(o) { return parseProb(o.prob); });
  if (floats.some(isNaN)) {
    errorMsg.textContent = t('errInvalidProb'); return;
  }
  var sum = floats.reduce(function(a,b){ return a+b; }, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    errorMsg.textContent = t('errSumNot1'); return;
  }

  // Build & render
  var tree   = buildTreeData(outcomes, trials);
  lastSvgStr = buildSVG({ title: title, root: tree });

  treeTitleEl.textContent = title;
  svgContainer.innerHTML  = lastSvgStr;
  exportBtns.classList.remove('hidden');

  attachTooltips();
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

/**
 * Attaches hover listeners to all non-root node circles in the rendered SVG.
 * Shows a floating tooltip with the cumulative probability of the path.
 */
function attachTooltips() {
  var circles = svgContainer.querySelectorAll('circle[data-path]');

  circles.forEach(function(circle) {
    circle.addEventListener('mouseenter', function() {
      var labels  = circle.dataset.path.split(',');
      var cumProb = circle.dataset.cumProb;
      var pathStr = labels.join(' → ');
      // Interpolate the tooltip template (supports {path} and {prob} tokens)
      var msg = t('tooltipProb')
        .replace('{path}', pathStr)
        .replace('{prob}', cumProb);
      tooltip.textContent = msg;
      tooltip.classList.remove('hidden');
    });

    circle.addEventListener('mouseleave', function() {
      tooltip.classList.add('hidden');
    });

    circle.addEventListener('mousemove', function(e) {
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

document.getElementById('downloadSvgBtn').addEventListener('click', function() {
  if (!lastSvgStr) return;
  triggerDownload(
    new Blob([lastSvgStr], { type: 'image/svg+xml' }),
    'stochastic-tree.svg'
  );
});

document.getElementById('downloadPngBtn').addEventListener('click', function() {
  if (!lastSvgStr) return;
  svgToPngBlob(lastSvgStr, function(blob) {
    triggerDownload(blob, 'stochastic-tree.png');
  });
});

document.getElementById('copyImgBtn').addEventListener('click', function() {
  if (!lastSvgStr) return;
  var btn = document.getElementById('copyImgBtn');

  svgToPngBlob(lastSvgStr, function(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      errorMsg.textContent = t('errClipboard');
      return;
    }
    navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]).then(function() {
      var original = btn.textContent;
      btn.textContent = t('copiedOk');
      btn.classList.add('flash');
      setTimeout(function() {
        btn.textContent = t('copyImg');
        btn.classList.remove('flash');
      }, 1800);
    }).catch(function() {
      errorMsg.textContent = t('errClipboard');
    });
  });
});

/**
 * Converts an SVG string to a PNG Blob at 2× resolution.
 *
 * @param {string}   svgStr  - Raw SVG markup.
 * @param {function} callback - Called with the resulting PNG Blob.
 */
function svgToPngBlob(svgStr, callback) {
  var blob = new Blob([svgStr], { type: 'image/svg+xml' });
  var url  = URL.createObjectURL(blob);
  var img  = new Image();

  img.onload = function() {
    var scale  = 2;
    var canvas = document.createElement('canvas');
    canvas.width  = img.width  * scale;
    canvas.height = img.height * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(callback, 'image/png');
  };

  img.src = url;
}

/**
 * Creates a temporary anchor and triggers a browser file download.
 *
 * @param {Blob}   blob     - File data to download.
 * @param {string} filename - Suggested filename.
 */
function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}