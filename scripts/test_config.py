import importlib.util
import json
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest
from unittest.mock import patch
from env_config import ROOT, read_env, validate

spec = importlib.util.spec_from_file_location('init_env', ROOT / 'scripts/init-env.py')
init_env = importlib.util.module_from_spec(spec)
spec.loader.exec_module(init_env)


class EnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / '.env.example').write_text((ROOT / '.env.example').read_text())
        ci = read_env(ROOT / '.env.example')
        with patch.object(init_env, 'ROOT', self.root):
            init_env.create('development')
            init_env.create('production', ci['CI_SITE_URL'], int(ci['CI_FRONTEND_HOST_PORT']))

    def test_separate_credentials_and_owner_only_permissions(self):
        dev = read_env(self.root / '.env.development')
        prod = read_env(self.root / '.env.production')
        for key in ('POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET', 'AI_KEYS_ENCRYPTION_KEY'):
            self.assertNotEqual(dev[key], prod[key])
        self.assertEqual((self.root / '.env.production').stat().st_mode & 0o777, 0o600)
        self.assertEqual(prod['VITE_APP_NAME'], read_env(ROOT / '.env.example')['VITE_APP_NAME'])
        validate(dev, 'development')
        validate(prod, 'production')

    def test_existing_environment_is_never_overwritten(self):
        before = (self.root / '.env.production').read_bytes()
        with patch.object(init_env, 'ROOT', self.root), self.assertRaises(FileExistsError):
            ci = read_env(ROOT / '.env.example')
            init_env.create('production', ci['CI_SITE_URL'], int(ci['CI_FRONTEND_HOST_PORT']))
        self.assertEqual(before, (self.root / '.env.production').read_bytes())

    def test_rejects_mixed_environment_and_invalid_connections(self):
        values = read_env(self.root / '.env.production')
        for key, value in (
            ('APP_ENV', 'development'), ('AI_KEYS_ENCRYPTION_KEY', 'invalid'),
            ('DATABASE_URL', 'postgres://invalid'), ('CORS_ORIGINS', '*'),
            ('VITE_API_BASE_URL', values['VITE_SITE_URL']), ('AUTH_INTERNAL_URL', values['VITE_SITE_URL']),
            ('FRONTEND_PORT', '0'), ('BETTER_AUTH_SECRET', 'short'),
        ):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate({**values, key: value}, 'production')

    def compose(self, environment):
        short = 'prod' if environment == 'production' else 'dev'
        env = {key: value for key, value in os.environ.items() if key not in read_env(ROOT / '.env.example')}
        result = subprocess.run([
            'docker', 'compose', '--project-directory', str(ROOT), '--env-file',
            str(self.root / f'.env.{environment}'), '-f', str(ROOT / f'docker-compose.{short}.yml'),
            'config', '--format', 'json',
        ], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, 'Compose configuration failed to validate')
        return json.loads(result.stdout)

    def test_production_only_publishes_gateway_and_no_secret_reaches_frontend(self):
        services = self.compose('production')['services']
        for name in ('postgres', 'backend', 'auth'):
            self.assertFalse(services[name].get('ports'))
        ports = services['frontend']['ports']
        self.assertEqual(len(ports), 1)
        values = read_env(self.root / '.env.production')
        self.assertEqual(ports[0]['published'], values['FRONTEND_HOST_PORT'])
        self.assertEqual(ports[0]['host_ip'], values['HOST_BIND_ADDRESS'])
        for environment in ('production', 'development'):
            frontend = self.compose(environment)['services']['frontend']
            for source in (frontend.get('environment', {}), frontend.get('build', {}).get('args', {})):
                self.assertFalse(set(source) & {'DATABASE_URL', 'POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET', 'AI_KEYS_ENCRYPTION_KEY'})
        self.assertTrue(all(not service.get('volumes') for name, service in services.items() if name != 'postgres'))

    def test_compose_has_all_required_runtime_and_build_variables(self):
        services = self.compose('production')['services']
        self.assertEqual(set(services['frontend']['build']['args']), {key for key in read_env(ROOT / '.env.example') if key.startswith('VITE_')})
        self.assertIn('AUTH_COOKIE_DOMAIN', services['auth']['environment'])
        self.assertIn('AI_KEYS_ENCRYPTION_KEY', services['backend']['environment'])
        self.assertEqual(set(services['postgres']['environment']), {'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_PORT'})

    def test_wrapper_ignores_exported_values_from_another_environment(self):
        scripts = self.root / 'scripts'
        scripts.mkdir()
        for name in ('compose.sh', 'validate-env.py', 'env_config.py'):
            shutil.copy(ROOT / 'scripts' / name, scripts / name)
        for name in ('docker-compose.dev.yml', 'docker-compose.prod.yml'):
            shutil.copy(ROOT / name, self.root / name)
        env = {**os.environ, **read_env(self.root / '.env.development')}
        result = subprocess.run(['sh', str(scripts / 'compose.sh'), 'production', 'config', '--format', 'json'],
                                capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, 'Wrapper failed to select production configuration')
        services = json.loads(result.stdout)['services']
        self.assertEqual(services['backend']['environment']['APP_ENV'], 'production')
        values = read_env(self.root / '.env.production')
        self.assertEqual(services['frontend']['ports'][0]['published'], values['FRONTEND_HOST_PORT'])

    def test_missing_required_environment_value_stops_compose(self):
        values = read_env(self.root / '.env.production')
        values.pop('AUTH_COOKIE_DOMAIN')
        with self.assertRaises(ValueError):
            validate(values, 'production')
        env = {key: value for key, value in os.environ.items() if key not in read_env(ROOT / '.env.example')}
        result = subprocess.run(['docker', 'compose', '--env-file', '/dev/null', '-f',
                                 str(ROOT / 'docker-compose.prod.yml'), 'config', '--quiet'],
                                capture_output=True, text=True, env=env)
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
