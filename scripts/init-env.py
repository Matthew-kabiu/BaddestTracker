#!/usr/bin/env python3
"""Create one private root env file without displaying secrets or overwriting files."""
import argparse
import base64
import os
from pathlib import Path
import secrets
import shlex
from urllib.parse import urlsplit
from env_config import read_env, validate

ROOT = Path(__file__).resolve().parent.parent


def create(environment, site_url=None, host_port=None):
    values = {key: value for key, value in read_env(ROOT / '.env.example').items() if not key.startswith('CI_')}
    if environment == 'production':
        if not site_url or not host_port:
            raise ValueError('production requires --site-url and --frontend-host-port')
        url = urlsplit(site_url)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
            raise ValueError('--site-url must be an HTTPS origin without credentials or a path')
        if not 1024 <= host_port <= 65535:
            raise ValueError('--frontend-host-port must be an unprivileged valid port')
        site_url = site_url.rstrip('/')
        values.update(
            APP_ENV=environment, VITE_ENVIRONMENT=environment,
            FRONTEND_HOST_PORT=str(host_port), CORS_ORIGINS=site_url,
            VITE_SITE_URL=site_url, VITE_API_BASE_URL=f'{site_url}/api',
            VITE_AUTH_BASE_URL=site_url, BETTER_AUTH_URL=site_url,
            AUTH_COOKIE_DOMAIN=url.hostname,
        )
    values['POSTGRES_PASSWORD'] = secrets.token_hex(32)
    values['DATABASE_URL'] = (
        f"postgres://{values['POSTGRES_USER']}:{values['POSTGRES_PASSWORD']}"
        f"@postgres:{values['POSTGRES_PORT']}/{values['POSTGRES_DB']}"
    )
    for key in ('BETTER_AUTH_SECRET', 'AI_KEYS_ENCRYPTION_KEY'):
        values[key] = base64.b64encode(secrets.token_bytes(32)).decode()
    validate(values, environment)
    target = ROOT / f'.env.{environment}'
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write('# Private environment. Never commit or print this file.\n')
        for key, value in values.items():
            output.write(f'{key}={shlex.quote(value)}\n')
    print(f'Created {target.name} with owner-only permissions. No secrets displayed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('environment', choices=('development', 'production'))
    parser.add_argument('--site-url')
    parser.add_argument('--frontend-host-port', type=int)
    args = parser.parse_args()
    try:
        create(args.environment, args.site_url, args.frontend_host_port)
    except (ValueError, FileExistsError) as error:
        parser.exit(1, f'{error}\n')
