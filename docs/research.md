# ClearBorder — Pre-Build Research

**Date:** July 4, 2026
**Purpose:** Technology and competition research for "ClearBorder," an AI agent that autonomously resolves packages stuck in customs: (1) live translated phone calls with foreign shippers, (2) computer-use control of a customs web portal with human-in-the-loop confirmation, (3) persistent multi-day memory that survives restarts and learns shipper-specific patterns.

---

## 1. Competition identification

### Verdict: NOT identified with confidence

Extensive searching (10+ query variations across Devpost, lablab.ai, Kaggle, Google/DeepMind official blogs) found **no currently-open competition organized by Google DeepMind whose explicit theme is persistent long-term memory / long-horizon agents with combined AI + human judging.** The description in the brief does not match any single verifiable event as of July 4, 2026. **Before building, get the exact event URL from whoever supplied the brief** — the requirements below differ materially between candidates (mandatory Gemini vs. mandatory Cognee vs. mandatory Qwen).

### Top candidate events (closest matches, with links)

| Event | Organizer | Dates / Deadline | Theme match | Status |
|---|---|---|---|---|
| [The Hangover Part AI: Where's My Context?](https://www.wemakedevs.org/hackathons/cognee) | WeMakeDevs × Cognee | **Jun 29 – Jul 5, 2026** (ends July 5 — tomorrow) | **Exact theme match**: "Build AI that doesn't forget", persistent memory across sessions, $10,000+ prizes, teams ≤ 4, fully virtual | **OPEN but closing** — requires the Cognee memory layer, *not* a DeepMind event |
| [Qwen Cloud Global AI Hackathon — Track 1: MemoryAgent](https://qwencloud-hackathon.devpost.com/rules) | Alibaba/Qwen (Devpost) | Submissions close **Jul 9, 2026**, judging Jul 10–31 | Track 1 is literally "Build an Agent with persistent memory... across multi-turn, cross-session interactions"; rules state judging "may utilize expert panels, peer review, **automated AI-driven analysis**" — matches the "judged by AI models and humans" claim | **OPEN** — but requires Qwen Cloud APIs, not Gemini, not DeepMind |
| [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/) ([announcement](https://cloud.google.com/blog/topics/training-certifications/join-the-gemini-live-agent-challenge), [winners](https://cloud.google.com/blog/topics/developers-practitioners/winners-and-highlights-of-the-gemini-live-agent-challenge)) | Google Cloud | Feb 16 – Mar 16, 2026 | Closest **Google-run** analog: categories "The Live Agent" (real-time translators explicitly cited as inspiration) and "The UI Navigator" (visual web navigation); a memory project ("Rayan Memory") won Best Innovation | **CLOSED** — watch for a second edition |
| [Gemini 3 Hackathon](https://gemini3.devpost.com/) | **Google DeepMind** (Devpost) | Dec 17, 2025 – Feb 9, 2026 | DeepMind-organized, open-ended, $100k pool | **CLOSED** |
| [Build with Gemini XPRIZE](https://xprize.devpost.com/) ([rules](https://www.geminixprize.com/rules)) | XPRIZE + Google (Devpost) | **Deadline Aug 17, 2026** | $2M pool; must use Gemini API; judging may use "automated AI-driven analysis"; but theme is AI-operated *businesses with real revenue*, not memory | **OPEN** — theme mismatch |
| [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/) ([blog](https://info.devpost.com/blog/google-cloud-rapid-agent-hackathon)) | Google Cloud | Submissions May 5 – Jun 11, 2026; winners ~Jul 16 | Gemini 3 + Agent Builder + partner MCP servers; MongoDB track explicitly suggested "an agent with persistent memory" | **CLOSED for submissions** |
| [Cactus × Google DeepMind Hackathon](https://luma.com/f0arqlwy) | DeepMind + Cactus Compute | Feb 21, 2026, one-day | DeepMind-branded but themed on on-device FunctionGemma agents | **CLOSED** |
| [Measuring Progress Toward AGI (Kaggle)](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/measuring-agi-cognitive-framework/) | **Google DeepMind** × Kaggle | Mar 17 – Apr 16, 2026, results Jun 1 | $200k; memory is in DeepMind's 10-ability taxonomy but participants built *benchmarks*, not agents | **CLOSED** |

### Practical implication for judging-proofing the build

If the real event is Google-affiliated, historical judging criteria to build against:

- **Gemini 3 Hackathon:** Technical execution 40% ("does it leverage Gemini 3?"), Innovation/wow 30%, Impact 20%, Presentation 10%; submission = ~3-minute video (judges may not watch past 3 min), public project link, ~200-word Gemini-integration writeup ([source](https://gemini3.devpost.com/)).
- **Gemini Live Agent Challenge:** Innovation & multimodal UX 40%, Technical implementation & agent architecture 30% ("does the code effectively utilize the Google GenAI SDK or ADK? Is the backend hosted on Google Cloud?"), Demo & presentation 30% (architecture diagram, visual proof of deployment); mandatory: a Gemini model + Gen AI SDK or ADK + at least one Google Cloud service (Firestore, Cloud SQL, Cloud Run, Vertex AI) ([source](https://cloud.google.com/blog/topics/training-certifications/join-the-gemini-live-agent-challenge)).

**Safe hedge:** use Gemini APIs via the official GenAI SDK, deploy on Cloud Run, persist in a Google Cloud store (Firestore or Cloud SQL), produce a tight ≤3-min video + architecture diagram + public repo + publicly accessible demo link. That satisfies the union of every Google-event requirement seen in 2026.

---

## 2. Recommended stack (exact names, verified July 4, 2026)

| Layer | Choice | Exact identifier | Status |
|---|---|---|---|
| Live voice (agent ↔ shipper dialogue, tool calls during call) | Gemini Live API native audio | `gemini-3.1-flash-live-preview` | Public preview (launched ~Mar 2026) |
| Live speech-to-speech translation | Gemini Live API translation model | `gemini-3.5-live-translate-preview` | Public preview (launched Jun 9, 2026) |
| Browser/computer use (customs portal) | Computer Use built-in tool | `gemini-3.5-flash` (tool: `computer_use`, `environment: browser`) | Preview capability on a GA model |
| Reasoning / planning / memory extraction | Gemini 3.5 Flash | `gemini-3.5-flash` | GA |
| Cheap background ops (consolidation, summarization) | Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | GA ($0.25/M in, $1.50/M out) |
| Embeddings (semantic memory recall) | Gemini Embedding 2 | `gemini-embedding-2` (multimodal; text $0.20/M; text-only fallback `gemini-embedding-001` at $0.15/M) | GA |
| SDK | Google Gen AI SDK for TypeScript/JavaScript | `@google/genai` (Python: `google-genai`) | GA |
| Browser executor | Playwright (headed, with cursor overlay) | `playwright` | — |
| Memory store | Postgres + `pgvector` (or SQLite + `sqlite-vec` for zero-ops), optionally hosted on Cloud SQL to tick the Google Cloud box | — | — |
| Orchestrator | Hand-rolled TypeScript orchestrator in a Next.js monorepo (see §6) | — | — |

Pricing source for all models: [Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing).

---

## 3. Pillar 1 — Gemini Live API (real-time voice + translation)

### Current model names (mid-2026)

- **`gemini-3.1-flash-live-preview`** — the recommended Live API model for all real-time dialogue: native audio in/out, thinking (`thinkingLevel`), **function calling supported**, search grounding supported, 131,072-token input / 65,536-token output limits ([model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview), [launch blog](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-1-flash-live/)). Older `gemini-2.5-flash-native-audio-preview-12-2025` is deprecated in favor of it; Vertex's `gemini-live-2.5-flash-native-audio` retires Dec 13, 2026.
- **`gemini-3.5-live-translate-preview`** — dedicated streaming speech-to-speech translation model, launched June 9, 2026, public preview via Live API + AI Studio ([launch blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-live-3-5-translate/), [model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-live-translate-preview), [guide](https://ai.google.dev/gemini-api/docs/live-api/live-translate)). Continuous (not turn-by-turn) translation that stays a few seconds behind the speaker, preserves intonation/pacing/pitch, auto-detects 70+ input languages, SynthID-watermarked output. **Audio input only; no function calling; no thinking.**

### Two-way translation support

Yes — this is now a first-class capability, not a hack. Configure `translationConfig` inside `generationConfig` at session setup: `targetLanguageCode` (BCP-47, defaults `"en"`) and `echoTargetLanguage` (bool controlling what happens when input is already in the target language). Input and output transcription events (`inputAudioTranscription` / `outputAudioTranscription`) can be enabled to get text transcripts of both sides — **this is how the memory extractor listens to the call** ([live-translate guide](https://ai.google.dev/gemini-api/docs/live-api/live-translate), [MarkTechPost coverage](https://www.marktechpost.com/2026/06/09/google-releases-gemini-3-5-live-translate-a-streaming-speech-to-speech-audio-model-covering-70-languages-across-meet-translate-and-the-live-api/)).

**Bidirectional pattern:** run two translate sessions — session A (target = shipper's language) receives the operator/agent audio; session B (target = English) receives the shipper audio — and route each translated stream to the opposite party. The model auto-detects source language, so no per-speaker configuration is needed.

### Language coverage (requirement: Chinese, Turkish, French, English)

All four confirmed in the translation model's language table: Chinese Simplified `zh-Hans`, Chinese Traditional `zh-Hant`, Turkish `tr`, French `fr`, English `en` — among 70+ ([table](https://ai.google.dev/gemini-api/docs/live-api/live-translate)). The dialogue model (`gemini-3.1-flash-live-preview`) supports 90+ languages and auto-switches mid-conversation; native-audio models don't accept an explicit language code ([capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities)).

### Session length limits (critical for the demo)

- **Audio-only session: 15 minutes; audio+video: 2 minutes** — *without* context compression.
- **WebSocket connection lifetime: ~10 minutes** regardless of session length; the server sends `GoAway` before terminating.
- Enable **context window compression** (sliding window) for unlimited session duration, and **session resumption** (`sessionResumptionUpdate` → store the latest `newHandle`, pass it in `setup` on reconnect) to survive the 10-minute connection recycling.
- Context window: 128k tokens for native-audio models.
- Sources: [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [official Live API skill](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-live-api-dev/SKILL.md), [field notes on reconnection](https://gemilab.net/en/articles/gemini-api/gemini-live-api-reconnect-token-refresh-session-resumption-notes).

### Pricing / free tier

From the [pricing page](https://ai.google.dev/gemini-api/docs/pricing):

- `gemini-3.1-flash-live-preview`: **free tier: free of charge** (data used to improve products). Paid: audio in $3.00/M tokens (≈ $0.005/min), audio out $12.00/M (≈ $0.018/min), text in $0.75/M.
- `gemini-3.5-live-translate-preview`: **free tier: free of charge.** Paid: $3.50/M in ($0.0053/min), $21.00/M out ($0.0315/min); ≈ **$0.0368 per minute** total (25 tokens/sec of audio).
- Preview models carry tighter rate limits than stable models; concurrent Live sessions are limited per project (view live limits in [AI Studio](https://ai.google.dev/gemini-api/docs/rate-limits)). Link a billing account (Tier 1) for the demo.

### Web-app integration path

- **Protocol: stateful WebSocket (WSS).** The Gemini Live API is natively WebSocket; **WebRTC is only available via partner layers** (LiveKit Agents, Pipecat/Daily, Agora, Fishjam, Stream Vision Agents) ([Live API overview](https://ai.google.dev/gemini-api/docs/live)).
- **Official SDK: `@google/genai`** (Google Gen AI SDK for TS/JS) — `ai.live.connect({model, config, callbacks})`.
- **Recommended topology: client-to-server** (browser connects directly to the Live API over WSS — lowest latency, officially recommended) with **ephemeral tokens**: a Next.js route handler mints tokens via `ai.authTokens.create({...})`, the browser initializes `new GoogleGenAI({ apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' } })`. Gotchas: tokens are **single-use** — mint a fresh one for every reconnect; `apiVersion: 'v1alpha'` must be set on **both** the mint call and the client, or the SDK hits v1beta and fails ([ephemeral tokens doc](https://ai.google.dev/gemini-api/docs/ephemeral-tokens.md.txt), [forum thread confirming the v1alpha gotcha](https://discuss.ai.google.dev/t/gemini-api-ephemeral-token-not-working/99122)).
- Audio formats: input raw 16-bit PCM @ 16 kHz little-endian (send ~100 ms chunks via an AudioWorklet); output 24 kHz PCM.
- **Real outbound phone calls** (to a shipper in China/Turkey): Google lists **Voximplant** as the partner for "inbound and outbound calls to Live API"; Twilio Media Streams is the common DIY path. **Recommendation for the demo: simulate the call in-browser** (a "shipper" tab/actor speaking Chinese or Turkish into a second mic) — deterministic, no telephony latency/compliance risk — and mention the Voximplant path as the production story.

### Function calling during calls

`gemini-3.1-flash-live-preview` supports synchronous function calling — the agent can call `save_memory(...)` / `lookup_case(...)` mid-conversation. The **translate model does not support function calling**, so memory extraction during translated calls must run on the transcription stream instead (feed `inputAudioTranscription`/`outputAudioTranscription` events to a `gemini-3.5-flash` extractor). Both-sides transcripts shown live in the UI double as demo evidence.

---

## 4. Pillar 2 — Gemini computer use (browser control)

### Current state (mid-2026)

- **Computer use is now a built-in tool of `gemini-3.5-flash`** (announced ~June 2026) — no separate model needed. Environments: `browser`, `mobile`, `desktop`. It replaced the standalone `gemini-2.5-computer-use-preview-10-2025` (legacy, still available, browser-optimized) and is also in `gemini-3-flash-preview` ([announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-computer-use-gemini-3-5-flash/), [docs](https://ai.google.dev/gemini-api/docs/computer-use)).
- **Availability: Preview capability, no waitlist** — usable today via the Gemini API (and Gemini Enterprise Agent Platform for enterprises). Docs warn it "may contain errors and security vulnerabilities; supervise closely."
- **API-surface gotcha:** on the new **Interactions API** (now GA and Google's primary API — [announcement](https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/)), computer use is **not yet supported for `gemini-3.5-flash`** — only `gemini-2.5-computer-use-preview-10-2025` and `gemini-3-flash-preview` ([Interactions computer-use doc](https://ai.google.dev/gemini-api/docs/interactions/computer-use)). To use 3.5 Flash computer use, call the **legacy `generateContent` API path** ([doc](https://ai.google.dev/gemini-api/docs/generate-content/computer-use)), which remains fully supported. Decide one path and pin it.

### How it pairs with Playwright

The model never touches the browser; it's an observe→act loop your code drives (Playwright is the documented executor; `pip install google-genai playwright` or the JS equivalents):

1. Send prompt + screenshot + `{"type": "computer_use", "environment": "browser"}` tool config.
2. Model returns a `function_call` (e.g. `click_at`, `type_text_at` with normalized 0–999 coordinates) **plus an `intent` field explaining its reasoning** (3.5 Flash) — render these intents live in the demo UI; judges see the agent "thinking."
3. Your code scales coordinates, executes via Playwright (`headless: false` for demos), screenshots, returns a `function_result`.
4. Repeat until done or a safety decision interrupts.

### Human-in-the-loop is a native feature (maps exactly to ClearBorder's pause-before-submit)

The response can carry a `safety_decision` classifying the action as allowed / **`require_confirmation`** / blocked. Built-in policy categories include `FINANCIAL_TRANSACTIONS`, `SENSITIVE_DATA_MODIFICATION` (health/financial/**government records** — a customs portal squarely triggers this), `COMMUNICATION_TOOL`, `ACCOUNT_CREATION`. On `require_confirmation`, you prompt the user and return `safety_acknowledgement: true` in the `function_result`. Google's own documented best-practice system prompt is literally ClearBorder's requirement: *"perform all preparatory steps... ask for confirmation AFTER all necessary information is entered, but BEFORE the final, irreversible action (e.g., before clicking 'Send', 'Submit')"* ([safety section](https://ai.google.dev/gemini-api/docs/computer-use)). Combine both: rely on the built-in safety triggers and enforce a custom system instruction that always pauses before final submission.

### Quotas / pricing — deal-breaker alert

- Computer use is charged as **regular `gemini-3.5-flash` tokens** ($1.50/M in, $9.00/M out), but the pricing table marks the tool **"Not available" on the free tier** → **a billing-linked (Tier 1) API account is required** ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- Tier 1 has a **$10-per-rolling-10-minutes spend cap** ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)). Screenshot-heavy loops are token-hungry; a long uninterrupted computer-use session could throttle mid-demo. Mitigate: small viewport (e.g. 1280×800), short loops, pre-warmed portal state, and reach Tier 2 ($200/10 min) by paying $100 + 3 days before demo day if budget allows.
- Legacy `gemini-2.5-computer-use-preview-10-2025`: $1.25/M in, $10/M out, paid only.

### Sandboxing and fallbacks

- **Build a fake customs portal** (a Next.js route in the same app, styled like a government site, seeded with the demo case) — deterministic, fast, no legal/CAPTCHA issues, and lets you *plant* the declared-value discrepancy. Run Playwright headed beside the agent UI, or stream Playwright screenshots into the UI with a rendered cursor overlay.
- Hosted sandbox option: **Browserbase** hosts an official Gemini computer-use demo environment ([announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-computer-use-gemini-3-5-flash/)); useful if you want the browser in the cloud.
- **Fallback if model access breaks:** scripted Playwright path (deterministic selectors) with the same visual cursor overlay and the same UI event stream; keep the agent's "intent" captions but source them from the script. Because you control the fake portal, the scripted path can be pixel-identical to the model-driven one. Second-tier fallback: `gemini-2.5-computer-use-preview-10-2025` or `gemini-3-flash-preview` if 3.5 Flash tool access has issues.
- Opt-in **prompt-injection detection** (screenshot scanning) exists; enable it — it's a talking point for judges.

---

## 5. Pillar 3 — Memory architecture

### Options surveyed

| Option | Status (mid-2026) | Fit for "visible, explainable, restart-proof in days" |
|---|---|---|
| **Vertex AI Agent Engine Memory Bank** | **GA** (billing live since Feb 11, 2026): $0.25/1k memories stored/mo, $0.50/1k retrieved (first 1k/mo free); ADK integration via `VertexAiMemoryBankService`; also works with LangGraph/CrewAI ([docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank), [GA coverage](https://agentmarketcap.ai/blog/2026/04/11/google-vertex-ai-agent-builder-april-2026)) | Managed extraction/consolidation is **async and opaque** — hard to show judges *why* a memory was recalled; adds GCP setup time. Good enterprise story, weak demo theater. |
| **Google ADK sessions/state** (Python 2.0 GA May 19, 2026; TS `@google/adk` at 1.x) | `DatabaseSessionService` (SQLite/Cloud SQL) persists `state` across restarts; official May 2026 Google blog demonstrates the *exact* ClearBorder pattern — durable state machine, days-long idle, webhook wake-up, `state_delta` resume ([blog](https://developers.googleblog.com/en/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/), [ADK 2.0](https://developers.googleblog.com/why-we-built-adk-20/)) | The *patterns* are gold — copy them. The framework itself is Python-first and its memory is session-state, not semantic recall. |
| **mem0** | OSS v2.0.x (active, Jun 2026), `pip install mem0ai` / TS client / MCP server, Gemini cookbook exists; `add()`/`search()` over vector+graph ([repo](https://github.com/mem0ai/mem0)) | Fast to wire, but recall ranking is a black box and the extraction pipeline is another moving part to debug during demo week. |
| **LangGraph checkpointing + LangMem** | `PostgresSaver`/SQLite checkpointers (thread-scoped state) + LangMem store (semantic/episodic/procedural, user-scoped) ([comparison](https://atlan.com/know/ai-agent/ai-agent-memory/langgraph-memory-vs-mem0/)) | Solid, but buys abstraction you don't need and ties the build to LangChain idioms. |
| **Hand-rolled episodic + semantic memory** with `gemini-embedding-2` in Postgres/pgvector (or SQLite+sqlite-vec) | Embedding model GA: `gemini-embedding-2` (multimodal, $0.20/M text; `gemini-embedding-001` text-only $0.15/M) ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | **Full control over what's stored, why it's recalled, and how it renders in the UI.** Survives restarts by construction. ~1 day of work. |

### Recommendation: hand-rolled three-layer memory, ADK's persistence patterns, Google's consolidation pattern

Build a small, legible memory system in your own database (Postgres + pgvector; use Cloud SQL if you want the Google Cloud checkbox):

1. **Procedural / case-state layer** — an explicit state machine per case (`VALUE_MISMATCH_DETECTED → SHIPPER_CALLED → VALUE_CORRECTED → AWAITING_CUSTOMS → FISCAL_DOC_REQUESTED → SUBMITTED_PENDING_CONFIRMATION → CLEARED`), stored as rows, injected into the system prompt every run — never inferred from chat history. This is verbatim the pattern from Google's ADK long-running-agents blog (state machine + durable session + webhook wake-up + `state_delta`), re-implemented in ~100 lines of TypeScript.
2. **Episodic layer** — append-only timestamped events ("Jul 3 14:02 — called Shenzhen Wholesale Ltd, Ms. Chen confirmed invoice value $840, not $84"), each embedded with `gemini-embedding-2` for similarity recall, each with source/provenance (call transcript span, portal screenshot).
3. **Semantic layer** — distilled shipper profiles and facts as structured triples with confidence + provenance ("Shenzhen Wholesale Ltd → prefers WeChat follow-ups", "their invoices use CNY, converted at booking date") — this powers "doesn't re-ask known questions." Distillation runs as a **nightly consolidation job** (cron) using cheap `gemini-3.1-flash-lite`, mirroring Google's own open-source [Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/agents/always-on-memory-agent/README.md) (ingest → consolidate-on-timer → query, SQLite, no vector DB — proof the approach is Google-sanctioned).

**Why this wins the demo:** every memory operation is an explicit function you wrote, so every `WRITE` / `RECALL` / `CONSOLIDATE` can be emitted onto a WebSocket event stream and rendered as visible cards in the UI in real time — e.g. when the agent wakes up: "**Recalled (similarity 0.92):** yesterday I corrected the declared value → skipping re-verification; **Recalled fact:** customs requested fiscal document type NF-e for this shipper before." Judges see recall *happening*, with provenance links. Kill the process on camera, restart it, and the agent resumes mid-case — the strongest possible proof of persistence. Managed Memory Bank can't give you that visibility; it's the right thing to *mention* as the production migration path (one paragraph in the README), not the thing to build on in a few days.

**Wake-up mechanism ("the agent wakes up on its own days later"):** a scheduler (node-cron in the worker; Cloud Scheduler → HTTP if deployed on Cloud Run) triggers a "wake" webhook per open case; the orchestrator hydrates case state + top-k episodic/semantic recalls and decides the next action — again the ADK blog's event-driven dormancy pattern. For the live demo, add a "simulate next day" button that fires the same webhook with a mocked clock.

---

## 6. Orchestration framework recommendation

**Pick: hand-rolled TypeScript orchestrator inside one Next.js monorepo.** (Next.js App Router UI + a plain Node worker; `@google/genai` everywhere; Playwright in the worker; Postgres for cases/memory.)

Justification, briefly:

- **All three pillars are raw API loops** — a WebSocket audio session, a screenshot→action→screenshot loop, and a cron-triggered plan step. Frameworks add ceremony around exactly these loops without removing any of their real work.
- **ADK**: 2.0 (graph workflows, GA May 19, 2026) is **Python-first**; the TypeScript ADK (`@google/adk`) is still 1.x. Choosing ADK means either a split Python-backend/Next.js-frontend stack (slower iteration for a few-day build) or the less-featured TS port. Adopt ADK's *patterns* (state machine, durable sessions, webhook resume, eval-style golden tests), not the framework. Caveat: if the competition turns out to explicitly score ADK usage (the Live Agent Challenge scored "GenAI SDK **or** ADK"), using `@google/genai` already satisfies that criterion.
- **LangGraph (JS)**: checkpointing is nice, but you need custom visible-memory anyway, and its abstractions slow down the deep Live-API/computer-use integration work that will consume most of the build.
- The demo differentiator is a **beautiful UI narrating agent cognition** (live dual-language transcripts, browser viewport with intent captions, memory cards, case timeline). That argues for maximal control over the event stream — a hand-rolled orchestrator emitting typed events over one WebSocket to the UI.

---

## 7. Integration notes (wiring the three pillars)

- **One event bus to the UI.** The worker emits typed events (`call.transcript.partial`, `browser.intent`, `browser.screenshot`, `memory.recall`, `memory.write`, `case.state.transition`, `hitl.confirmation.requested`) over a single WebSocket; the Next.js UI renders each stream as a panel. HITL confirmations flow back on the same socket → `safety_acknowledgement` in the computer-use loop.
- **Calls:** browser (operator) connects client-to-server to the Live API with ephemeral tokens; the "shipper" side is a second browser client in the demo. Translation sessions run per direction (§3). Transcription events → `gemini-3.5-flash` extractor → memory writes, visible live.
- **Portal:** fake customs portal served by the same Next.js app; Playwright drives a real Chromium against it; computer-use loop on `gemini-3.5-flash` via the `generateContent` API path (not Interactions, see §4); custom system instruction pauses before final submit; screenshots streamed to UI ~1 fps.
- **Persistence proof:** all state in Postgres; a "Day 2" demo beat: kill the worker on camera, restart, agent resumes with visible recalls. Deploy on Cloud Run + Cloud SQL if a Google Cloud service is (or may be) required.
- **Keys:** standing API key only server-side; browser gets single-use ephemeral tokens (`v1alpha` on both mint and client); fresh token per reconnect.

---

## 8. Key risks / deal-breakers

1. **The competition is unverified.** No open DeepMind-organized memory-agent hackathon was found. If the real event is the Cognee "Hangover Part AI" hackathon, it **ends July 5, 2026 (tomorrow)** and *requires Cognee as the memory layer* — both fatal to this plan as scoped. If it's the Qwen event (deadline Jul 9), Gemini would be the wrong stack entirely. **Confirm the event URL before writing code.**
2. **Computer use requires a paid (Tier 1+) account** — not available on free tier — and Tier 1's **$10/10-min spend cap** can throttle screenshot-heavy loops mid-demo. Mitigate: billing enabled from day 1, lean loops, consider reaching Tier 2 early, scripted-Playwright fallback rehearsed.
3. **Live API session limits will kill a naive demo:** 15-min audio cap without compression and **~10-min WebSocket lifetime** regardless. Session resumption + context window compression + fresh-ephemeral-token-per-reconnect must be implemented and tested, not left for demo day.
4. **The translate model has no function calling and audio-only input** — memory capture during translated calls must ride the transcription stream, and any mid-call tool use needs the parallel `gemini-3.1-flash-live-preview` session or post-turn extraction.
5. **Preview-model churn:** `gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, and the computer-use capability are previews; Google renamed/retired predecessor models within months (2.5 native audio → retirement Dec 13, 2026; Interactions API became "primary" over `generateContent`). Pin model strings, re-verify the week of the event, keep the legacy computer-use model as fallback.
6. **Computer use is officially "may contain errors" preview** — on a self-built portal reliability is high, but rehearse the deterministic scripted fallback; never demo against a real government site (CAPTCHAs, legality, nondeterminism).
7. **Free-tier data usage:** free-tier traffic is used to improve Google products; use the paid tier for anything sensitive and for higher preview-model rate limits.
8. **Real telephony is out of demo scope** — outbound PSTN calls to China/Turkey via Voximplant/Twilio add latency, cost, and compliance surface; simulate the call and present telephony as the documented production path.

---

## 9. Source index

**Competition candidates:** [Hangover Part AI (Cognee)](https://www.wemakedevs.org/hackathons/cognee) · [Qwen Cloud hackathon rules](https://qwencloud-hackathon.devpost.com/rules) · [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/) + [announcement](https://cloud.google.com/blog/topics/training-certifications/join-the-gemini-live-agent-challenge) + [winners](https://cloud.google.com/blog/topics/developers-practitioners/winners-and-highlights-of-the-gemini-live-agent-challenge) · [Gemini 3 Hackathon](https://gemini3.devpost.com/) · [Build with Gemini XPRIZE](https://xprize.devpost.com/) + [rules](https://www.geminixprize.com/rules) · [Rapid Agent Hackathon](https://rapid-agent.devpost.com/) + [blog](https://info.devpost.com/blog/google-cloud-rapid-agent-hackathon) · [Cactus × DeepMind](https://luma.com/f0arqlwy) · [DeepMind AGI Kaggle hackathon](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/measuring-agi-cognitive-framework/)

**Live API:** [overview](https://ai.google.dev/gemini-api/docs/live) · [capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) · [3.1 Flash Live model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview) + [blog](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-1-flash-live/) · [3.5 Live Translate guide](https://ai.google.dev/gemini-api/docs/live-api/live-translate) + [model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-live-translate-preview) + [blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-live-3-5-translate/) · [ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens.md.txt) · [official Live API skill](https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-live-api-dev/SKILL.md) · [reconnection field notes](https://gemilab.net/en/articles/gemini-api/gemini-live-api-reconnect-token-refresh-session-resumption-notes)

**Computer use:** [docs (generateContent path)](https://ai.google.dev/gemini-api/docs/computer-use) · [Interactions API path](https://ai.google.dev/gemini-api/docs/interactions/computer-use) · [3.5 Flash announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-computer-use-gemini-3-5-flash/) · [hands-on guide](https://medium.com/google-cloud/mastering-gemini-computer-use-a-comprehensive-hands-on-guide-ab8ec7db3aab)

**Memory & orchestration:** [ADK long-running agents blog](https://developers.googleblog.com/en/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/) · [Why we built ADK 2.0](https://developers.googleblog.com/why-we-built-adk-20/) · [adk.dev](https://adk.dev/) · [ADK TS repo](https://github.com/google/adk-js/) · [Memory Bank docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank) + [ADK quickstart](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank/adk-quickstart) + [GA/pricing coverage](https://agentmarketcap.ai/blog/2026/04/11/google-vertex-ai-agent-builder-april-2026) · [Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/agents/always-on-memory-agent/README.md) + [VentureBeat](https://venturebeat.com/orchestration/google-pm-open-sources-always-on-memory-agent-ditching-vector-databases-for) · [mem0](https://github.com/mem0ai/mem0) · [LangGraph vs mem0](https://atlan.com/know/ai-agent/ai-agent-memory/langgraph-memory-vs-mem0/) · [ReasoningBank (Google Research)](https://research.google/blog/reasoningbank-enabling-agents-to-learn-from-experience/)

**Pricing & limits:** [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [rate limits & tiers](https://ai.google.dev/gemini-api/docs/rate-limits) · [Interactions API GA](https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/)
