#!/usr/bin/env python3
import argparse
from env_config import ROOT, read_env, validate

parser = argparse.ArgumentParser(description='Validate environment relationships without displaying values.')
parser.add_argument('environment', choices=('development', 'production'))
args = parser.parse_args()
try:
    validate(read_env(ROOT / f'.env.{args.environment}'), args.environment)
except (ValueError, OSError) as error:
    parser.exit(1, f'Environment validation failed: {error}\n')
print(f'{args.environment} environment contract is valid.')
