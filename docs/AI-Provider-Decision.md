# AI Provider Layer — Decision Record

Date: 2026-10-12 · Owner: Matt · Status: Locked for v1

## Decision

The AI assistant talks to models through **one internal trait, `LlmProvider`**, with
one adapter per wire protocol. Users bring their own API keys (BYOK). The app ships
with no model credentials of its own.

Supported providers at launch: **Anthropic, OpenAI, OpenRouter, Google Gemini.**

## Why a wrapper, not one vendor SDK

- Matt wants to switch models per task and per cost without code changes.
- BYOK means the app cannot assume any one vendor is configured.
- Tool calling (the AI acting on the DB through service methods) must look identical
  to the rest of the app regardless of vendor.

## Shape

```
ai/
├── provider.rs        # trait LlmProvider { async fn chat(&self, req: ChatRequest) -> Result<ChatResponse, AppError> }
├── types.rs           # ChatRequest, Message, Role, ToolSpec, ToolCall, ChatResponse, Usage — OUR types, vendor-neutral
├── openai_compat.rs   # OpenAI + OpenRouter (same wire format; differs only in base URL + extra headers)
├── anthropic.rs       # Messages API
├── gemini.rs          # generateContent API
├── registry.rs        # (provider_kind, api_key, model) -> Box<dyn LlmProvider>; built per request from the user's stored key
├── tools.rs           # tool definitions = thin wrappers over existing Service methods, scoped to the current user
└── service.rs         # the agent loop: send → if tool_calls → execute → append → repeat (bounded)
```

Three adapters cover four vendors because OpenRouter speaks the OpenAI chat
completions format. Each adapter does exactly two things: serialize our
`ChatRequest` to the vendor's JSON, and parse the vendor's JSON back into our
`ChatResponse`. No business logic.

## Rules

1. **Vendor types never leave `ai/`.** Services, handlers, and the frontend see only
   `types.rs`.
2. **The model never gets a database connection.** It gets tools, and every tool is a
   call into an existing `Service` method with the authenticated user's ID already
   bound. The password vault is excluded entirely (it is ciphertext server-side).
3. **BYOK keys are user data.** Stored per user, encrypted at rest with the app's data
   key (`chacha20poly1305`, key from `Config`), decrypted only for the duration of a
   request, held as `SecretString`, never logged. Not end-to-end: the server must use
   them. This is a different trust model from the vault and is documented as such.
4. **One `reqwest::Client`** in `AppState`, with timeout, shared by all adapters.
5. **The agent loop is bounded:** max tool rounds and max tokens per request come from
   `Config`; exceeding either returns a clean `AppError`, never a hang.
6. **Streaming is deferred.** v1 returns complete responses. Streaming is an additive
   method on the trait when the UI needs it.
7. **Per-user default model** is a setting (`provider_kind` + `model`), changeable in
   the UI, with the app suggesting a sensible default per provider.

## Not decided (deliberately)

Embeddings / pgvector for semantic search · prompt caching · a local-model provider
(Ollama fits the OpenAI-compat adapter if ever wanted) · cost tracking beyond storing
`Usage` on each AI message.
