/*
 * Секретный вход на страницу-пасхалку /pashalka/ (подключается на всех страницах).
 * Открывают её «код Konami» на клавиатуре (↑ ↑ ↓ ↓ ← → ← → B A)
 * или семь быстрых нажатий на «© ИП Баишев А.Р.» в подвале.
 * Без зависимостей и без сети, ничего не сохраняет.
 */
(function () {
  'use strict';

  var TARGET = '/pashalka/';
  var CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  var TAPS = 7;          // нажатий на подпись в подвале
  var TAP_GAP = 1500;    // мс: пауза дольше — счёт начинается заново

  // Без event.code (старые браузеры) буквы узнаются в обеих раскладках
  var LETTERS = { b: 'KeyB', 'и': 'KeyB', a: 'KeyA', 'ф': 'KeyA' };

  var keys = [];
  var taps = 0;
  var lastTap = 0;

  function go() {
    window.location.href = TARGET;
  }

  function isTyping(node) {
    return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
  }

  // Буквы сверяются по физической клавише: код работает и в русской раскладке
  function keyName(e) {
    if (/^Arrow/.test(e.key)) { return e.key; }
    if (e.code) { return e.code; }
    return LETTERS[String(e.key).toLowerCase()] || '';
  }

  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) { return; }
    keys.push(keyName(e));
    if (keys.length > CODE.length) { keys.shift(); }
    if (keys.join(' ') === CODE.join(' ')) {
      keys = [];
      go();
    }
  }

  function onTap() {
    var now = Date.now();
    taps = now - lastTap < TAP_GAP ? taps + 1 : 1;
    lastTap = now;
    if (taps >= TAPS) {
      taps = 0;
      go();
    }
  }

  function init() {
    document.addEventListener('keydown', onKey);
    var mark = document.querySelector('.site-footer__name');
    if (mark) { mark.addEventListener('click', onTap); }
  }

  function start() {
    try { init(); } catch (e) { /* страница не должна ломаться */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
