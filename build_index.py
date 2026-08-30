#!/usr/bin/env python3
"""Собирает боевой index.html из blocks.html.

blocks.html — рабочая страница: там переключатель вариантов и noindex.
Боевая отличается ровно двумя вещами: нормальная «шапка» для поиска
и никакого переключателя. Всё остальное — один в один, чтобы правки
в blocks.html доезжали до сайта одной командой:  python3 build_index.py
"""
import re, sys

DOMAIN = sys.argv[1] if len(sys.argv) > 1 else "thereallandlord.github.io/nabroska"
BASE = "https://" + DOMAIN.rstrip("/") + "/"

TITLE = "Из наброска в профессию — курс по диджитал-иллюстрации"
DESC = ("Освой базу диджитал-иллюстрации и построй на ней профессию: от первого взмаха "
        "стилусом до дохода на иллюстрации без академических знаний.")

s = open("blocks.html", encoding="utf-8").read()

head = f'''<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="{BASE}">

<meta property="og:type" content="website">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="{BASE}img/hero-1600.jpg">
<meta property="og:url" content="{BASE}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">'''

old_head = '<title>Блоки 2–4 — три варианта</title>\n<meta name="robots" content="noindex">'
assert old_head in s, "шапка blocks.html изменилась — поправь build_index.py"
s = s.replace(old_head, head, 1)

# переключатель вариантов — только для показа, в боевую страницу не идёт
s2 = re.sub(r'<div class="switch">.*?</div>\n', '', s, count=1, flags=re.S)
assert s2 != s, "переключатель не найден"
s = s2

open("index.html", "w", encoding="utf-8").write(s)
print(f"index.html собран из blocks.html ({len(s)//1024} КБ), домен в мета-тегах: {BASE}")
