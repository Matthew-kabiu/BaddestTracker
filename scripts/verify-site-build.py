#!/usr/bin/env python3
"""Check that the built site is environment-agnostic and its crawler metadata is well formed."""
import json
import re
from env_config import ROOT

dist = ROOT / 'code/frontend/dist'
html = (dist / 'index.html').read_text()
assert 'rel="canonical" href="__SITE_URL__/"' in html, 'Canonical must stay a runtime placeholder'
assert '%VITE_' not in html and 'VITE_' not in html, 'Unexpanded or baked Vite environment value'
match = re.search(r'<script id="seo-structured-data" type="application/ld\+json">([^<]+)</script>', html)
assert match, 'Missing structured data'
json.loads(match[1])
for name in ('robots.txt', 'sitemap.xml', 'seo-csp-hash.txt'):
    assert not (dist / name).exists(), f'{name} is rendered at container start, not at build'
print('Built site carries no environment; canonical, JSON-LD and crawler files render at start.')
