#!/usr/bin/env python3
"""Собирает две боевые страницы из одной рабочей blocks.html.

  /                — витрина: тот же сайт, но без цен и кнопок покупки
  /predspisok/     — полная версия с тарифами и формами оплаты

В blocks.html размечены два вида служебных кусков:
  /*dev*/ … /*/dev*/    — замеры и открывалки по адресу, в боевые не идут
  <!--sale--> … <!--/sale-->  — тарифы, окно с формами и его скрипт

Запуск:  python3 build_index.py [домен]
"""
import os, re, sys

DOMAIN = (sys.argv[1] if len(sys.argv) > 1 else "aszavra.art").rstrip("/")
BASE = f"https://{DOMAIN}/"

TITLE = "Из наброска в профессию — курс по диджитал-иллюстрации"
DESC = ("Освой базу диджитал-иллюстрации и построй на ней профессию: от первого взмаха "
        "стилусом до дохода на иллюстрации без академических знаний.")

src = open("blocks.html", encoding="utf-8").read()


def head_for(url, noindex=False, extra_icons=True):
    robots = '\n<meta name="robots" content="noindex">' if noindex else ""
    icons = ('\n<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">'
             '\n<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">') if extra_icons else ""
    return f'''<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="{url}">{robots}

<meta property="og:type" content="website">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="{BASE}img/hero-1600.jpg">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">{icons}'''


OLD_HEAD = '<title>Блоки 2–4 — три варианта</title>\n<meta name="robots" content="noindex">'


def strip_dev(html):
    """убрать замеры, открывалки по адресу и переключатель вариантов"""
    html = re.sub(r'<div class="switch">.*?</div>\n', '', html, count=1, flags=re.S)
    html = re.sub(r'  /\*dev\*/\n.*?  /\*/dev\*/\n', '', html, flags=re.S)
    html = re.sub(r'<!--dev-->\n.*?<!--/dev-->\n', '', html, flags=re.S)
    assert '/*dev*/' not in html and '<!--dev-->' not in html and 'class="switch"' not in html
    return html


def strip_sale(html):
    """убрать цены, кнопки покупки и окно с формами.
    Сами карточки тарифов на витрине остаются: там видно, что входит
    в каждый вариант, — без цен и без кнопок."""
    html = re.sub(r'<!--sale-->\n.*?<!--/sale-->\n', '', html, flags=re.S)
    assert '<!--sale-->' not in html, "метки вырезались не все"
    assert '₽' not in html, "на витрине осталась цена"
    assert 'class="tar__btn' not in html, "на витрине осталась кнопка покупки"
    assert 'gcm__form' not in html, "на витрине осталось окно с формами"
    return html


def keep_sale(html):
    return html.replace("<!--sale-->\n", "").replace("<!--/sale-->\n", "")


def to_root_paths(html):
    """страница лежит в подпапке — пути к файлам считаем от корня сайта"""
    html = re.sub(r'(?<=")(css|img|js|fonts)/', r'/\1/', html)
    html = re.sub(r'(?<=, )(img)/', r'/\1/', html)          # второй адрес в srcset
    for f in ("favicon.ico", "favicon-32.png", "favicon-16.png", "apple-touch-icon.png"):
        html = html.replace(f'"{f}"', f'"/{f}"')
    return html


# ---------- витрина: без цен и кнопок покупки ----------
main = strip_sale(strip_dev(src)).replace(OLD_HEAD, head_for(BASE), 1)
open("index.html", "w", encoding="utf-8").write(main)

# ---------- предсписок: всё, включая тарифы ----------
full = keep_sale(strip_dev(src))
full = full.replace(OLD_HEAD, head_for(BASE + "predspisok/", noindex=True), 1)
full = to_root_paths(full)
os.makedirs("predspisok", exist_ok=True)
open("predspisok/index.html", "w", encoding="utf-8").write(full)

print(f"витрина      index.html            {len(main)//1024:3} КБ  (тарифы без цен и кнопок)")
print(f"предсписок   predspisok/index.html {len(full)//1024:3} КБ  (тарифы и формы на месте)")
