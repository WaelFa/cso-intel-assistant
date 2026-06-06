# cso-intel-assistant

Personal AI Assistant for Strategic Intelligence — a VoltAgent-based workspace for a Chief Strategy Officer.

## Stack

- **Framework:** [VoltAgent](https://voltagent.dev) (TypeScript / Node.js)
- **Server:** Hono (`@voltagent/server-hono`)
- **LLM Provider:** [OpenRouter](https://openrouter.ai) via the OpenAI-compatible API (`@ai-sdk/openai` with custom `baseURL`)
- **Memory:** LibSQL (SQLite, local file at `./.voltagent/memory.db`)

## Quickstart

```bash
# 1. Install deps
npm install

# 2. Configure OpenRouter key
#    Edit .env and set OPENAI_API_KEY to your sk-or-v1-... key
#    (https://openrouter.ai/keys)
$EDITOR .env

# 3. Start the dev server
npm run dev
# → http://localhost:3141
# → https://console.voltagent.dev to chat with the agent visually
```

## Project layout

```
src/
├── index.ts            # Agent + VoltAgent wiring (LLM, memory, server)
├── tools/
│   ├── index.ts        # Re-exports
│   └── weather.ts      # Example Zod-typed tool
└── workflows/
    └── index.ts        # Example expense-approval workflow
```

## Phases

- [x] **Phase 1** — Environment setup & reconnaissance
- [ ] **Phase 2** — Extraction automation (Zod schemas, structured LLM output)
- [ ] **Phase 3** — Vector + metadata ingestion / custom retrieval tools
- [ ] **Phase 4** — Next.js Executive Dashboard
