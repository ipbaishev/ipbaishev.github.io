/*
 * Пасхалка (страница /pashalka/).
 * Яйцо «Фаберже»: после нескольких нажатий оно раскрывается, а внутри —
 * скороговорка или интересный факт о русском языке.
 * Без зависимостей и без сети, ничего не сохраняет.
 */
(function () {
  'use strict';

  var HITS = 5;   // нажатий, чтобы разбить яйцо

  var SURPRISES = [
    { kind: 'twister', text: 'Шла Саша по шоссе и сосала сушку.' },
    { kind: 'twister', text: 'Карл у Клары украл кораллы, а Клара у Карла украла кларнет.' },
    { kind: 'twister', text: 'На дворе трава, на траве дрова. Не руби дрова на траве двора!' },
    { kind: 'twister', text: 'Ехал Грека через реку, видит Грека — в реке рак. Сунул Грека руку в реку, рак за руку Греку цап!' },
    { kind: 'twister', text: 'От топота копыт пыль по полю летит.' },
    { kind: 'twister', text: 'Шесть мышат в шалаше шуршат.' },
    { kind: 'twister', text: 'Кукушка кукушонку купила капюшон. Надел кукушонок капюшон. Как в капюшоне он смешон!' },
    { kind: 'twister', text: 'Корабли лавировали, лавировали, да не вылавировали.' },
    { kind: 'twister', text: 'Четыре чёрненьких чумазеньких чертёнка чертили чёрными чернилами чертёж.' },
    { kind: 'twister', text: 'Жутко жуку жить на суку.' },
    { kind: 'twister', text: 'Белый снег, белый мел, белый заяц тоже бел. А вот белка не бела — белой даже не была.' },
    { kind: 'twister', text: 'Сшит колпак не по-колпаковски, вылит колокол не по-колоколовски.' },
    { kind: 'fact', text: 'В русском алфавите 33 буквы. Две из них — «ъ» и «ь» — сами по себе не обозначают звуков.' },
    { kind: 'fact', text: 'Букву «ё» предложила княгиня Екатерина Дашкова в 1783 году. Её часто заменяют на «е», но в словах «всё» и «все» две точки меняют смысл.' },
    { kind: 'fact', text: 'Приветствие «здравствуйте» происходит от глагола «здравствовать» — «быть здоровым». А первая «в» в этом слове не произносится.' },
    { kind: 'fact', text: 'В словах «длинношеее» и «змееед» три буквы «е» стоят подряд.' },
    { kind: 'fact', text: 'У глагола «победить» нет формы «я …» в будущем времени. Вместо неё говорят «я одержу победу» или «я смогу победить».' },
    { kind: 'fact', text: 'Самая частая буква в русских текстах — «о».' },
    { kind: 'fact', text: 'Русский — один из шести официальных языков ООН.' },
    { kind: 'fact', text: 'Слова «спутник» и «матрёшка» вошли во многие языки мира без перевода.' },
    { kind: 'fact', text: 'По литературной норме слово «кофе» — мужского рода: «горячий кофе». Средний род допустим только в разговорной речи.' }
  ];

  var KINDS = {
    twister: { title: 'Скороговорка', tip: 'Попробуйте произнести её быстро три раза подряд.' },
    fact: { title: 'Знаете ли вы?', tip: '' }
  };

  var box, btn, cracks, intro, left, surprise, kindEl, textEl, tipEl, live, speakBtn;
  var hits = 0;
  var bag = [];
  var current = null;
  var liveTimer = null;

  /* ---------- утилиты ---------- */

  // 1 удар, 2 удара, 5 ударов
  function plural(n, one, few, many) {
    var m10 = n % 10;
    var m100 = n % 100;
    if (m10 === 1 && m100 !== 11) { return one; }
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) { return few; }
    return many;
  }

  function leftText(n) {
    return 'Осталось ' + n + ' ' + plural(n, 'нажатие', 'нажатия', 'нажатий') + '.';
  }

  // Сюрпризы идут в случайном порядке без повторов, пока не закончатся
  function nextSurprise() {
    if (!bag.length) {
      bag = SURPRISES.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      // новый круг не начинается с того, что было последним
      if (bag[bag.length - 1] === current) { bag.unshift(bag.pop()); }
    }
    return bag.pop();
  }

  // Сообщение для программ экранного доступа (как announce() в a11y.js)
  function announce(text) {
    window.clearTimeout(liveTimer);
    live.textContent = '';
    liveTimer = window.setTimeout(function () { live.textContent = text; }, 60);
  }

  function stopSpeech() {
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
  }

  /* ---------- действия ---------- */

  function wobble() {
    btn.classList.remove('is-hit');
    void btn.offsetWidth;   // перезапуск анимации
    btn.classList.add('is-hit');
  }

  function showCracks() {
    for (var i = 0; i < cracks.length; i++) {
      cracks[i].classList.toggle('is-shown', i < hits);
    }
  }

  function open() {
    current = nextSurprise();
    var kind = KINDS[current.kind];
    kindEl.textContent = kind.title;
    textEl.textContent = current.text;
    tipEl.textContent = kind.tip;

    box.classList.add('is-open');
    btn.disabled = true;
    intro.hidden = true;
    surprise.hidden = false;
    kindEl.focus();
  }

  function hit() {
    if (btn.disabled) { return; }
    hits++;
    wobble();
    showCracks();
    if (hits >= HITS) {
      open();
      return;
    }
    left.textContent = leftText(HITS - hits);
    announce('Трещина! ' + left.textContent);
  }

  function reset() {
    stopSpeech();
    hits = 0;
    showCracks();
    btn.classList.remove('is-hit');
    box.classList.remove('is-open');
    btn.disabled = false;
    left.textContent = leftText(HITS);
    surprise.hidden = true;
    intro.hidden = false;
    btn.focus();
  }

  function speak() {
    var synth = window.speechSynthesis;
    synth.cancel();
    var phrase = new window.SpeechSynthesisUtterance(current.text);
    phrase.lang = 'ru-RU';
    phrase.rate = 0.9;
    var voices = synth.getVoices();
    for (var i = 0; i < voices.length; i++) {
      if (/^ru/i.test(voices[i].lang)) { phrase.voice = voices[i]; break; }
    }
    synth.speak(phrase);
  }

  /* ---------- запуск ---------- */

  function init() {
    box = document.querySelector('[data-egg]');
    if (!box) { return; }
    btn = box.querySelector('[data-egg-btn]');
    cracks = box.querySelectorAll('[data-egg-crack]');
    intro = box.querySelector('[data-egg-intro]');
    left = box.querySelector('[data-egg-left]');
    surprise = box.querySelector('[data-egg-surprise]');
    kindEl = box.querySelector('[data-egg-kind]');
    textEl = box.querySelector('[data-egg-text]');
    tipEl = box.querySelector('[data-egg-tip]');
    live = box.querySelector('[data-egg-live]');
    speakBtn = box.querySelector('[data-egg-speak]');

    btn.addEventListener('click', hit);
    btn.addEventListener('animationend', function () { btn.classList.remove('is-hit'); });
    box.querySelector('[data-egg-again]').addEventListener('click', reset);

    // Прослушать можно, только если браузер умеет синтезировать речь
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      speakBtn.hidden = false;
      speakBtn.addEventListener('click', speak);
    }

    left.textContent = leftText(HITS);
    box.hidden = false;
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
