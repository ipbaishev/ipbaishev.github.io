/*
 * Капча «Я не робот» (страница /captcha/).
 * Без зависимостей и без сети: код рисуется на <canvas>, ответ проверяется
 * в браузере, введённое никуда не отправляется и не сохраняется.
 * Цвета и шрифт берутся из темы сайта, поэтому картинка перекрашивается
 * вместе с версией для слабовидящих.
 */
(function () {
  'use strict';

  var LENGTH = 5;      // цифр в коде
  var WIDTH = 240;     // логический размер картинки
  var HEIGHT = 80;
  var SCALE = 3;       // запас чёткости для крупного шрифта и экранов высокой плотности

  var root = document.documentElement;
  var box, form, canvas, ctx, input, errorBox, errorText, live, result, resultTitle, speakBtn;
  var code = '';
  var liveTimer = null;

  /* ---------- случайные значения ---------- */

  // Цифры кода — из криптографического генератора, если он есть.
  function randomDigit() {
    try {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % 10;
    } catch (e) {
      return Math.floor(Math.random() * 10);
    }
  }

  // Искажения и шум — обычный Math.random.
  function between(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeCode() {
    var s = '';
    for (var i = 0; i < LENGTH; i++) { s += String(randomDigit()); }
    return s;
  }

  /* ---------- рисование ---------- */

  function cssVar(name, fallback) {
    var v = window.getComputedStyle(root).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  function curve() {
    ctx.beginPath();
    ctx.moveTo(between(0, 20), between(15, HEIGHT - 15));
    ctx.bezierCurveTo(
      between(50, 100), between(0, HEIGHT),
      between(140, 190), between(0, HEIGHT),
      between(WIDTH - 20, WIDTH), between(15, HEIGHT - 15)
    );
    ctx.stroke();
  }

  function draw() {
    var bg = cssVar('--c-surface', '#F3F6FF');
    var ink = cssVar('--c-text', '#101828');
    var accent = cssVar('--c-primary', '#2F5BFF');
    var muted = cssVar('--c-muted', '#475467');
    var family = window.getComputedStyle(document.body).fontFamily || 'sans-serif';
    var i;

    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Шум под цифрами: точки и дуги
    for (i = 0; i < 70; i++) {
      ctx.globalAlpha = between(0.25, 0.6);
      ctx.fillStyle = i % 2 ? accent : muted;
      ctx.beginPath();
      ctx.arc(between(0, WIDTH), between(0, HEIGHT), between(0.6, 1.8), 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < 4; i++) {
      ctx.globalAlpha = between(0.35, 0.6);
      ctx.strokeStyle = i % 2 ? accent : muted;
      ctx.lineWidth = between(1, 2);
      curve();
    }

    // Цифры: у каждой свой размер, сдвиг, наклон и поворот
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var step = (WIDTH - 40) / LENGTH;
    for (i = 0; i < code.length; i++) {
      ctx.save();
      ctx.translate(20 + step * (i + 0.5) + between(-4, 4), HEIGHT / 2 + between(-7, 7));
      ctx.rotate(between(-0.4, 0.4));
      ctx.transform(1, 0, between(-0.3, 0.3), 1, 0, 0);
      ctx.font = '700 ' + Math.round(between(34, 44)) + 'px ' + family;
      ctx.fillText(code.charAt(i), 0, 0);
      ctx.restore();
    }

    // Линия поверх цифр мешает программе разделить их на отдельные знаки
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.75;
    curve();
    ctx.globalAlpha = 1;
  }

  /* ---------- сообщения ---------- */

  // Сообщение для программ экранного доступа (как announce() в a11y.js)
  function announce(text) {
    window.clearTimeout(liveTimer);
    live.textContent = '';
    liveTimer = window.setTimeout(function () { live.textContent = text; }, 60);
  }

  function showError(text) {
    errorText.textContent = text;
    errorBox.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    announce(text);
  }

  function clearError() {
    errorBox.hidden = true;
    errorText.textContent = '';
    input.removeAttribute('aria-invalid');
  }

  /* ---------- действия ---------- */

  function stopSpeech() {
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
  }

  function refresh() {
    stopSpeech();
    code = makeCode();
    draw();
    input.value = '';
  }

  function speak() {
    var synth = window.speechSynthesis;
    synth.cancel();
    var phrase = new window.SpeechSynthesisUtterance(code.split('').join(', '));
    phrase.lang = 'ru-RU';
    phrase.rate = 0.75;
    var voices = synth.getVoices();
    for (var i = 0; i < voices.length; i++) {
      if (/^ru/i.test(voices[i].lang)) { phrase.voice = voices[i]; break; }
    }
    synth.speak(phrase);
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var answer = input.value.replace(/\s+/g, '');
    if (!answer) {
      showError('Введите код с картинки.');
      input.focus();
      return;
    }
    if (answer !== code) {
      // Неверный ответ — сразу новый код: подобрать старый перебором нельзя
      refresh();
      showError('Код введён неверно. Показан новый код — введите его.');
      input.focus();
      return;
    }
    stopSpeech();
    clearError();
    form.hidden = true;
    result.hidden = false;
    resultTitle.focus();
  }

  function again() {
    refresh();
    result.hidden = true;
    form.hidden = false;
    input.focus();
  }

  /* ---------- запуск ---------- */

  function init() {
    box = document.querySelector('[data-captcha]');
    if (!box) { return; }
    canvas = box.querySelector('[data-captcha-image]');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) { return; }   // без <canvas> блок остаётся скрытым

    form = box.querySelector('[data-captcha-form]');
    input = box.querySelector('[data-captcha-input]');
    errorBox = box.querySelector('[data-captcha-error]');
    errorText = box.querySelector('[data-captcha-error-text]');
    live = box.querySelector('[data-captcha-live]');
    result = box.querySelector('[data-captcha-result]');
    resultTitle = box.querySelector('[data-captcha-result-title]');
    speakBtn = box.querySelector('[data-captcha-speak]');

    canvas.width = WIDTH * SCALE;
    canvas.height = HEIGHT * SCALE;

    form.addEventListener('submit', onSubmit);
    input.addEventListener('input', function () {
      if (input.hasAttribute('aria-invalid')) { clearError(); }
    });
    box.querySelector('[data-captcha-refresh]').addEventListener('click', function () {
      refresh();
      clearError();
      announce('Показан новый код.');
    });
    box.querySelector('[data-captcha-again]').addEventListener('click', again);

    // Прослушать код можно, только если браузер умеет синтезировать речь
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      speakBtn.hidden = false;
      speakBtn.addEventListener('click', speak);
    }

    refresh();
    box.hidden = false;

    // Шрифт сайта мог ещё не загрузиться — перерисовываем, когда он готов
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(draw, function () { /* остаётся запасной шрифт */ });
    }
    // Версия для слабовидящих меняет цвета и шрифт — перерисовываем тот же код
    if (window.MutationObserver) {
      new window.MutationObserver(draw).observe(root, {
        attributes: true,
        attributeFilter: ['data-a11y', 'data-a11y-scheme', 'data-a11y-font']
      });
    }
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
