#!/usr/bin/env python3
"""Check built canonical/crawler metadata and CSP without a web server or Docker."""
import base64
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from env_config import ROOT, read_env

values = read_env(ROOT / f'.env.{sys.argv[1]}')
origin = values['VITE_SITE_URL'].rstrip('/')
dist = ROOT / 'code/frontend/dist'
html = (dist / 'index.html').read_text()
assert f'rel="canonical" href="{origin}/"' in html, 'Canonical does not match environment'
match = re.search(r'<script id="seo-structured-data" type="application/ld\+json">([^<]+)</script>', html)
assert match, 'Missing structured data'
json.loads(match[1])
digest = base64.b64encode(hashlib.sha256(match[1].encode()).digest()).decode()
assert (dist / 'seo-csp-hash.txt').read_text().strip() == digest, 'CSP hash mismatch'
assert f'Sitemap: {origin}/sitemap.xml' in (dist / 'robots.txt').read_text(), 'Sitemap origin mismatch'
tree = ET.fromstring((dist / 'sitemap.xml').read_text())
assert tree.find('.//{*}loc').text == origin + '/', 'Sitemap URL mismatch'
assert '%VITE_' not in html, 'Unexpanded environment placeholder'
print('Built canonical, JSON-LD, robots, sitemap and CSP hash agree with the environment.')
