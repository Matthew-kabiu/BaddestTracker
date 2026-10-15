# Rust Backend & Service Technical Specification

> **Version:** 1.0.0 | **Status:** Living Document | **Last Updated:** 2026-10-12
> **Author:** Matthew Kabiu — Triffix Innovations (rebranded from SpookieLabsInc — https://triffixsolutions.co.ke)
> **Purpose:** Authoritative reference for Rust services — HTTP APIs and long-running
> workers — built with **Axum + SeaORM + Postgres**. Peer document to
> `Go-Build-Template.md` and `Backend-Build-Template.md` (Node/Express). Governs every
> implementation decision. All contributors and AI assistants MUST follow it.
>
> **Written for a reader who is fluent in Node/TypeScript/Express/Convex and new to
> Rust.** Every rule is anchored to the thing you already know. Where Rust forces a
> different mechanism, §2 says why.

---

## Table of Contents

1. [Document Purpose & LLM Rules](#1-document-purpose--llm-rules)
2. [Coming from Node/TypeScript — the translation table](#2-coming-from-nodetypescript--the-translation-table)
3. [Architecture Overview](#3-architecture-overview)
4. [Folder Structure & Module Rules](#4-folder-structure--module-rules)
5. [Layered Architecture](#5-layered-architecture)
6. [Shared State — `Arc<AppState>` instead of singletons](#6-shared-state--arcappstate-instead-of-singletons)
7. [Async, Cancellation & Timeouts](#7-async-cancellation--timeouts)
8. [Error Handling — `Result`, `?`, and one `AppError`](#8-error-handling--result--and-one-apperror)
9. [Security — OWASP Top 10](#9-security--owasp-top-10)
10. [HTTP Layer & Middleware (tower)](#10-http-layer--middleware-tower)
11. [API Design & OpenAPI](#11-api-design--openapi)
12. [Database — SeaORM + Postgres](#12-database--seaorm--postgres)
13. [Configuration & Environment](#13-configuration--environment)
14. [Logging & Observability — `tracing`](#14-logging--observability--tracing)
15. [Graceful Shutdown](#15-graceful-shutdown)
16. [Long-Running Workers & Schedulers](#16-long-running-workers--schedulers)
17. [Concurrency Rules](#17-concurrency-rules)
18. [Testing Strategy](#18-testing-strategy)
19. [Docker — Dev & Production](#19-docker--dev--production)
20. [Coolify Deployment](#20-coolify-deployment)
21. [Dependency Policy](#21-dependency-policy)
22. [Implementation Checklist](#22-implementation-checklist)
23. [What NOT To Do](#23-what-not-to-do)
24. [Learning Path — read in this order](#24-learning-path--read-in-this-order)

---

## 1. Document Purpose & LLM Rules

### 1.1 Purpose

Single source of truth for building and maintaining Rust services. Written for both
human developers and AI coding assistants. The owner is learning Rust on this
template: **an agent working under it must explain *why* Rust wants something
whenever it departs from the Node way, not just do it.**

### 1.2 Mandatory Behavioural Rules

```
╔══════════════════════════════════════════════════════════════════════╗
║  RULE 1: THINK LIKE A SENIOR ENGINEER                               ║
║  Apply architectural judgment, not just syntax.                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 2: NEVER ASSUME — ALWAYS SEEK CLARIFICATION                   ║
║  Ambiguous requirement? STOP and ask before implementing.            ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 3: SECURITY IS NOT AN AFTERTHOUGHT                            ║
║  OWASP Top 10 compliance is mandatory for every endpoint.            ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 4: DOCUMENT AFTER EVERY IMPLEMENTATION                        ║
║  Update the OpenAPI spec and `///` doc comments. No exceptions.      ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 5: FOLLOW SEPARATION OF CONCERNS                              ║
║  Handler → Service → Repository. No business logic in handlers.      ║
║  No database calls outside repositories.                             ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 6: WRITE IDIOMATIC RUST, NOT TRANSLATED TYPESCRIPT            ║
║  No `.clone()` to silence the borrow checker without a comment.      ║
║  No `.unwrap()` / `.expect()` on the request path. Traits only       ║
║  when there is a second implementation (tests count).                ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 7: BUILD FOR PRODUCTION FROM DAY ONE                          ║
║  Env separation, resource limits, secrets management, graceful       ║
║  shutdown — from the first commit.                                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 8: EVERY ERROR IS HANDLED OR DELIBERATELY IGNORED             ║
║  `Result` is returned with `?`. A `let _ =` on a Result needs a      ║
║  comment. `panic!` never runs on the request path.                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 9: EVERY AWAIT HAS A DEADLINE                                 ║
║  Outbound HTTP, DB, and worker cycles are wrapped in a timeout.      ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 10: THE COMPILER IS THE TEACHER                               ║
║  When rustc or clippy complains, read the whole message and fix      ║
║  the cause. Never suppress a lint to make it go away.                ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Rule 6 is the one most often violated when porting from TypeScript.** Rust will
let you `.clone()` your way past the borrow checker and `.unwrap()` your way past
`Result`; both compile and both are wrong. Where this document departs from the
Node template, §2 explains why.

### 1.3 Clarification Protocol

Before implementing anything ambiguous: state what is unclear, list the possible
interpretations, ask, wait for confirmation.

### 1.4 Companion Frontend Tooling Rule

Rust services do not install browser UI dependencies. When a Rust service includes a
companion browser frontend built in React (Vite or Next.js), pair this specification
with that frontend template and [[Frontend-UI-Motion-Tooling-Standard]]. When the
frontend is also Rust, use [[Rust-Fullstack-Build-Template]], which records the
toolchain deviations that a non-React UI requires.

---

## 2. Coming from Node/TypeScript — the translation table

Your standards are preserved. The **mechanisms** are translated to Rust idiom. Read
this section twice; it is the map for everything that follows.

### 2.1 Vocabulary

| You know (Node/TS)                             | Rust equivalent                                                               | What is actually different                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm` / `package.json` / `node_modules`        | `cargo` / `Cargo.toml` / `~/.cargo/registry`                                  | Lockfile `Cargo.lock` is always committed for a binary. `cargo add axum` = `npm i axum`.  |
| npm registry                                   | crates.io; docs at **docs.rs**                                                | Every crate's docs are auto-published at `docs.rs/<crate>`. Read them; do not guess APIs. |
| `tsc` + `eslint` + `prettier`                  | `cargo check` + `cargo clippy` + `cargo fmt`                                  | Clippy is stricter than ESLint and usually right.                                         |
| `tsserver` in VS Code                          | `rust-analyzer` extension                                                     | Mandatory. Shows inferred types inline.                                                   |
| `nodemon`                                      | `cargo watch -x run` (or `bacon`)                                             |                                                                                           |
| `interface Foo {}`                             | `trait Foo {}`                                                                | Traits are implemented explicitly (`impl Foo for Bar`), never structurally.               |
| `type Shape = Circle \| Square` (union)        | `enum Shape { Circle(..), Square(..) }`                                       | `match` must cover every variant — the compiler enforces exhaustiveness.                  |
| `null` / `undefined`                           | `Option<T>` — `Some(x)` or `None`                                             | There is no null. You cannot forget to check.                                             |
| `throw` / `try { } catch`                      | `Result<T, E>` — `Ok(x)` or `Err(e)`; `?` propagates                          | Errors are values in the return type. `?` is "rethrow upward".                            |
| `async function` / `await`                     | `async fn` / `.await` (postfix)                                               | Futures are lazy — nothing runs until awaited. Needs a runtime: **tokio**.                |
| `Promise.all`                                  | `tokio::join!` / `futures::future::try_join_all`                              |                                                                                           |
| `setTimeout` / `setInterval`                   | `tokio::time::sleep` / `tokio::time::interval`                                |                                                                                           |
| `class` with methods                           | `struct` + `impl` block                                                       | No inheritance. Composition and traits only.                                              |
| `constructor`                                  | an ordinary `fn new(...) -> Self` by convention                               | A constructor function *is* the factory.                                                  |
| Module singleton (`export const logger = ...`) | `Arc<AppState>` built in `main`, passed to handlers                           | See §6. No global mutable state.                                                          |
| `JSON.parse` / `JSON.stringify`                | `serde_json::from_str` / `to_string` with `#[derive(Deserialize, Serialize)]` | Types are declared up front; unknown fields can be rejected.                              |
| zod schema                                     | `#[derive(Deserialize, Validate)]` struct with `validator` attributes         | Shape and validation live on the type.                                                    |
| Prisma                                         | **SeaORM** (entities + migrations, async)                                     | See §12.                                                                                  |
| Winston                                        | `tracing` + `tracing-subscriber`                                              | Structured, span-aware.                                                                   |
| `process.env.X`                                | `std::env::var("X")` → parsed once into a `Config` struct via `envy`          | Never read env ad hoc in code.                                                            |
| Express `app.use(middleware)`                  | tower `Layer`s on the `Router`                                                | Same onion model, composable, typed.                                                      |
| `asyncHandler(fn)` wrapper                     | Handlers return `Result<T, AppError>`; `AppError` implements `IntoResponse`   | No wrapper. The type system makes "forgot to respond" impossible.                         |
| `req.body` after `express.json()`              | `Json<CreateDto>` extractor in the handler signature                          | Extraction + 400 on bad input is automatic.                                               |
| `req.params.id`                                | `Path<Uuid>` extractor                                                        | Typed. A non-UUID is a 400 before your code runs.                                         |
| garbage collector                              | **ownership** — each value has one owner; borrowed with `&` / `&mut`          | This is the one genuinely new idea. §2.3.                                                 |

### 2.2 Deliberate deviations from the Node template

| Node template                                     | Rust template                                                      | Why                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{feature}_module/src/{controllers,services,...}` | `src/{feature}/{handler,service,repository,model}.rs`              | Rust modules map to files. Flat per-feature folder, same separation.                                                                                      |
| Singleton pattern (`Logger.getInstance()`)        | Construct once in `main`, share via `Arc<AppState>`                | Global mutable state in Rust needs `static` + locks and is a code smell. Explicit state is idiomatic and testable.                                        |
| Factory classes                                   | Plain `fn new()` constructors                                      | A function is the factory.                                                                                                                                |
| Builder pattern for queries                       | SeaORM's query builder (`Entity::find().filter(...)`)              | Already a type-checked builder; writing another one adds nothing.                                                                                         |
| "Abstraction is mandatory"                        | Abstract on the second implementation, not the first               | A trait with one implementation is indirection without polymorphism. The second implementation is usually the test fake — that is when you add the trait. |
| Prisma ORM                                        | SeaORM                                                             | Async-native, pure Rust (no system libs to install), ships migrations and an entity generator. Closest to Prisma's workflow of the Rust options.          |
| Redis for sessions / rate limit                   | Optional; in-process `tower_governor` for single-instance services | Add Redis only when horizontally scaled or when state must survive restart.                                                                               |
| Express + classes                                 | Axum + structs + tower                                             | —                                                                                                                                                         |

### 2.3 The one new idea: ownership (what you must know on day one)

Rust has no garbage collector. Every value has exactly one owner, and the value is
freed when the owner goes out of scope. You can **borrow** a value (`&T` read-only,
`&mut T` read-write) without taking ownership, and the compiler checks that borrows
never outlive the owner and that there is never a `&mut` at the same time as any
other borrow.

What this means in practice for a web service — the three situations you will hit:

1. **Handlers need shared things (DB pool, config).** Put them in one struct, wrap it
   in `Arc` (atomic reference count — a cheap shared pointer), and let Axum hand a
   clone of the `Arc` to each handler. Cloning an `Arc` copies a pointer, not the
   data. §6.
2. **You passed a `String` into a function and can't use it afterwards.** The
   function took ownership. Either pass `&str` (borrow) when the function only reads
   it, or `.clone()` when it genuinely needs its own copy — and say which in a
   comment if it is not obvious.
3. **Data crossing an `.await` must be `Send`.** A mutex guard or a reference held
   across an `.await` is the classic compile error. Fix: scope the lock so it is
   dropped before the await (`let x = { state.lock().value.clone() };`).

When the compiler rejects your code, it is almost always preventing a real bug that
Node would have let you ship. Read the full message — rustc explains itself.

### 2.4 When to use which template

- **Rapid CRUD, team familiarity, lots of npm integrations** → Node template.
- **Daemons, high-concurrency I/O, single static binary, memory-constrained hosts** → Go template.
- **The same cases as Go, plus: correctness-critical code (crypto, money, password
  storage), long-lived personal/infra projects where the compiler's guarantees pay
  back over time, and — for this owner — learning Rust by building** → this template.

---

## 3. Architecture Overview

### 3.1 Service shapes

```
API SERVICE                          WORKER / DAEMON
┌───────────────────┐                ┌───────────────────┐
│ HTTP (axum)       │                │ Scheduler (tokio) │
├───────────────────┤                ├───────────────────┤
│ Handler           │                │ Job               │
├───────────────────┤                ├───────────────────┤
│ Service  (business logic — identical in both)          │
├───────────────────┤                ├───────────────────┤
│ Repository (SeaORM — identical in both)                │
└───────────────────┘                └───────────────────┘
```

**The service layer must not know which shape invoked it.** No `axum::` types below
the handler. This is what makes a service reusable between an endpoint and a job.

### 3.2 Request lifecycle

```
Request
  → RequestId         assign/propagate correlation ID        (tower-http)
  → Trace             span per request: method, path, status (tower-http)
  → CatchPanic        convert panic to 500, log               (tower-http)
  → Timeout           per-request deadline                    (tower-http)
  → SecurityHeaders   HSTS, nosniff, frame-options, referrer  (tower-http set_header)
  → Cors              explicit allowlist, never wildcard      (tower-http)
  → BodyLimit         reject oversized payloads               (axum DefaultBodyLimit)
  → RateLimit         per-route configuration                 (tower_governor)
  → Authenticate      identity — who are you                  (extractor / middleware)
  → Authorize         permission — are you allowed            (extractor / middleware)
  → Validate          Json<Dto> + validator                   (extractor)
  → Handler           thin; extracts input, calls service, returns Result
  → Service           business logic; returns AppError variants
  → Repository        SeaORM only
  → Response          standard envelope; AppError → IntoResponse maps centrally
```

---

## 4. Folder Structure & Module Rules

### 4.1 Canonical layout (single crate — start here)

```
service/
├── Cargo.toml
├── Cargo.lock                   # committed
├── src/
│   ├── main.rs                  # wiring ONLY — build state, router, run
│   ├── lib.rs                   # `pub mod` list; lets tests import the crate
│   ├── config.rs                # env parsing + validation (fail fast)
│   ├── state.rs                 # AppState struct
│   ├── error.rs                 # AppError enum + IntoResponse
│   ├── http/                    # transport plumbing, not business logic
│   │   ├── mod.rs
│   │   ├── router.rs            # route table — one place, like routes.ts
│   │   ├── respond.rs           # envelope helpers
│   │   ├── extract.rs           # ValidatedJson, AuthUser extractors
│   │   └── middleware.rs        # security headers, auth
│   ├── db/
│   │   ├── mod.rs               # pool construction, health check
│   │   └── entities/            # SeaORM OUTPUT (sea-orm-cli generate) — never hand-edited
│   ├── {feature}/               # one module per domain
│   │   ├── mod.rs
│   │   ├── handler.rs           # HTTP adapters
│   │   ├── service.rs           # business logic
│   │   ├── repository.rs        # DB access
│   │   ├── model.rs             # domain types + DTOs
│   │   └── service_test.rs      # or #[cfg(test)] mod tests inside service.rs
│   └── platform/                # cross-cutting: auth, ratelimit, crypto
├── migration/                   # SeaORM migration crate (cargo workspace member)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       └── m2026..._create_x.rs
├── api/openapi.yaml             # updated after EVERY endpoint
├── docker/
│   ├── Dockerfile.dev
│   └── Dockerfile.prod
├── .env.example
├── Makefile                     # or justfile — run, test, lint, migrate, build
└── rust-toolchain.toml          # pins the Rust version
```

**Workspace note.** `migration/` is a separate crate because SeaORM's CLI expects it.
`Cargo.toml` at the root declares `[workspace] members = [".", "migration"]`. Do not
split the service into more crates until compile time or a second binary forces it.

### 4.2 Module rules

| Rule | ✅ | ❌ |
|---|---|---|
| Short, lowercase, singular, snake_case | `incident` | `incident_module`, `incidents`, `IncidentSvc` |
| Name describes what it provides | `ratelimit` | `utils`, `helpers`, `common`, `base` |
| No stutter with its own type | `incident::Service` | `incident::IncidentService` |
| Everything private by default; `pub` only what another module needs | `pub(crate) fn` | `pub` on everything |
| No circular `use` between service and repository | service → repository | repository → service |

**Banned module names:** `utils`, `helpers`, `common`, `shared`, `misc`, `base`.

### 4.3 New feature checklist

- [ ] `src/{feature}/` created with handler, service, repository, model
- [ ] Migration added under `migration/src/`, registered in `migration/src/lib.rs`
- [ ] Entities regenerated (`sea-orm-cli generate entity`) — never hand-edited
- [ ] Routes registered in `http/router.rs`
- [ ] `api/openapi.yaml` updated
- [ ] Service tests written
- [ ] `///` doc comments on every `pub` item
- [ ] Security checklist (§9.3) completed
- [ ] `cargo clippy -- -D warnings` clean

---

## 5. Layered Architecture

### 5.1 Handler

**Does:** extract + validate input · call one service method · return the response.
**Must not:** contain business logic · touch the database · perform authorization
decisions (an extractor/middleware does that).

```rust
/// POST /api/v1/incidents
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,                               // extractor: 401 if missing
    ValidatedJson(req): ValidatedJson<CreateIncidentRequest>, // 400 if invalid
) -> Result<impl IntoResponse, AppError> {
    let incident = state.incidents.create(user.id, req.into()).await?;
    Ok(respond::created(incident, "Incident created"))
}
```

Compare with Express: the three "extractors" in the signature are what `express.json()`,
your auth middleware, and zod did. If any of them fails, the handler body never runs
and the client gets the right status — no wrapper, no `next(err)`.

### 5.2 Service

**Does:** all business logic · orchestrate repositories · enforce rules · return
`AppError` · coordinate side effects.
**Must not:** `use axum::` · know about JSON · build queries.

```rust
pub struct Service {
    repo: Repository,       // concrete at first; a trait only when a fake is needed
}

impl Service {
    pub fn new(repo: Repository) -> Self { Self { repo } }

    pub async fn create(&self, owner: Uuid, input: CreateInput) -> Result<Incident, AppError> {
        if self.repo.find_open_by_node(input.node_id).await?.is_some() {
            return Err(AppError::Conflict("an incident is already open for this node".into()));
        }
        self.repo.create(owner, input).await
    }
}
```

The `?` after `find_open_by_node(...).await` is `if (err) throw err` in one character.
It works because `Repository` errors convert into `AppError` via a `From` impl (§8).

### 5.3 Repository

**Does:** SeaORM only. Maps entities to domain types. Translates DB errors.
**Must not:** contain business rules or validation.

```rust
pub struct Repository { db: DatabaseConnection }

impl Repository {
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Incident>, AppError> {
        let row = incident::Entity::find_by_id(id).one(&self.db).await?;
        Ok(row.map(Incident::from))
    }
}
```

Returning `Option<Incident>` (not an error) for "not found" lets the *service* decide
whether absence is an error — a 404 for a GET, fine for an idempotent check.

### 5.4 Response envelope

Identical shape to the Node and Go templates, so clients are portable across all three.

```json
// Success
{ "success": true, "message": "...", "data": {}, "meta": {} }

// Error — never a stack trace, never an internal message in production
{ "success": false, "error": "VALIDATION_ERROR", "message": "...",
  "statusCode": 400, "timestamp": "...", "path": "/api/v1/...",
  "requestId": "..." }
```

---

## 6. Shared State — `Arc<AppState>` instead of singletons

**Rule: no global mutable state.** Everything is constructed in `main` and shared
through one `AppState`.

```rust
// state.rs
pub struct AppState {
    pub config: Config,
    pub db: DatabaseConnection,       // SeaORM's connection is already a pool
    pub incidents: incident::Service,
}

// main.rs
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::load()?;                       // fails fast on bad env
    platform::tracing::init(&config);

    let db = db::connect(&config).await?;
    Migrator::up(&db, None).await?;                     // migrate before serving

    // Wiring — the only place the graph is assembled.
    let incidents = incident::Service::new(incident::Repository::new(db.clone()));

    let state = Arc::new(AppState { config, db, incidents });
    let app = http::router(state.clone());

    http::serve(app, &state.config).await              // graceful shutdown inside
}
```

Why `Arc`: Axum runs handlers on many threads. `Arc<T>` is a thread-safe shared
pointer — cloning it (which Axum does per request) is a pointer copy. Anything inside
that must be *mutated* at runtime (a cache, a counter) goes behind `tokio::sync::RwLock`
or `Mutex`; the DB connection and config do not need that.

`anyhow::Result` in `main` only: it is the "any error, with context" type for places
where you will never match on the error. Library and request code use the typed
`AppError`.

**Permitted globals:** `const` values and `static` immutable data (`LazyLock` for
compiled regexes). Nothing else.

---

## 7. Async, Cancellation & Timeouts

Rust async is cooperative. A future does nothing until polled, and dropping a future
cancels it. Two consequences that have no Node analogue:

- **Never block the runtime.** No `std::thread::sleep`, no synchronous file/DB/crypto
  work inside an `async fn`. CPU-heavy work (argon2 hashing is the common one) goes in
  `tokio::task::spawn_blocking`.
- **Timeouts are explicit wrappers.** `tokio::time::timeout(Duration, fut).await`.

```rust
// Every outbound call gets a deadline.
let resp = tokio::time::timeout(Duration::from_secs(5), client.get(url).send()).await??;
//                                                                              ^^ outer: Elapsed, inner: reqwest

// CPU-bound work off the runtime.
let hash = tokio::task::spawn_blocking(move || platform::crypto::hash_password(&pw)).await??;
```

Rules:
- A `reqwest::Client` is built **once** (in `AppState`) with `.timeout(...)` set. A
  client without a timeout is a defect.
- The DB connection is configured with `connect_timeout`, `acquire_timeout`, and
  `idle_timeout` (§12).
- Loops over user-sized input check for shutdown (§16) between items.

---

## 8. Error Handling — `Result`, `?`, and one `AppError`

### 8.1 The one error type

```rust
// error.rs
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]            Validation(String),
    #[error("{0}")]            ValidationFields(Vec<FieldError>),
    #[error("unauthorized")]   Unauthorized,
    #[error("forbidden")]      Forbidden,
    #[error("{0} not found")]  NotFound(&'static str),
    #[error("{0}")]            Conflict(String),
    #[error("rate limited")]   RateLimited,
    #[error("internal error")] Internal(#[from] anyhow::Error),   // wrapped cause — logged, NEVER serialized
}

// Database errors become Internal automatically, so `?` works in repositories.
impl From<sea_orm::DbErr> for AppError {
    fn from(e: sea_orm::DbErr) -> Self { AppError::Internal(e.into()) }
}

impl AppError {
    fn code(&self) -> (StatusCode, &'static str) {
        match self {
            Self::Validation(_) | Self::ValidationFields(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            Self::Forbidden    => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            Self::NotFound(_)  => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            Self::Conflict(_)  => (StatusCode::CONFLICT, "CONFLICT"),
            Self::RateLimited  => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED"),
            Self::Internal(_)  => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        }
    }
}

// This is the whole "central error mapper". Axum calls it for any handler that returns Err.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = self.code();
        let message = match &self {
            Self::Internal(cause) => {
                tracing::error!(error = ?cause, "request failed");   // full cause: logs only
                "An unexpected error occurred".to_string()
            }
            other => other.to_string(),
        };
        respond::error(status, code, message).into_response()
    }
}
```

### 8.2 Rules

- Services and repositories return `Result<T, AppError>`; `?` propagates.
- Add context on the way up for internal errors: `.context("create incident")?`
  (from `anyhow::Context`).
- Match on variants — **never** string-match an error message.
- `unwrap()` / `expect()` are permitted only in `main` startup (where failure should
  abort) and in tests. Clippy's `unwrap_used` lint is enabled for `src/`.
- `panic!` never on the request path. `CatchPanicLayer` exists as a backstop, not a
  strategy.
- For a reader coming from TS: `thiserror` writes the boilerplate that makes an enum
  usable as an error; `anyhow` is the "I don't care which error, keep the chain" bag.
  Public API surfaces use the enum; `main` and internal causes use anyhow.

---

## 9. Security — OWASP Top 10

### 9.1 Mitigation matrix

| # | Risk | Rust mitigation |
|---|---|---|
| A01 | Broken Access Control | `AuthUser` extractor on protected routes; ownership checks in the service layer; deny by default |
| A02 | Cryptographic Failures | `argon2` (Argon2id) for passwords; `rand::rngs::OsRng` for tokens; `secrecy::SecretString` for secrets in memory; `zeroize` on key material; TLS enforced; secrets ≥32 bytes validated at startup |
| A03 | Injection | SeaORM parameterizes every query; `validator` on every DTO; raw SQL only via `Statement::from_sql_and_values`, never string-formatted |
| A04 | Insecure Design | Threat-model per feature; least privilege; expiring tokens; no sensitive data in logs |
| A05 | Misconfiguration | Security headers layer; env validated at boot; CORS allowlist; no debug routes in prod |
| A06 | Vulnerable Components | `cargo audit` + `cargo deny` in CI; `Cargo.lock` committed; Dependabot/Renovate |
| A07 | Auth Failures | Rate-limited auth routes; token rotation; generic failure messages; `subtle::ConstantTimeEq` |
| A08 | Integrity Failures | Signed tokens (`jsonwebtoken`); `cargo deny` license/source checks; `#[serde(deny_unknown_fields)]` on inbound DTOs |
| A09 | Logging Failures | `tracing` structured logs; request IDs; `SecretString` never implements `Display`; audit span on privileged actions |
| A10 | SSRF | Allowlist outbound hosts; resolve and reject private/link-local ranges on user-supplied URLs; `redirect(Policy::none())` on the client |

### 9.2 Mandatory implementations

```rust
// Passwords — Argon2id, salted, via the password-hash API. NEVER SHA/MD5.
use argon2::{Argon2, PasswordHasher, PasswordVerifier, password_hash::{SaltString, rand_core::OsRng}};
pub fn hash_password(pw: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default().hash_password(pw.as_bytes(), &salt)?.to_string())
}

// Token / secret comparison — constant time, always.
use subtle::ConstantTimeEq;
if given.as_bytes().ct_eq(expected.as_bytes()).unwrap_u8() != 1 {
    return Err(AppError::Unauthorized);           // one generic message
}

// Random tokens — OS randomness. `rand::thread_rng()` is fine; `fastrand` is a defect here.
let mut buf = [0u8; 32];
OsRng.fill_bytes(&mut buf);

// Secrets in memory — never printable by accident.
pub struct Config { pub jwt_secret: secrecy::SecretString, ... }   // .expose_secret() at use site only

// Inbound DTOs reject unknown fields — catches typos and mass-assignment.
#[derive(Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct CreateIncidentRequest { #[validate(length(min = 1, max = 200))] pub title: String }

// Body size limit — on the router, before any handler.
.layer(DefaultBodyLimit::max(1 << 20))
```

Auth failures return **one** generic message. Never reveal whether an account exists.

### 9.3 Per-feature security checklist

- [ ] Input decoded into a typed DTO with `validator` attributes and `deny_unknown_fields`
- [ ] Body size limited
- [ ] `AuthUser` required where applicable
- [ ] Authorization checked, including resource ownership
- [ ] Rate limiting applied
- [ ] No secrets/PII in the response
- [ ] No secrets/PII in logs (`SecretString` for anything secret)
- [ ] Errors generic to the client, detailed in logs
- [ ] No string-formatted SQL
- [ ] HTTP methods restricted to those intended
- [ ] `cargo audit` clean

### 9.4 Password-vault and end-to-end-encrypted features

If the product stores user secrets (a password manager, private notes), the server
**must never see plaintext.** The client derives a key from the user's master
password (Argon2id, high cost), encrypts with an AEAD (`chacha20poly1305` or
`aes-gcm`), and the server stores ciphertext + nonce + the user's **wrapped** key. The
master password and derived key never leave the client. Server-side rules: `zeroize`
anything that touches key material, no logging of ciphertext sizes beyond what
operations need, and a written threat model before the first migration. This is a
design gate — ask before building.

---

## 10. HTTP Layer & Middleware (tower)

**Framework: Axum.** Rationale: built by the tokio team, uses tower middleware (the
same `Layer`/`Service` model as the rest of the async ecosystem), no macros for
routing, extractors make input handling declarative. The route table reads like
`routes.ts`.

```rust
// http/router.rs — the full surface, readable at once.
pub fn router(state: Arc<AppState>) -> Router {
    let auth = Router::new()
        .route("/login", post(auth::handler::login))
        .layer(GovernorLayer::new(ratelimit::strict()));        // strict on auth

    let protected = Router::new()
        .route("/incidents", get(incident::handler::list).post(incident::handler::create))
        .route("/incidents/{id}", delete(incident::handler::remove))
        .route_layer(middleware::from_fn_with_state(state.clone(), platform::auth::require_user));

    Router::new()
        .route("/api/health", get(health::handler::check))      // unversioned, no auth
        .nest("/api/v1/auth", auth)
        .nest("/api/v1", protected)
        .layer(
            ServiceBuilder::new()                               // order matters: first listed = outermost
                .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
                .layer(PropagateRequestIdLayer::x_request_id())
                .layer(TraceLayer::new_for_http())
                .layer(CatchPanicLayer::new())
                .layer(TimeoutLayer::new(Duration::from_secs(30)))
                .layer(platform::headers::security())
                .layer(platform::cors::from_config(&state.config))
                .layer(DefaultBodyLimit::max(1 << 20)),
        )
        .with_state(state)
}
```

Authorization by role: a second `from_fn_with_state` middleware (`require_role(Role::Admin)`)
on the sub-router that needs it — same shape as the Go template's `Authorize`.

### 10.1 Security headers

```rust
pub fn security() -> impl Layer<...> {
    ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::overriding(X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(SetResponseHeaderLayer::overriding(REFERRER_POLICY, HeaderValue::from_static("strict-origin-when-cross-origin")))
        .layer(SetResponseHeaderLayer::overriding(STRICT_TRANSPORT_SECURITY, HeaderValue::from_static("max-age=31536000; includeSubDomains")))
        .layer(SetResponseHeaderLayer::overriding(HeaderName::from_static("permissions-policy"), HeaderValue::from_static("camera=(), microphone=(), geolocation=()")))
}
```

### 10.2 Validated extractor

```rust
// http/extract.rs — Json + validator in one step, like zod on req.body
pub struct ValidatedJson<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where S: Send + Sync, T: DeserializeOwned + Validate {
    type Rejection = AppError;
    async fn from_request(req: Request, state: &S) -> Result<Self, AppError> {
        let Json(value) = Json::<T>::from_request(req, state).await
            .map_err(|_| AppError::Validation("malformed request body".into()))?;
        value.validate().map_err(field_errors)?;
        Ok(Self(value))
    }
}
```

---

## 11. API Design & OpenAPI

`api/openapi.yaml` **MUST** be updated with every endpoint. Not optional.

**Recommended: `utoipa`** — annotate handlers and DTOs with `#[utoipa::path]` /
`#[derive(ToSchema)]` and generate the spec from code, so spec and implementation
cannot drift. Serve Swagger UI at `/api/docs` in non-production environments only.
The generated YAML is still committed to `api/openapi.yaml` so reviewers see diffs.

Design rules (identical to the Node and Go templates):
- Nouns not verbs; plural collections: `/incidents`, not `/getIncidents`
- Semantic methods; `201` on create, `204` on delete, never `200` for everything
- `/api/v1/` prefix always; `/api/health` unversioned
- Consistent query params: `page`, `limit`, `sort`, `order`, `search`
- Paginated responses always carry `meta`

---

## 12. Database — SeaORM + Postgres

**Stack:** `sea-orm` (async ORM over `sqlx`) · `sea-orm-migration` (migrations as Rust
code) · `sea-orm-cli` (entity generation) · Postgres 17.

Rationale: async-native so it fits tokio/Axum without `spawn_blocking`; pure Rust so
nothing to install on build machines; migrations and entity generation are built in;
the query builder is type-checked. For someone coming from Prisma this is the
closest workflow: migrate → generate → query through typed entities.

### 12.1 Workflow

```bash
# 1. Write a migration (Rust, in migration/src/)
sea-orm-cli migrate generate create_incidents
# 2. Apply it
sea-orm-cli migrate up            # or Migrator::up at service start
# 3. Regenerate entities from the live schema
sea-orm-cli generate entity -o src/db/entities --with-serde none
```

```rust
// migration/src/m20261012_000001_create_incidents.rs
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.create_table(
            Table::create().table(Incident::Table)
                .col(ColumnDef::new(Incident::Id).uuid().not_null().primary_key())
                .col(ColumnDef::new(Incident::NodeId).uuid().not_null())
                .col(ColumnDef::new(Incident::StartedAt).timestamp_with_time_zone().not_null())
                .col(ColumnDef::new(Incident::EndedAt).timestamp_with_time_zone())
                .to_owned(),
        ).await
    }
    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.drop_table(Table::drop().table(Incident::Table).to_owned()).await
    }
}
```

```rust
// Querying — typed, parameterized.
let open = incident::Entity::find()
    .filter(incident::Column::NodeId.eq(node_id))
    .filter(incident::Column::EndedAt.is_null())
    .one(&self.db).await?;
```

### 12.2 Connection

```rust
let mut opt = ConnectOptions::new(config.database_url.expose_secret());
opt.max_connections(config.db_max_conns)       // tune to workload; default 10 is rarely right
   .min_connections(1)
   .connect_timeout(Duration::from_secs(5))
   .acquire_timeout(Duration::from_secs(5))
   .idle_timeout(Duration::from_secs(600))
   .max_lifetime(Duration::from_secs(3600))
   .sqlx_logging(false);                        // query logging via tracing instead
let db = Database::connect(opt).await?;
```

### 12.3 Rules

- All database access lives in `repository.rs` files. None in services or handlers.
- `src/db/entities/` is generated. **Never hand-edited.** Regenerate after every migration.
- Migrations are immutable once merged — fix forward with a new migration.
- Multi-step writes that must be atomic use `db.transaction(|txn| ...)`.
- Never return entity `Model`s to the transport layer — map to domain types in
  `model.rs`, dropping password hashes, secrets, and internal fields. `From<Model>
  for Incident` is the mapper.
- Raw SQL, when genuinely needed, goes through `Statement::from_sql_and_values` with
  bound parameters.

---

## 13. Configuration & Environment

**The process MUST refuse to start on invalid configuration.**

```rust
// config.rs
#[derive(Deserialize, Validate)]
pub struct Config {
    #[validate(custom(function = "one_of_env"))]
    pub app_env: String,                        // development | staging | production
    #[validate(range(min = 1, max = 65535))]
    pub port: u16,
    pub database_url: SecretString,
    #[validate(custom(function = "min_32_bytes"))]
    pub jwt_secret: SecretString,
    #[validate(length(min = 1))]
    pub cors_origins: Vec<String>,              // comma-separated in env; envy splits it
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default = "default_shutdown_secs")]
    pub shutdown_wait_secs: u64,
    #[serde(default = "default_db_max_conns")]
    pub db_max_conns: u32,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();                   // dev convenience; no-op in prod
        let cfg: Config = envy::from_env().context("parse env")?;
        cfg.validate().context("invalid configuration")?;
        Ok(cfg)
    }
}
```

| File | Purpose | Committed |
|---|---|---|
| `.env.example` | Documentation | ✅ Yes |
| `.env.development` | Local dev | ❌ No |
| `.env` | Production (Coolify injects) | ❌ Never |

Secrets are `SecretString` so they cannot be printed by `{:?}`. `Config` derives
`Debug` only through a manual impl that redacts.

---

## 14. Logging & Observability — `tracing`

**`tracing` + `tracing-subscriber`.** JSON in production, pretty text in development.
A span per request (from `TraceLayer`) carries the request ID into every log line
inside it automatically — the thing you had to thread by hand with Winston.

```rust
pub fn init(config: &Config) {
    let filter = EnvFilter::try_new(&config.log_level).unwrap_or_else(|_| EnvFilter::new("info"));
    let fmt = tracing_subscriber::fmt().with_env_filter(filter);
    if config.app_env == "production" { fmt.json().init() } else { fmt.pretty().init() }
}

// In code: structured fields, not format strings.
tracing::info!(incident_id = %incident.id, "incident created");
tracing::warn!(user_id = %user.id, "rate limited");
```

Rules:
- **Never log:** passwords, tokens, API keys, full emails, session IDs, PII.
- **Always log:** request ID, route, status, duration, user ID (not email).
- Levels: `error` (needs attention) · `warn` (degraded) · `info` (state changes,
  lifecycle) · `debug` (development only) · `trace` (never in prod).
- Log once, at the boundary (`IntoResponse for AppError`). Do not log-and-return at
  every layer.
- `#[tracing::instrument(skip(self))]` on service methods gives a span per call for free.
- `/api/health` reports dependency status (DB ping) and is used by Docker, Coolify,
  and the load balancer.

---

## 15. Graceful Shutdown

Mandatory for every service.

```rust
pub async fn serve(app: Router, config: &Config) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!(port = config.port, "listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async { tokio::signal::ctrl_c().await.expect("ctrl_c handler") };
    #[cfg(unix)]
    let term = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("SIGTERM handler").recv().await;
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = term => {} }
    tracing::info!("shutdown signal received");
}
```

`with_graceful_shutdown` stops accepting and drains in-flight requests. The
`TimeoutLayer` (§10) bounds how long a drain can take; `shutdown_wait_secs` is used by
workers (§16) to finish their cycle.

---

## 16. Long-Running Workers & Schedulers

For daemons — collectors, pollers, reminder senders, reconcilers.

```rust
pub async fn run(state: Arc<AppState>, mut shutdown: watch::Receiver<bool>) {
    let mut tick = tokio::time::interval(state.config.worker_interval);
    tick.set_missed_tick_behavior(MissedTickBehavior::Delay);

    run_cycle(&state).await;                     // run immediately; don't wait one interval

    loop {
        tokio::select! {
            _ = tick.tick() => run_cycle(&state).await,
            _ = shutdown.changed() => { tracing::info!("worker stopping"); return; }
        }
    }
}

// run_cycle MUST NOT abort the loop and MUST NOT outlive its interval.
async fn run_cycle(state: &AppState) {
    let start = Instant::now();
    let result = tokio::time::timeout(state.config.cycle_timeout, async {
        let sem = Arc::new(Semaphore::new(state.config.worker_concurrency));   // bounded fan-out
        let mut set = JoinSet::new();
        for target in state.targets().await {
            let permit = sem.clone().acquire_owned().await.expect("semaphore");
            let st = state.clone();
            set.spawn(async move {
                let _permit = permit;
                // Per-item failure is RECORDED, not propagated.
                if let Err(e) = st.probe_and_store(target).await {
                    tracing::error!(error = ?e, "probe failed");
                }
            });
        }
        while set.join_next().await.is_some() {}
    }).await;

    if result.is_err() { tracing::error!("cycle timed out"); }
    if let Err(e) = state.heartbeat().await { tracing::error!(error = ?e, "heartbeat failed"); }
    tracing::info!(duration_ms = start.elapsed().as_millis(), "cycle complete");
}
```

### 16.1 Worker rules

1. **The cycle timeout is shorter than the interval.** Otherwise cycles compound.
2. **Bounded concurrency** via `Semaphore`. Unbounded `spawn` over a large list
   exhausts connections and descriptors.
3. **Individual failures are recorded, never propagated.**
4. **Emit a heartbeat every cycle.**
5. **Run once on startup**, then tick.
6. **Cycle duration is logged and monitored.**
7. **Retries use bounded exponential backoff with jitter** (`backon` or `tokio-retry`).
   Never a bare `loop` retry.
8. A worker binary shares the same `AppState`, services, and repositories as the API —
   it is `src/bin/worker.rs` wiring the same graph differently, nothing more.

---

## 17. Concurrency Rules

Rust prevents data races at compile time; it does not prevent deadlocks, leaks, or
unbounded work.

- **Never `tokio::spawn` without knowing how it ends.** Every task has a termination
  path: a shutdown signal, a `JoinSet` that is awaited, or a bounded piece of work.
- **The caller decides concurrency.** Services expose ordinary `async fn`s; the caller
  (`join!`, `JoinSet`) parallelizes. No hidden spawns inside services.
- **Always bound fan-out** (`Semaphore` or `buffer_unordered(n)`).
- **Hold locks briefly and never across `.await`.** Use `tokio::sync::Mutex` only when
  the guard genuinely must cross an await; otherwise `std::sync::Mutex` and scope it.
- **Channels for handoff (`mpsc`, `watch`), locks for state.** Not the other way around.
- **`Arc<Mutex<HashMap>>` is a smell** past the prototype stage; `dashmap` or a
  dedicated service with a channel is usually the real design.
- **No `block_on` inside async code.** It deadlocks the runtime.
- **CPU-bound work** (`argon2`, image processing, large JSON) → `spawn_blocking`.

---

## 18. Testing Strategy

Rust tests live next to the code (`#[cfg(test)] mod tests`) or in `tests/` for
integration tests that use the crate as a black box.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_duplicate_open_incident() {
        let repo = FakeRepository::with_open_incident(node_id);   // hand-written fake
        let svc = Service::new(repo);
        let err = svc.create(owner, CreateInput { node_id }).await.unwrap_err();
        assert!(matches!(err, AppError::Conflict(_)));
    }
}
```

When a fake is needed, that is the moment the repository gets a trait
(`trait IncidentRepo`) and `Service` becomes `Service<R: IncidentRepo>`. Not before.

| Layer | Approach | Target |
|---|---|---|
| Service | Unit tests with hand-written fakes | High — this is where the logic is |
| Repository | `testcontainers` against real Postgres, or a dedicated test DB | Query correctness |
| Handler | `tower::ServiceExt::oneshot` against the `Router` — no network | Status codes, envelope shape |
| Middleware | Same, via `oneshot` | Auth/authz enforcement |

Rules: no `sleep` for synchronization — use `tokio::time::pause()` or channels.
Tests are independent and parallel-safe (cargo runs them in parallel by default).
`unwrap()` is fine in tests. CI runs `cargo test`, `cargo clippy -- -D warnings`,
`cargo fmt --check`, `cargo audit`, `cargo deny check`.

---

## 19. Docker — Dev & Production

### 19.1 Dockerfile.dev

```dockerfile
FROM rust:1-slim-bookworm

WORKDIR /app
RUN cargo install cargo-watch sea-orm-cli

# Cache dependencies: build a dummy main first so the deps layer survives source edits.
COPY Cargo.toml Cargo.lock ./
COPY migration/Cargo.toml migration/
RUN mkdir -p src migration/src && echo 'fn main(){}' > src/main.rs \
 && echo '' > migration/src/lib.rs && cargo build && rm -rf src migration/src

COPY . .
# Listen port comes from the environment; EXPOSE is not needed.
ENTRYPOINT ["sh", "scripts/entrypoint-dev.sh"]       # migrate, then cargo watch -x run
```

### 19.2 Dockerfile.prod

```dockerfile
# cargo-chef computes a dependency recipe so the deps layer is cached across source changes.
FROM lukemathwalker/cargo-chef:latest-rust-1-slim-bookworm AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin api

# ────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgcc-s1 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/api /app
USER 65532:65532
# Listen port comes from the environment; EXPOSE is not needed.
ENTRYPOINT ["/app"]
```

The runtime matches the builder's Debian/glibc release because Rust std links
against glibc by default. Baddest Tracker uses Docker Hub's Debian slim runtime:
the deployment server cannot resolve the distroless manifest from gcr.io (403).
Install CA certificates for outbound HTTPS and libgcc for the compiled binary;
run as an unprivileged numeric UID/GID. Debian slim includes a shell/package
manager, so it is larger than distroless, but requires no Rust build tools.
Use `rustls` features on `reqwest`/`sea-orm` so OpenSSL is never needed.

**Healthcheck note:** keep probes independent of shell tools. Build a `--health` flag into
the binary (it performs `GET /api/health` and exits 0/1), or define the healthcheck at
the compose/Coolify level.

### 19.3 Compose (production shape)

```yaml
services:
  api:
    build: { context: ., dockerfile: docker/Dockerfile.prod }
    ports:
      - "${HOST_BIND_ADDRESS:?required}:${BACKEND_HOST_PORT:?required}:${BACKEND_PORT:?required}"
    env_file: [.env.production]
    depends_on:
      postgres: { condition: service_healthy }
    deploy:
      resources:
        limits:       { cpus: '1',    memory: 256M }
        reservations: { cpus: '0.25', memory: 64M }
    healthcheck:
      test: ["CMD", "/app", "--health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Rust services need even less memory than Go — 64-256 MB is typical. Set limits
accordingly.

---

## 20. Coolify Deployment

Identical operational model to the Node and Go templates.

- Secrets live in Coolify's environment store; no `.env` committed.
- Internal service names for inter-container URLs (`postgres`, not `localhost`).
- Health check: `GET /api/health` → 200.
- Migrations run at service start (`Migrator::up`), before the listener binds.
- Behind Traefik or a Cloudflare Tunnel; the container never binds a public port.

**Pre-deploy checklist**

- [ ] All secrets present in Coolify
- [ ] `JWT_SECRET` ≥32 random bytes; `CORS_ORIGINS` set to real origins
- [ ] External port chosen without collision on the target host
- [ ] Health endpoint verified locally
- [ ] Resource limits set
- [ ] `cargo audit`, `cargo clippy -- -D warnings`, `cargo test` clean
- [ ] Release build is `--release` (debug builds are 10-50× slower)

---

## 21. Dependency Policy

The standard library plus the approved baseline is the default. Every further
dependency needs a justification and Matt's approval.

**Approved baseline** (pin to the current stable version on docs.rs at adoption;
`cargo add` pins a caret range and `Cargo.lock` freezes it)

| Need | Crate | Note |
|---|---|---|
| Runtime | `tokio` (features: `full`) | |
| HTTP | `axum` | |
| Middleware | `tower`, `tower-http` (features: `trace`, `cors`, `timeout`, `request-id`, `set-header`, `catch-panic`) | |
| Rate limiting | `tower_governor` | In-process; Redis only when scaled |
| Serialization | `serde`, `serde_json` | |
| Validation | `validator` (features: `derive`) | |
| Database | `sea-orm` (features: `sqlx-postgres`, `runtime-tokio-rustls`, `macros`), `sea-orm-migration` | |
| Env | `envy`, `dotenvy` | |
| Errors | `thiserror`, `anyhow` | |
| Logging | `tracing`, `tracing-subscriber` (features: `env-filter`, `json`) | |
| IDs / time | `uuid` (features: `v4`, `serde`), `chrono` or `time` (pick one per project) | |
| Auth | `jsonwebtoken`, `argon2`, `subtle` | |
| Secrets | `secrecy`, `zeroize` | |
| Outbound HTTP | `reqwest` (features: `json`, `rustls-tls`; default-features off) | One client in `AppState` |
| Randomness | `rand` | `OsRng` for anything security-relevant |
| OpenAPI | `utoipa`, `utoipa-swagger-ui` (non-prod) | |
| Testing | built-in + `tokio::test`, `testcontainers`, `tower::ServiceExt` | |
| Dev tools | `cargo-watch`, `sea-orm-cli`, `cargo-audit`, `cargo-deny` | Installed globally, not in `Cargo.toml` |

Rules: no unmaintained crates (>1 year without release, unanswered issues) · check
docs.rs and the crate's repo before first use — never from memory · no crate pulling
a large tree for a small feature (`cargo tree` shows it) · `Cargo.lock` committed ·
`cargo audit` and `cargo deny` in CI · prefer copying 20 lines over adding a crate for
20 lines · `default-features = false` when a crate drags in OpenSSL or an unused
runtime.

---

## 22. Implementation Checklist

**Bootstrap**
- [ ] `cargo new --bin service`; `rust-toolchain.toml` pins stable
- [ ] Workspace with `migration/` member
- [ ] Layout per §4.1
- [ ] `Config::load()` with validation; service refuses to boot on bad env
- [ ] `tracing` initialised in `main`
- [ ] SeaORM connection with tuned `ConnectOptions`
- [ ] `Migrator::up` at start
- [ ] Entities generated into `src/db/entities/`
- [ ] Middleware stack per §10
- [ ] `AppError` + `IntoResponse`
- [ ] Response envelope helpers
- [ ] Graceful shutdown
- [ ] `/api/health` reporting DB status
- [ ] `Dockerfile.dev` (cargo-watch) and `Dockerfile.prod` (cargo-chef, Debian slim, non-root)
- [ ] Compose with healthchecks, `service_healthy`, resource limits
- [ ] `.env.example` complete
- [ ] Makefile/justfile: `run`, `test`, `lint`, `migrate`, `entities`, `build`
- [ ] `clippy.toml` / `[lints]` in `Cargo.toml`: `unwrap_used`, `expect_used` denied in `src/`
- [ ] CI: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `cargo audit`, `cargo deny check`

**Per feature**
- [ ] Module under `src/{feature}/`
- [ ] Handler thin; service holds logic; repository holds queries
- [ ] Typed `AppError` returns; `?` throughout
- [ ] Every outbound await has a timeout
- [ ] Service tests
- [ ] OpenAPI updated
- [ ] §9.3 security checklist complete
- [ ] `///` doc comments on `pub` items

---

## 23. What NOT To Do

**Architecture**
- ❌ Business logic in handlers; DB calls outside repositories
- ❌ `use axum::` below the handler layer
- ❌ Modules named `utils`, `helpers`, `common`, `shared`
- ❌ Traits with a single implementation and no fake
- ❌ More crates than the workspace needs

**Rust-specific**
- ❌ `.unwrap()` / `.expect()` on the request path
- ❌ `.clone()` to silence the borrow checker without a comment saying why
- ❌ `#[allow(...)]` to silence clippy instead of fixing the cause
- ❌ `std::thread::sleep` or any blocking call inside `async fn`
- ❌ `tokio::spawn` with no termination path
- ❌ Holding a lock across `.await`
- ❌ `block_on` inside the runtime
- ❌ Global mutable `static`s
- ❌ Editing generated code in `src/db/entities/`
- ❌ A `reqwest::Client` without a timeout, or built per request
- ❌ `fastrand` / non-OS randomness for anything security-relevant
- ❌ Debug builds in production

**Security**
- ❌ String-formatted SQL, under any circumstance
- ❌ Stack traces or internal messages in responses
- ❌ Secrets as plain `String` in `Config`; secrets, tokens, or PII in logs
- ❌ `CorsLayer::permissive()` in production
- ❌ Auth errors that reveal whether an account exists
- ❌ Non-constant-time comparison of secrets
- ❌ A server that can read a user's vault plaintext (§9.4)

**Operations**
- ❌ Shipping without graceful shutdown
- ❌ Worker cycles that can outlive their interval
- ❌ Workers without a heartbeat
- ❌ Editing a merged migration
- ❌ Containers running as root
- ❌ Committed `.env`
- ❌ Uncommitted `Cargo.lock`

---

## 24. Learning Path — read in this order

For the owner's first Rust project. Each item is the minimum to work under this
template; skip nothing, and read official sources — not summaries.

1. **The Rust Book, chapters 1-10** (https://doc.rust-lang.org/book/): ownership (4),
   structs (5), enums + `match` (6), modules (7), collections (8), error handling (9),
   generics/traits (10). About a week of evenings. Chapters 4, 6, and 9 are the ones
   that map to §2.3, §8, and the translation table.
2. **Rust By Example — Error handling and `?`**
   (https://doc.rust-lang.org/rust-by-example/error.html) — the `?` operator until it
   is reflexive.
3. **Tokio tutorial** (https://tokio.rs/tokio/tutorial) — through "Select". Skip the
   mini-Redis internals.
4. **Axum docs** (https://docs.rs/axum): the crate-level docs, then `extract`,
   `response`, `middleware`. Read the `examples/` folder in the Axum repo — they are
   short and canonical.
5. **SeaORM docs** (https://www.sea-ql.org/SeaORM/docs/index/): "Install & Config",
   "Generating Entities", "Basic CRUD", "Migration". Nothing else until needed.
6. **`tracing` crate docs** — the overview only.
7. Then: build the first feature under this template with an agent explaining every
   compiler error it fixes. The compiler messages are the rest of the course.

Keep `rust-analyzer` on with inlay hints enabled. Run `cargo clippy` after every file,
not every feature — the lints are the fastest teacher of idiom.
