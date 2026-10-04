"""
Обработчик формы обратной связи сайта ip-baishev.ru (страница /feedback/).

Yandex Cloud Functions, среда выполнения Python 3.12, точка входа index.handler.
Без внешних зависимостей. Проверяет токен Yandex SmartCaptcha и отправляет
сообщение по SMTP на адрес MAIL_TO. Ничего не сохраняет.

Развёртывание:
  1. SmartCaptcha: создать капчу, в списке сайтов указать ip-baishev.ru;
     ключ клиентской части вписать в data-sitekey формы в feedback/index.html.
  2. Cloud Functions: создать функцию, сделать её публичной, загрузить этот файл,
     точка входа index.handler; переменные окружения — ниже.
     Адрес https://functions.yandexcloud.net/<id> вписать в data-endpoint формы.

Переменные окружения:
  SMARTCAPTCHA_SERVER_KEY  ключ сервера SmartCaptcha (лучше хранить в Lockbox)
  ALLOWED_ORIGINS          https://ip-baishev.ru (несколько — через запятую)
  SMTP_HOST, SMTP_PORT     например smtp.yandex.ru и 465 (SSL)
  SMTP_USER, SMTP_PASSWORD учётная запись почты (пароль приложения)
  MAIL_TO                  info@ip-baishev.ru
  MAIL_FROM                необязательно, по умолчанию SMTP_USER
"""
import base64
import json
import os
import re
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate'
EMAIL_RE = re.compile(r'^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$')
LIMITS = {'name': 100, 'contact': 100, 'message': 3000}


def _allowed_origins():
    return [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()]


def _header(event, name):
    for key, value in (event.get('headers') or {}).items():
        if key.lower() == name:
            return value
    return ''


def _response(status, data, origin):
    headers = {'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin'}
    if origin:
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return {'statusCode': status, 'headers': headers, 'body': json.dumps(data), 'isBase64Encoded': False}


def check_captcha(token, ip):
    data = urllib.parse.urlencode({
        'secret': os.environ['SMARTCAPTCHA_SERVER_KEY'],
        'token': token,
        'ip': ip,
    }).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(VALIDATE_URL, data=data), timeout=3) as res:
            result = json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        # Рекомендация Yandex: ошибку HTTP (код не 200) считать успешной проверкой
        print('SmartCaptcha HTTP error', e.code)
        return True
    except Exception as e:  # сеть, тайм-аут
        print('SmartCaptcha unavailable:', e)
        return True
    return result.get('status') == 'ok'


def send_mail(name, contact, message):
    msg = EmailMessage()
    msg['Subject'] = 'Сообщение с сайта ip-baishev.ru'
    msg['From'] = os.environ.get('MAIL_FROM') or os.environ['SMTP_USER']
    msg['To'] = os.environ['MAIL_TO']
    if EMAIL_RE.match(contact):
        msg['Reply-To'] = contact
    msg.set_content(
        'Имя: {}\nКонтакт: {}\n\nСообщение:\n{}\n\n—\nОтправлено через форму обратной связи на сайте.'
        .format(name, contact, message)
    )
    port = int(os.environ.get('SMTP_PORT', '465'))
    with smtplib.SMTP_SSL(os.environ['SMTP_HOST'], port, timeout=10) as smtp:
        smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(msg)


def handler(event, context):
    origin = _header(event, 'origin')
    allowed = origin if origin in _allowed_origins() else ''
    method = event.get('httpMethod', '')

    if method == 'OPTIONS':
        return _response(204, {}, allowed)
    if method != 'POST':
        return _response(405, {'ok': False, 'error': 'method'}, allowed)
    if not allowed:
        return _response(403, {'ok': False, 'error': 'origin'}, '')

    body = event.get('body') or ''
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode('utf-8')
    form = {k: v[0].strip() for k, v in urllib.parse.parse_qs(body).items()}

    for field, limit in LIMITS.items():
        if not form.get(field) or len(form[field]) > limit:
            return _response(400, {'ok': False, 'error': 'invalid'}, allowed)
    if form.get('consent') != '1' or not form.get('token'):
        return _response(400, {'ok': False, 'error': 'invalid'}, allowed)

    ip = ((event.get('requestContext') or {}).get('identity') or {}).get('sourceIp', '')
    if not check_captcha(form['token'], ip):
        return _response(400, {'ok': False, 'error': 'captcha'}, allowed)

    try:
        send_mail(form['name'], form['contact'], form['message'])
    except Exception as e:
        print('Mail error:', e)
        return _response(502, {'ok': False, 'error': 'mail'}, allowed)
    return _response(200, {'ok': True}, allowed)
