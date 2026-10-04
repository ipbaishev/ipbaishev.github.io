/*
 * Версия для слабовидящих (панель настроек).
 * Без зависимостей, без сети, без cookie. Настройки хранятся только в localStorage
 * (ключ a11y-v1) и только в try/catch. Без JavaScript сайт работает как обычно.
 *
 * Атрибуты на <html> (см. a11y.css):
 *   data-a11y="on", data-a11y-size="1|2|3|4", data-a11y-scheme="bw|wb|blue|brown",
 *   data-a11y-spacing="1|2|3", data-a11y-lh="1|2|3", data-a11y-font="sans|serif",
 *   data-a11y-img="on|off".
 * Открывают панель все элементы [data-a11y-open]; параметр ?eye включает удобный набор.
 */
(function () {
  'use strict';

  if (window.__a11yInit) { return; }
  window.__a11yInit = true;

  var STORAGE_KEY = 'a11y-v1';
  var root = document.documentElement;

  var DEFAULTS = { size: 1, scheme: '', spacing: 1, lh: 1, font: '', img: 'on' };
  var ALLOWED = {
    size: ['1', '2', '3', '4'],
    scheme: ['', 'bw', 'wb', 'blue', 'brown'],
    spacing: ['1', '2', '3'],
    lh: ['1', '2', '3'],
    font: ['', 'sans', 'serif'],
    img: ['on', 'off']
  };
  var ATTR = {
    size: 'data-a11y-size', scheme: 'data-a11y-scheme', spacing: 'data-a11y-spacing',
    lh: 'data-a11y-lh', font: 'data-a11y-font', img: 'data-a11y-img'
  };
  var KEYS = ['size', 'scheme', 'spacing', 'lh', 'font', 'img'];

  var state = copy(DEFAULTS);
  var panel = null;
  var liveRegion = null;
  var titleEl = null;
  var lastTrigger = null;
  var liveTimer = null;

  /* ---------- утилиты ---------- */

  function copy(o) {
    var r = {};
    for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { r[k] = o[k]; } }
    return r;
  }

  function allowed(key, value) {
    return ALLOWED[key].indexOf(String(value)) !== -1;
  }

  function isDefault(s) {
    for (var i = 0; i < KEYS.length; i++) {
      if (String(s[KEYS[i]]) !== String(DEFAULTS[KEYS[i]])) { return false; }
    }
    return true;
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var name in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, name)) { node.setAttribute(name, attrs[name]); }
      }
    }
    if (text) { node.textContent = text; }
    return node;
  }

  function triggers() {
    return document.querySelectorAll('[data-a11y-open]');
  }

  function isVisible(node) {
    return !!(node && node.getClientRects && node.getClientRects().length);
  }

  /* ---------- хранилище (всегда в try/catch) ---------- */

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) { return; }
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') { return; }
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        if (data[k] !== undefined && allowed(k, data[k])) {
          state[k] = (k === 'size' || k === 'spacing' || k === 'lh') ? Number(data[k]) : String(data[k]);
        }
      }
    } catch (e) { /* хранилище недоступно: работаем без него */ }
  }

  function save() {
    try {
      if (isDefault(state)) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) { /* ничего страшного */ }
  }

  /* ---------- применение настроек к <html> ---------- */

  function clearAttributes() {
    root.removeAttribute('data-a11y');
    for (var i = 0; i < KEYS.length; i++) { root.removeAttribute(ATTR[KEYS[i]]); }
  }

  function apply() {
    if (isDefault(state)) {
      clearAttributes();
    } else {
      root.setAttribute('data-a11y', 'on');
      root.setAttribute(ATTR.size, String(state.size));
      root.setAttribute(ATTR.spacing, String(state.spacing));
      root.setAttribute(ATTR.lh, String(state.lh));
      root.setAttribute(ATTR.img, String(state.img));
      if (state.scheme) { root.setAttribute(ATTR.scheme, state.scheme); } else { root.removeAttribute(ATTR.scheme); }
      if (state.font) { root.setAttribute(ATTR.font, state.font); } else { root.removeAttribute(ATTR.font); }
    }
    syncButtons();
  }

  /* ---------- панель ---------- */

  var GROUPS = [
    { key: 'size', title: 'Размер текста', options: [
      ['1', '100 %', 'Размер текста 100 %'], ['2', '125 %', 'Размер текста 125 %'],
      ['3', '150 %', 'Размер текста 150 %'], ['4', '175 %', 'Размер текста 175 %']
    ] },
    { key: 'scheme', title: 'Цвета', swatch: true, options: [
      ['', 'Обычные', 'Обычные цвета сайта'], ['bw', 'Аа', 'Чёрный текст на белом фоне'],
      ['wb', 'Аа', 'Белый текст на чёрном фоне'], ['blue', 'Аа', 'Тёмно-синий текст на голубом фоне'],
      ['brown', 'Аа', 'Зелёный текст на коричневом фоне']
    ] },
    { key: 'spacing', title: 'Расстояние между буквами', options: [
      ['1', 'Обычное', 'Обычное расстояние между буквами'], ['2', 'Среднее', 'Среднее расстояние между буквами'],
      ['3', 'Большое', 'Большое расстояние между буквами']
    ] },
    { key: 'lh', title: 'Расстояние между строками', options: [
      ['1', 'Обычное', 'Обычное расстояние между строками'], ['2', 'Среднее', 'Среднее расстояние между строками'],
      ['3', 'Большое', 'Большое расстояние между строками']
    ] },
    { key: 'font', title: 'Шрифт', options: [
      ['', 'Как на сайте', 'Шрифт как на сайте'], ['sans', 'Без засечек', 'Шрифт без засечек'],
      ['serif', 'С засечками', 'Шрифт с засечками']
    ] },
    { key: 'img', title: 'Изображения', options: [
      ['on', 'Показывать', 'Показывать изображения'], ['off', 'Скрыть', 'Скрыть изображения']
    ] }
  ];

  var SPEECH = {
    size: function (v) { return 'Размер текста: ' + ({ '1': '100', '2': '125', '3': '150', '4': '175' }[v]) + ' процентов'; },
    scheme: function (v) {
      return 'Цвета: ' + ({ '': 'обычные', bw: 'чёрный на белом', wb: 'белый на чёрном',
        blue: 'тёмно-синий на голубом', brown: 'зелёный на коричневом' }[v]);
    },
    spacing: function (v) { return 'Расстояние между буквами: ' + ({ '1': 'обычное', '2': 'среднее', '3': 'большое' }[v]); },
    lh: function (v) { return 'Расстояние между строками: ' + ({ '1': 'обычное', '2': 'среднее', '3': 'большое' }[v]); },
    font: function (v) { return 'Шрифт: ' + ({ '': 'как на сайте', sans: 'без засечек', serif: 'с засечками' }[v]); },
    img: function (v) { return v === 'off' ? 'Изображения скрыты' : 'Изображения показаны'; }
  };

  function buildPanel() {
    if (panel || !document.body) { return; }
    if (document.getElementById('a11y-panel')) { panel = document.getElementById('a11y-panel'); return; }

    panel = el('section', {
      id: 'a11y-panel',
      role: 'region',
      'aria-label': 'Настройки версии для слабовидящих'
    });
    panel.hidden = true;

    var inner = el('div', { 'class': 'a11y-panel__inner' });
    var head = el('div', { 'class': 'a11y-panel__head' });
    titleEl = el('h2', { 'class': 'a11y-panel__title', id: 'a11y-title', tabindex: '-1' }, 'Версия для слабовидящих');
    var closeBtn = el('button', { type: 'button', 'class': 'a11y-close', 'data-a11y-action': 'close' }, 'Закрыть панель');
    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    inner.appendChild(head);

    var groups = el('div', { 'class': 'a11y-panel__groups' });
    for (var g = 0; g < GROUPS.length; g++) {
      var def = GROUPS[g];
      var group = el('div', { 'class': 'a11y-group', role: 'group', 'aria-label': def.title });
      group.appendChild(el('span', { 'class': 'a11y-group__title', 'aria-hidden': 'true' }, def.title));
      var row = el('div', { 'class': 'a11y-row' });
      for (var o = 0; o < def.options.length; o++) {
        var opt = def.options[o];
        var attrs = {
          type: 'button',
          'data-a11y-key': def.key,
          'data-value': opt[0],
          'aria-pressed': 'false',
          'aria-label': opt[2]
        };
        if (def.swatch) { attrs['class'] = 'a11y-swatch'; }
        row.appendChild(el('button', attrs, opt[1]));
      }
      group.appendChild(row);
      groups.appendChild(group);
    }
    inner.appendChild(groups);

    var foot = el('div', { 'class': 'a11y-panel__foot' });
    foot.appendChild(el('button', { type: 'button', 'class': 'a11y-reset', 'data-a11y-action': 'reset' },
      'Вернуться к обычной версии'));
    inner.appendChild(foot);

    liveRegion = el('p', { 'class': 'a11y-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    inner.appendChild(liveRegion);

    panel.appendChild(inner);
    document.body.insertBefore(panel, document.body.firstChild);

    panel.addEventListener('click', onPanelClick);
    syncButtons();
  }

  function syncButtons() {
    if (!panel) { return; }
    var buttons = panel.querySelectorAll('button[data-a11y-key]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var key = b.getAttribute('data-a11y-key');
      var on = String(state[key]) === b.getAttribute('data-value');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function announce(text) {
    if (!liveRegion) { return; }
    if (liveTimer) { window.clearTimeout(liveTimer); }
    liveRegion.textContent = '';
    liveTimer = window.setTimeout(function () { liveRegion.textContent = text; }, 60);
  }

  function onPanelClick(ev) {
    var target = ev.target;
    while (target && target !== panel && target.nodeType === 1 && target.tagName !== 'BUTTON') {
      target = target.parentNode;
    }
    if (!target || target.tagName !== 'BUTTON') { return; }

    var action = target.getAttribute('data-a11y-action');
    if (action === 'close') { closePanel(true); return; }
    if (action === 'reset') { resetAll(); return; }

    var key = target.getAttribute('data-a11y-key');
    if (!key) { return; }
    var value = target.getAttribute('data-value');
    if (!allowed(key, value)) { return; }
    state[key] = (key === 'size' || key === 'spacing' || key === 'lh') ? Number(value) : value;
    apply();
    save();
    announce(SPEECH[key](value));
  }

  function resetAll() {
    state = copy(DEFAULTS);
    clearAttributes();
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    syncButtons();
    announce('Настройки сброшены. Включена обычная версия сайта.');
  }

  function setExpanded(open) {
    var list = triggers();
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.tagName === 'BUTTON' || t.hasAttribute('aria-expanded')) {
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    }
  }

  function isOpen() {
    return !!(panel && !panel.hidden);
  }

  function openPanel(focus) {
    buildPanel();
    if (!panel) { return; }
    panel.hidden = false;
    setExpanded(true);
    syncButtons();
    if (focus && titleEl) {
      try { titleEl.focus(); } catch (e) { /* ignore */ }
    }
  }

  function closePanel(returnFocus) {
    if (!panel) { return; }
    panel.hidden = true;
    setExpanded(false);
    if (returnFocus) {
      var t = lastTrigger;
      if (!t || !document.contains(t) || !isVisible(t)) {
        var list = triggers();
        t = null;
        for (var i = 0; i < list.length; i++) { if (isVisible(list[i])) { t = list[i]; break; } }
      }
      if (t) { try { t.focus(); } catch (e) { /* ignore */ } }
    }
  }

  /* ---------- события страницы ---------- */

  function onDocClick(ev) {
    var node = ev.target;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute && node.hasAttribute('data-a11y-open')) { break; }
      node = node.parentNode;
    }
    if (!node || node.nodeType !== 1) { return; }
    if (ev.defaultPrevented) { return; }
    if (ev.button && ev.button !== 0) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { return; }
    ev.preventDefault();
    lastTrigger = node;
    if (isOpen()) { closePanel(false); } else { openPanel(true); }
  }

  function onKeyDown(ev) {
    var key = ev.key || ev.keyCode;
    if (key !== 'Escape' && key !== 'Esc' && key !== 27) { return; }
    if (!isOpen() || ev.defaultPrevented) { return; }
    var a = document.activeElement;
    var inPanel = !!(a && panel.contains(a));
    var onTrigger = !!(a && a.hasAttribute && a.hasAttribute('data-a11y-open'));
    if (inPanel || onTrigger || !a || a === document.body) {
      ev.preventDefault();
      closePanel(true);
    }
  }

  function hasEyeParam() {
    try {
      return /(^|[?&])eye(=|&|$)/.test(window.location.search);
    } catch (e) { return false; }
  }

  function dropEyeParam() {
    try {
      if (window.history && window.history.replaceState) {
        var q = window.location.search.replace(/^\?/, '').split('&').filter(function (p) {
          return p !== '' && p.split('=')[0] !== 'eye';
        }).join('&');
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
      }
    } catch (e) { /* ignore */ }
  }

  function init() {
    load();
    var eye = hasEyeParam();
    if (eye) {
      state.size = 3;
      state.scheme = 'bw';
    }
    buildPanel();
    apply();
    if (eye) {
      save();
      openPanel(false);
      dropEyeParam();
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
  }

  // Настройки применяем сразу (чтобы не мигала обычная версия); панель и обработчики — когда есть <body>.
  function start() {
    try { init(); } catch (e) { /* страница не должна ломаться */ }
  }

  if (document.readyState === 'loading') {
    // Сохранённые настройки — как можно раньше, остальное — после DOMContentLoaded.
    try { load(); apply(); } catch (e) { /* ignore */ }
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
