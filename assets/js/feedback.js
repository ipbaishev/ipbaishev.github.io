/*
 * Форма обратной связи (/feedback/) с Yandex SmartCaptcha.
 * Ключ клиентской части и адрес обработчика — в data-sitekey и data-endpoint формы.
 * Пока они не заполнены, форма скрыта и показано сообщение с почтой и телефоном.
 * Обработчик (Yandex Cloud Functions): yandex-cloud/feedback/index.py.
 */
(function () {
  'use strict';

  var CAPTCHA_SRC = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=__feedbackCaptchaReady';

  var form, unavailable, alertBox, submitBtn, captchaError, done;
  var widgetId = null;
  var sending = false;

  function $(sel) { return form.querySelector(sel); }

  function showUnavailable() {
    form.hidden = true;
    unavailable.hidden = false;
  }

  function setError(field, errorEl, text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
    if (field) {
      if (text) { field.setAttribute('aria-invalid', 'true'); } else { field.removeAttribute('aria-invalid'); }
    }
  }

  function showAlert(text) {
    alertBox.textContent = text;
    alertBox.hidden = false;
    alertBox.focus();
  }

  function validate() {
    var name = $('#feedback-name');
    var contact = $('#feedback-contact');
    var message = $('#feedback-message');
    var consent = $('#feedback-consent');
    var first = null;

    function check(field, errorId, text) {
      setError(field, $('#' + errorId), text);
      if (text && !first) { first = field; }
    }

    check(name, 'feedback-name-error', name.value.trim() ? '' : 'Введите имя.');
    var c = contact.value.trim();
    var looksOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || c.replace(/\D/g, '').length >= 10;
    check(contact, 'feedback-contact-error', !c ? 'Укажите телефон или электронную почту.' :
      (looksOk ? '' : 'Проверьте номер телефона или адрес электронной почты.'));
    check(message, 'feedback-message-error', message.value.trim() ? '' : 'Введите сообщение.');
    check(consent, 'feedback-consent-error', consent.checked ? '' : 'Для отправки формы нужно согласие на обработку персональных данных.');

    var token = window.smartCaptcha ? window.smartCaptcha.getResponse(widgetId) : '';
    setError(null, captchaError, token ? '' : 'Подтвердите, что вы не робот.');

    if (first) { first.focus(); return null; }
    if (!token) { captchaError.scrollIntoView({ block: 'center' }); return null; }
    return token;
  }

  function finish(ok, error) {
    sending = false;
    submitBtn.disabled = false;
    form.removeAttribute('aria-busy');
    // Токен одноразовый: после любого ответа сервера проверку нужно пройти заново
    if (window.smartCaptcha) { window.smartCaptcha.reset(widgetId); }
    if (ok) {
      form.hidden = true;
      done.hidden = false;
      done.querySelector('[data-feedback-done-title]').focus();
      return;
    }
    showAlert(error === 'captcha'
      ? 'Не удалось подтвердить, что вы не робот. Пройдите проверку ещё раз и отправьте форму.'
      : 'Не удалось отправить сообщение. Попробуйте ещё раз или напишите на info@ip-baishev.ru.');
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (sending) { return; }
    alertBox.hidden = true;
    var token = validate();
    if (!token) { return; }

    var body = new URLSearchParams();
    body.set('name', $('#feedback-name').value.trim());
    body.set('contact', $('#feedback-contact').value.trim());
    body.set('message', $('#feedback-message').value.trim());
    body.set('consent', '1');
    body.set('token', token);

    sending = true;
    submitBtn.disabled = true;
    form.setAttribute('aria-busy', 'true');

    // application/x-www-form-urlencoded — «простой» запрос CORS, без предварительного OPTIONS
    window.fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: body })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          finish(res.ok && data.ok === true, data.error);
        });
      })
      .catch(function () { finish(false, 'network'); });
  }

  window.__feedbackCaptchaReady = function () {
    try {
      widgetId = window.smartCaptcha.render($('[data-feedback-captcha]'), {
        sitekey: form.getAttribute('data-sitekey'),
        hl: 'ru',
        callback: function () { setError(null, captchaError, ''); }
      });
      window.smartCaptcha.subscribe(widgetId, 'network-error', function () {
        setError(null, captchaError, 'Не удалось загрузить проверку. Проверьте подключение к интернету и обновите страницу.');
      });
    } catch (e) {
      showUnavailable();
    }
  };

  function init() {
    form = document.querySelector('[data-feedback]');
    if (!form) { return; }
    unavailable = document.querySelector('[data-feedback-unavailable]');
    done = document.querySelector('[data-feedback-done]');
    alertBox = $('[data-feedback-alert]');
    submitBtn = $('[data-feedback-submit]');
    captchaError = $('[data-feedback-captcha-error]');

    if (!form.getAttribute('data-sitekey') || !form.getAttribute('data-endpoint') || !window.fetch || !window.URLSearchParams) {
      showUnavailable();
      return;
    }

    form.addEventListener('submit', onSubmit);
    form.hidden = false;

    var script = document.createElement('script');
    script.src = CAPTCHA_SRC;
    script.defer = true;
    script.onerror = showUnavailable;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
