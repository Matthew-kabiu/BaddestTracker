#!/usr/bin/env python3
"""Run the same native quality gates locally and in CI. Never starts Docker services."""
import argparse
import os
import subprocess
from env_config import ROOT, read_env, validate


def run(command, cwd=ROOT, env=None):
    print('+ ' + ' '.join(command), flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true', help='also compile production source builds')
    parser.add_argument('--environment', choices=('development', 'production'), default='development')
    args = parser.parse_args()
    values = validate(read_env(ROOT / f'.env.{args.environment}'), args.environment)
    public = os.environ.copy()
    # Private credentials are never passed to frontend compilation or tests.
    public.update({key: value for key, value in values.items() if key.startswith('VITE_') or key in ('FRONTEND_PORT', 'FRONTEND_HOST_PORT')})
    frontend = ROOT / 'code/frontend'
    auth = ROOT / 'code/auth'
    backend = ROOT / 'code/backend'
    run(['cargo', 'fmt', '--all', '--check'], backend)
    run(['cargo', 'clippy', '--locked', '--workspace', '--all-targets', '--', '-D', 'warnings'], backend)
    run(['cargo', 'check', '--locked', '--workspace', '--all-targets'], backend)
    run(['cargo', 'test', '--locked', '--workspace'], backend)
    run(['pnpm', 'lint'], frontend)
    run([str(frontend / 'node_modules/.bin/oxlint'), 'code/auth/src'])
    run(['pnpm', 'typecheck'], auth)
    run(['pnpm', 'typecheck'], frontend)
    run(['pnpm', 'test'], frontend, public)
    run(['python3', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'])
    for environment in ('development', 'production'):
        run(['sh', 'scripts/compose.sh', environment, 'config', '--quiet'])
    if args.build:
        run(['cargo', 'build', '--locked', '--release', '--workspace'], backend)
        run(['pnpm', 'build'], auth)
        run(['pnpm', 'build'], frontend, public)
        run(['python3', 'scripts/verify-site-build.py', args.environment])


if __name__ == '__main__':
    main()
