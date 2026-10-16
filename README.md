# Baddest Tracker

Your tasks, notes, spending and schedule in one self-hosted workspace. Baddest Tracker combines everyday planning with an encrypted password vault, live notifications and bring-your-own AI provider keys.

Built with React, TypeScript, Rust and PostgreSQL. Released under the [MIT License](LICENSE).

## What you can do

- **Plan your day:** manage to-dos and notes from a shared dashboard.
- **Track spending:** organize shopping, record expenses and compare spending against daily, weekly, monthly, quarterly, yearly or custom budgets.
- **Stay on schedule:** create calendar events, set recurring schedules and receive reminders in-app or through a linked Telegram bot.
- **Keep passwords private:** encrypt vault entries in your browser with a separate master password and recovery key.
- **Make it yours:** choose a theme and currency, manage account sessions and connect your own AI provider keys. The AI API supports Anthropic, OpenAI, OpenRouter and Gemini with task and note tools.
- **Stay in sync:** changes appear across open tabs and devices through Server-Sent Events (SSE).

## Stack and structure

| Layer | Technology | Location |
| --- | --- | --- |
| Web app | React, TypeScript, Vite, Tailwind, shadcn/ui, BkLit | `code/frontend` |
| API | Rust, Axum, SeaORM | `code/backend` |
| Authentication | Better Auth, Hono, Node.js | `code/auth` |
| Data | PostgreSQL | Compose-managed volume |
| Production gateway | Unprivileged nginx | `code/frontend/docker` |

The browser uses one public origin in production. nginx serves the app, forwards `/api/auth/*` to authentication and `/api/*` to the Rust API. Only the gateway publishes a host port; auth, API and database communicate on the internal Compose network.

Development uses Vite hot reload, `tsx watch` and `cargo-watch`, with separate host ports for local tools. The two environments use distinct Compose project names and database volumes.

## Requirements

- Docker Engine and Docker Compose v2 or later, supporting `config --format json` and `up --wait`.
- Python 3.10 or later for setup and validation scripts; no extra Python packages are needed.
- For native checks/builds: Node.js 22, Corepack, pnpm as pinned in `package.json`, and Rust as pinned in `code/backend/rust-toolchain.toml`, with Clippy and rustfmt.
- Native Rust builds need a C/C++ compiler, CMake, pkg-config and CA certificates. The production builder installs these prerequisites.
- Production needs an HTTPS origin and a trusted TLS ingress.

## Getting started

Run from the repository root:

```sh
python3 scripts/init-env.py development
sh scripts/compose.sh development config --quiet
sh scripts/compose.sh development up --build
```

The setup script creates `.env.development` with fresh credentials and owner-only file permissions. It will not overwrite an existing file. Check its port values for local conflicts, then open the address configured in `SITE_URL` and create an account.

To stop the stack while keeping your data:

```sh
sh scripts/compose.sh development down
```

## Configuration

| Environment | Configuration | Compose file |
| --- | --- | --- |
| Development | `.env.development` | `docker-compose.dev.yml` |
| Production | `.env.production` | `docker-compose.prod.yml` |

Use `.env.production` as the canonical production filename. Real environment files are ignored; `.env.example` contains only sample settings. The Compose wrapper selects and validates the matching file and prevents exported settings from overriding it.

All deployment ports, origins and credentials come from the selected environment file. Missing required values stop startup. Each service receives only the variables it needs; database credentials and encryption keys are never passed to the frontend.

### Environment reference

| Variables | Purpose |
| --- | --- |
| `APP_ENV` | Environment identity; must match the selected file |
| `LOG_LEVEL` | Rust logging filter |
| `HOST_BIND_ADDRESS` | Host interface for published ports |
| `FRONTEND_PORT`, `BACKEND_PORT`, `AUTH_PORT`, `POSTGRES_PORT` | Internal service ports |
| `FRONTEND_HOST_PORT` | Published gateway port |
| `BACKEND_HOST_PORT`, `AUTH_HOST_PORT`, `POSTGRES_HOST_PORT` | Additional published ports, development only |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database identity and credential |
| `DATABASE_URL`, `DB_MAX_CONNS` | Database connection URL and API connection-pool size |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `BETTER_AUTH_URL` | Browser-facing auth origin, which is the site origin |
| `AUTH_INTERNAL_URL` | API-to-auth address on the Compose network |
| `AUTH_COOKIE_DOMAIN` | Production gateway hostname for session cookies |
| `CORS_ORIGINS` | Explicit allowed browser origins |
| `AI_KEYS_ENCRYPTION_KEY` | Base64-encoded random 32-byte key for provider keys and Telegram tokens |
| `SITE_URL` | Public site origin, read by the frontend container at start |
| `CI_SITE_URL`, `CI_FRONTEND_HOST_PORT` | Disposable test inputs from `.env.example` |

Nothing is embedded in the frontend at build time. The browser reaches the API and auth at `/api` on the site origin, and the frontend container renders `SITE_URL` into the page, crawler files and Content Security Policy when it starts. Restart the frontend service after changing it. When changing an internal port, update its dependent connection URL in the same file.

## Production setup

Choose an available gateway host port after checking host listeners and container mappings. Set your HTTPS origin and chosen port in shell variables, then generate the production file:

```sh
python3 scripts/init-env.py production \
  --site-url "$PRODUCTION_SITE_URL" \
  --frontend-host-port "$PRODUCTION_FRONTEND_HOST_PORT"
python3 scripts/validate-env.py production
sh scripts/compose.sh production config --quiet
```

For an existing installation, preserve its environment file and keys rather than generating replacements. The setup script configures a single public origin for the site, API, auth and cookies.

Route the HTTPS ingress to `http://${HOST_BIND_ADDRESS}:${FRONTEND_HOST_PORT}` using the values from `.env.production`. The supplied topology binds the gateway to host loopback for a host-level tunnel. Auth and API client-IP handling trusts Cloudflare's `CF-Connecting-IP`; preserve that header and the forwarded HTTPS scheme, and keep direct gateway access restricted to the trusted ingress.

Start the production stack when ready:

```sh
sh scripts/compose.sh production up --build -d --wait
sh scripts/compose.sh production ps
```

Health checks order startup: database, auth, API, then frontend. Database migrations apply automatically. Verify the HTTPS site, sign-in, a protected API request and live notifications through your ingress. `/health` checks nginx; `/api/health` checks the API and its database connection.

## Development checks

Install the locked Node dependencies for native tooling:

```sh
corepack enable
pnpm --dir code/frontend install --frozen-lockfile --prod=false
pnpm --dir code/auth install --frozen-lockfile --prod=false
```

With both environment files configured:

```sh
python3 scripts/check.py
```

This runs Rust formatting, Clippy, type checks and tests; frontend/auth lint and TypeScript checks; frontend tests; environment contract tests; and validation of both Compose files. It does not start containers.

To include native production source builds and generated metadata verification:

```sh
python3 scripts/check.py --environment production --build
```

The same quality gates are defined in `.github/workflows/ci.yml`. Source builds compile Rust, auth and frontend artifacts; they do not build Docker images. Keep `Cargo.lock` and both `pnpm-lock.yaml` files available for reproducible dependency installation.

## Data and security

- Application records are scoped to the signed-in account. Production uses secure HTTP-only session cookies and explicit CORS origins.
- Vault entries are encrypted in the browser with Argon2id and XChaCha20-Poly1305. Vault plaintext is excluded from AI tools. See the [vault threat model](docs/Vault-Threat-Model.md).
- AI provider keys and Telegram tokens are encrypted server-side. Preserve `AI_KEYS_ENCRYPTION_KEY` when redeploying or restoring a database.
- Preserve `BETTER_AUTH_SECRET` across redeployments and keep user vault recovery keys separately.
- Real env files, backups, private keys, local databases, generated output and editor/agent state are excluded from version control and image contexts.

Production data lives in the named Postgres volume. Stopping the stack preserves it. Back up before schema-changing upgrades and test restoration into a separate database.

For a logical backup, set `BACKUP_FILE` to your chosen output path:

```sh
umask 077
sh scripts/compose.sh production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -p "$POSTGRES_PORT" --format=custom' \
  > "$BACKUP_FILE"
```

Protect database backups and the matching environment keys outside the repository. Do not include credentials, vault contents or unredacted logs in public issues.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Missing or conflicting settings | Run the matching env validator and use the Compose wrapper |
| Port already in use | Check host listeners and container mappings; update the selected env file |
| Production sign-in fails | Check HTTPS origin, cookie domain, CORS, forwarded scheme and auth routing |
| API cannot identify the session | Check `AUTH_INTERNAL_URL`, auth readiness and cookie forwarding |
| Database rejects changed credentials | Existing volumes retain their original database credentials; update them deliberately |
| Newly added package cannot be resolved | Refresh the affected development image/dependency volume without deleting database data |
| Frontend still uses an old domain | Restart the frontend service so it renders the current `SITE_URL` |
| Live updates arrive only after refresh | Check SSE buffering and timeouts through the ingress |

## Contributing

Keep changes focused, follow nearby code and tests, and update configuration docs when behavior changes. Run the checks above and describe verification and migration steps in your pull request. Never commit real environment values.

For implementation guidance, see [DESIGN.md](docs/DESIGN.md), the [Rust backend guide](docs/Rust-Backend-Build-Template.md), the [frontend guide](docs/Vite-Build-Template.md) and the [AI provider decision](docs/AI-Provider-Decision.md).

## License

[MIT](LICENSE) © 2026 Matthew Kabiu Makundi.
