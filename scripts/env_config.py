"""Read private env files without logging their contents; validate the shared contract."""
import base64
import ipaddress
from pathlib import Path
import shlex
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


def read_env(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, raw = line.split('=', 1)
        values[key.strip()] = ' '.join(shlex.split(raw, comments=True))
    return values


def validate(values, environment):
    required = set(read_env(ROOT / '.env.example')) - {'CI_SITE_URL', 'CI_FRONTEND_HOST_PORT'}
    if environment == 'production':
        required -= {'POSTGRES_HOST_PORT', 'BACKEND_HOST_PORT', 'AUTH_HOST_PORT'}
    else:
        required -= {'AUTH_COOKIE_DOMAIN'}
    for key in sorted(required):
        if not values.get(key) or 'GENERATE_WITH_INIT_ENV' in values[key] or 'CHANGE_ME' in values[key]:
            raise ValueError(f'{key} must be configured')
    if values['APP_ENV'] != environment:
        raise ValueError('APP_ENV must match the selected environment')
    ports = {key: int(values[key]) for key in required if key.endswith('_PORT')}
    if any(not 0 < port <= 65535 for port in ports.values()):
        raise ValueError('All ports must be valid nonzero TCP ports')
    host_ports = [port for key, port in ports.items() if key.endswith('_HOST_PORT')]
    if len(host_ports) != len(set(host_ports)):
        raise ValueError('Published host ports must be distinct')
    ipaddress.ip_address(values['HOST_BIND_ADDRESS'])
    if int(values['DB_MAX_CONNS']) < 1:
        raise ValueError('DB_MAX_CONNS must be positive')
    if len(values['BETTER_AUTH_SECRET']) < 32:
        raise ValueError('BETTER_AUTH_SECRET must have at least 32 characters')
    try:
        key = base64.b64decode(values['AI_KEYS_ENCRYPTION_KEY'], validate=True)
    except ValueError:
        raise ValueError('AI_KEYS_ENCRYPTION_KEY must be base64') from None
    if len(key) != 32:
        raise ValueError('AI_KEYS_ENCRYPTION_KEY must decode to 32 bytes')
    database = urlsplit(values['DATABASE_URL'])
    if (database.scheme != 'postgres' or database.hostname != 'postgres'
            or database.port != ports['POSTGRES_PORT']
            or unquote(database.username or '') != values['POSTGRES_USER']
            or unquote(database.password or '') != values['POSTGRES_PASSWORD']
            or database.path != '/' + values['POSTGRES_DB']):
        raise ValueError('DATABASE_URL must match the Postgres service settings')
    if values['AUTH_INTERNAL_URL'] != f"http://auth:{ports['AUTH_PORT']}":
        raise ValueError('AUTH_INTERNAL_URL must match the internal auth service port')
    urls = {}
    for name in ('SITE_URL', 'BETTER_AUTH_URL'):
        url = urlsplit(values[name])
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError(f'{name} must be an HTTP(S) URL without credentials, query or fragment')
        urls[name] = url
    origin = values['SITE_URL'].rstrip('/')
    if urls['SITE_URL'].path not in ('', '/'):
        raise ValueError('SITE_URL must be an origin without a path')
    origins = [item.strip() for item in values['CORS_ORIGINS'].split(',')]
    if '*' in origins or origin not in origins:
        raise ValueError('CORS_ORIGINS must explicitly include the site origin, never *')
    # The browser reaches auth through the gateway (nginx) or the Vite dev proxy, never directly.
    if values['BETTER_AUTH_URL'] != origin:
        raise ValueError('BETTER_AUTH_URL must be the SITE_URL origin')
    if environment == 'production':
        if urls['SITE_URL'].scheme != 'https':
            raise ValueError('Production SITE_URL must be an HTTPS origin')
        if values['AUTH_COOKIE_DOMAIN'] != urls['SITE_URL'].hostname:
            raise ValueError('AUTH_COOKIE_DOMAIN must be the SITE_URL hostname')
    return values
