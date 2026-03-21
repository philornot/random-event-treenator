/**
 * @fileoverview Internationalisation module.
 * Defines all UI strings and exposes helpers to switch language and
 * re-render text across the page.
 */

'use strict';

/** @type {'en'|'pl'} Currently active language. */
var currentLang = 'en';

/**
 * All UI strings keyed by language then translation key.
 * @type {Object.<string, Object.<string, string>>}
 */
var TRANSLATIONS = {
  en: {
    /* Header */
    title:              'Stochastic Tree Generator',
    subtitle:           'Define outcomes manually — no AI required.',
    langLabel:          'Polski',
    personalizeBtn:     'Personalise',
    /* Experiment card */
    experimentLabel:    'Experiment',
    titleLabel:         'Title',
    titlePlaceholder:   'e.g. Rolling a fair die 3 times',
    trialsLabel:        'Number of trials',
    trialWarn:          '⚠ tree may be very large',
    /* Outcomes card */
    outcomesLabel:      'Outcomes & Probabilities',
    outcomesHint:       'Probabilities may be fractions (1/6) or decimals. They must sum to 1.',
    colLabel:           'Label',
    colProb:            'Probability',
    addOutcome:         'Add outcome',
    autoProb:           'Equal probabilities',
    sumLabel:           'Sum of probabilities:',
    /* Buttons */
    generate:           'Generate Tree',
    resetView:          'Reset view',
    downloadSvg:        'SVG',
    downloadPng:        'PNG',
    copyImg:            'Copy',
    copiedOk:           'Copied!',
    /* Tree area */
    treeEmpty:          'Generate a tree to see it here.',
    zoomHint:           'Scroll to zoom · Drag to pan',
    /* Personalise modal */
    personalizeTitle:   'Personalise Colors',
    applyColors:        'Apply Colors',
    colorsRoot:         'Root',
    colorsLevel:        'Level',
    colorsBorder:       'Border',
    colorsFill:         'Fill',
    colorsProbText:     'Probability text',
    /* Tooltip */
    tooltipPath:        'P({path}) = {prob}',
    tooltipRoot:        'Root node',
    /* Errors */
    errMinOutcomes:     'Please add at least 2 outcomes.',
    errNoLabel:         'Every outcome must have a label.',
    errInvalidProb:     'All probabilities must be valid numbers or fractions.',
    errSumNot1:         'Probabilities must sum exactly to 1.',
    errClipboard:       'Clipboard write not supported in this browser.',
  },
  pl: {
    title:              'Generator Drzewa Stochastycznego',
    subtitle:           'Definiuj wyniki ręcznie — bez sztucznej inteligencji.',
    langLabel:          'English',
    personalizeBtn:     'Personalizuj',
    experimentLabel:    'Eksperyment',
    titleLabel:         'Tytuł',
    titlePlaceholder:   'np. Rzut symetryczną kostką 3 razy',
    trialsLabel:        'Liczba prób',
    trialWarn:          '⚠ drzewo może być bardzo duże',
    outcomesLabel:      'Wyniki i Prawdopodobieństwa',
    outcomesHint:       'Prawdopodobieństwa mogą być ułamkami (1/6) lub dziesiętne. Muszą sumować się do 1.',
    colLabel:           'Etykieta',
    colProb:            'Prawdopodobieństwo',
    addOutcome:         'Dodaj wynik',
    autoProb:           'Równe prawdopodobieństwa',
    sumLabel:           'Suma prawdopodobieństw:',
    generate:           'Generuj drzewo',
    resetView:          'Resetuj widok',
    downloadSvg:        'SVG',
    downloadPng:        'PNG',
    copyImg:            'Kopiuj',
    copiedOk:           'Skopiowano!',
    treeEmpty:          'Wygeneruj drzewo, aby je zobaczyć.',
    zoomHint:           'Kółko myszy — przybliżenie · Przeciągnij — przesunięcie',
    personalizeTitle:   'Personalizuj kolory',
    applyColors:        'Zastosuj kolory',
    colorsRoot:         'Korzeń',
    colorsLevel:        'Poziom',
    colorsBorder:       'Obramowanie',
    colorsFill:         'Wypełnienie',
    colorsProbText:     'Tekst prawdopodobieństwa',
    tooltipPath:        'P({path}) = {prob}',
    tooltipRoot:        'Węzeł korzeń',
    errMinOutcomes:     'Dodaj co najmniej 2 wyniki.',
    errNoLabel:         'Każdy wynik musi mieć etykietę.',
    errInvalidProb:     'Wszystkie prawdopodobieństwa muszą być poprawnymi liczbami lub ułamkami.',
    errSumNot1:         'Prawdopodobieństwa muszą sumować się dokładnie do 1.',
    errClipboard:       'Zapis do schowka nie jest obsługiwany w tej przeglądarce.',
  },
};

/**
 * Returns the translated string for a key in the active language.
 * Falls back to English if the key is missing.
 *
 * @param {string} key
 * @returns {string}
 */
function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
      || TRANSLATIONS['en'][key]
      || key;
}

/**
 * Applies the active language to all [data-i18n] and [data-i18n-title] elements
 * and dynamic placeholder attributes.
 */
function applyLang() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    el.title = t(el.getAttribute('data-i18n-title'));
  });

  /* Update dynamic placeholders in the outcomes table */
  document.querySelectorAll('.lbl-input').forEach(function (el) {
    el.placeholder = t('colLabel');
  });
  document.querySelectorAll('.prob-input').forEach(function (el) {
    el.placeholder = t('colProb');
  });

  var titleInput = document.getElementById('titleInput');
  if (titleInput) titleInput.placeholder = t('titlePlaceholder');
}

/**
 * Toggles the active language and re-renders all translated text.
 */
function toggleLang() {
  currentLang = currentLang === 'en' ? 'pl' : 'en';
  document.getElementById('langLabel').textContent = t('langLabel');
  applyLang();
}