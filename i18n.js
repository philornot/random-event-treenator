/**
 * @fileoverview Internationalisation module.
 * Defines all UI strings in English and Polish and exposes helpers
 * to switch the active language and re-render text across the page.
 */

/** @type {'en'|'pl'} Currently active language. */
var currentLang = 'en';

/**
 * All UI strings keyed by language.
 * @type {Object.<string, Object.<string, string>>}
 */
var TRANSLATIONS = {
  en: {
    title:             'Stochastic Tree Generator',
    subtitle:          'Define outcomes manually — no AI required.',
    langBtnLabel:      '🇵🇱 Polski',
    experimentLabel:   'Experiment',
    titleLabel:        'Title',
    titlePlaceholder:  'e.g. Flipping a fair coin 3 times',
    trialsLabel:       'Number of trials',
    trialWarnLarge:    '⚠ large tree',
    trialWarnVeryLarge:'⚠ very large tree',
    outcomesLabel:     'Outcomes & Probabilities',
    outcomesHint:      'Probabilities can be fractions (1/6) or decimals. They must sum to 1.',
    colLabel:          'Label',
    colProb:           'Probability',
    addOutcome:        '+ Add outcome',
    sumLabel:          'Sum of probabilities:',
    generate:          'Generate Tree',
    downloadSvg:       '⬇ Download SVG',
    downloadPng:       '⬇ Download PNG',
    copyImg:           '📋 Copy Image',
    copiedOk:          '✓ Copied!',
    tooltipProb:       'P({path}) = {prob}',
    labelPlaceholder:  'e.g. H',
    probPlaceholder:   'e.g. 1/2',
    errMinOutcomes:    'Add at least 2 outcomes.',
    errNoLabel:        'Every outcome needs a label.',
    errInvalidProb:    'All probabilities must be valid numbers or fractions.',
    errSumNot1:        'Probabilities must sum exactly to 1.',
    errClipboard:      'Clipboard not supported in this browser.',
  },
  pl: {
    title:             'Generator Drzewa Stochastycznego',
    subtitle:          'Definiuj wyniki ręcznie — bez sztucznej inteligencji.',
    langBtnLabel:      '🇬🇧 English',
    experimentLabel:   'Eksperyment',
    titleLabel:        'Tytuł',
    titlePlaceholder:  'np. Rzut symetryczną monetą 3 razy',
    trialsLabel:       'Liczba prób',
    trialWarnLarge:    '⚠ duże drzewo',
    trialWarnVeryLarge:'⚠ bardzo duże drzewo',
    outcomesLabel:     'Wyniki i Prawdopodobieństwa',
    outcomesHint:      'Prawdopodobieństwa mogą być ułamkami (1/6) lub liczbami dziesiętnymi. Muszą sumować się do 1.',
    colLabel:          'Etykieta',
    colProb:           'Prawdopodobieństwo',
    addOutcome:        '+ Dodaj wynik',
    sumLabel:          'Suma prawdopodobieństw:',
    generate:          'Generuj drzewo',
    downloadSvg:       '⬇ Pobierz SVG',
    downloadPng:       '⬇ Pobierz PNG',
    copyImg:           '📋 Kopiuj obraz',
    copiedOk:          '✓ Skopiowano!',
    tooltipProb:       'P({path}) = {prob}',
    labelPlaceholder:  'np. O',
    probPlaceholder:   'np. 1/2',
    errMinOutcomes:    'Dodaj co najmniej 2 wyniki.',
    errNoLabel:        'Każdy wynik musi mieć etykietę.',
    errInvalidProb:    'Wszystkie prawdopodobieństwa muszą być poprawnymi liczbami lub ułamkami.',
    errSumNot1:        'Prawdopodobieństwa muszą sumować się dokładnie do 1.',
    errClipboard:      'Schowek nie jest obsługiwany w tej przeglądarce.',
  },
};

/**
 * Returns the translation string for a given key in the active language,
 * falling back to English if not found.
 *
 * @param {string} key - Translation key.
 * @returns {string} Translated string.
 */
function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
      || TRANSLATIONS['en'][key]
      || key;
}

/**
 * Applies the current language to all elements with a [data-i18n] attribute
 * and updates placeholder attributes where applicable.
 */
function applyLang() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Input placeholders defined via data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // Update dynamic placeholders in the outcomes table
  document.querySelectorAll('.lbl-input').forEach(function(el) {
    el.placeholder = t('labelPlaceholder');
  });
  document.querySelectorAll('.prob-input').forEach(function(el) {
    el.placeholder = t('probPlaceholder');
  });

  // Update title input placeholder
  var titleInput = document.getElementById('titleInput');
  if (titleInput) titleInput.placeholder = t('titlePlaceholder');
}

/**
 * Toggles the active language between 'en' and 'pl' and re-applies all labels.
 */
function toggleLang() {
  currentLang = currentLang === 'en' ? 'pl' : 'en';
  document.getElementById('langBtn').textContent = t('langBtnLabel');
  applyLang();
}