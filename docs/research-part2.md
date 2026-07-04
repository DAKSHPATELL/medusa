# ClearBorder — Research Part 2 (Deep Dive)

**Date:** July 4, 2026  
**Builds on:** [research.md](./research.md)  
**Scope:** New findings only — competition hunt (round 2), Twilio + Gemini Live bridge, computer-use API corrections, 24h memory playbook, demo/judging optimization.

---

## 10. Competition hunt — round 2 (still unverified DeepMind event)

### 10.1 Verdict unchanged, with stronger negative evidence

After 20+ additional query variations (Devpost category scrape, lablab.ai, Kaggle, Google Developer events, Advent of Agents, ETH/EPFL/Zürich events, LinkedIn/X announcements, "cannot forget" / "long horizon" phrasing), **no open or recently-closed competition organized by Google DeepMind whose explicit theme is persistent long-horizon memory with combined AI + human judging was found.**

What *was* found instead:

| Pattern | Interpretation |
|---|---|
| **Google DeepMind × Kaggle "Measuring Progress Toward AGI"** (closed Apr 16) | Memory is one of 10 cognitive abilities in the taxonomy; participants built *benchmarks*, not agents |
| **Gemini 3 Hackathon** (DeepMind, closed Feb 9) | Open-ended; memory projects allowed but not required |
| **Advent of Agents Season 2** (Mar 2026) | **Tutorial series**, not a competition — includes a "Long Term Recall: Memory Plugins" day and Google's Always-On Memory Agent sample ([adventofagents.com](https://adventofagents.com/)) |
| **ETH Agentic Systems Lab hackathon @ Google Zürich** (Mar 2, 2026) | DeepMind was a partner; theme was **physical/agentic AI + MCP on robots**, not memory ([ZHAW recap](https://www.zhaw.ch/en/engineering/institutes-centres/cai/news/news/event-news/zhaw-cai-brings-physical-ai-to-the-agentic-hackathon-with-eth-at-google-zurich)) |
| **"The Hangover Part AI" (Cognee)** | Closest *theme* match ("Build AI that doesn't forget") but **Cognee-mandatory**, ends **Jul 5** |
| **Qwen MemoryAgent track** | Closest *judging* match ("expert panels, peer review, automated AI-driven analysis") but **Qwen Cloud-mandatory**, deadline **Jul 9** |

### 10.2 Best hypothesis for the unverified brief

The project brief likely conflates **two or three real 2026 signals**:

1. **Theme:** Cognee "Hangover Part AI" or Qwen Track 1 MemoryAgent (both explicitly about agents that remember across sessions).
2. **Stack expectation:** Google Gemini ecosystem (Gemini 3 Hackathon, Gemini Live Agent Challenge, Rapid Agent Hackathon, Build with Gemini XPRIZE).
3. **Judging style:** Qwen rules explicitly allow "automated AI-driven analysis" ([rules](https://qwencloud-hackathon.devpost.com/rules)); Gemini 3 Hackathon uses human judges with a ≤3-min video cap ([gemini3.devpost.com](https://gemini3.devpost.com/)).

**There is no single event that satisfies all three.** Ask the user TODAY for:

- Exact event URL or invitation email
- Whether Cognee, Qwen, or Gemini is *mandatory*
- Whether submission is Devpost, a private form, or an in-person demo (~24h suggests a private/cohort deadline, not a public Devpost event)

### 10.3 Expanded candidate table (new rows + submission detail)

| Event | URL | Deadline (2026) | Mandatory stack | Submission format | Judging (weights) | Gemini OK? |
|---|---|---|---|---|---|---|
| **Hangover Part AI (Cognee)** | [wemakedevs.org/hackathons/cognee](https://www.wemakedevs.org/hackathons/cognee) | **Jul 5** (tomorrow) | **Cognee** (`remember`/`recall`/`improve`/`forget`) — theme open otherwise | WeMakeDevs "Submit Project" portal + public repo; demo video + README expected (no formal Devpost page found) | Impact, Creativity, Technical Excellence, **Best Use of Cognee**, UX, Presentation (equal emphasis on Cognee integration) | Allowed as LLM layer, but **Cognee must be the memory layer** |
| **Qwen Cloud — Track 1: MemoryAgent** | [qwencloud-hackathon.devpost.com](https://qwencloud-hackathon.devpost.com/) · [rules](https://qwencloud-hackathon.devpost.com/rules) | **Jul 9, 2:00pm PDT** | **Qwen models on Qwen Cloud**; deploy on Alibaba Cloud infra | Public OSS repo + architecture diagram + demo video + working hosted demo + track selection; optional blog for bonus prize | Innovation & AI Creativity **30%**, Technical Depth **30%**, Problem Value **25%**, Presentation **15%**; Stage 1 pass/fail on API fit; **AI-driven analysis allowed** | **No** — wrong stack |
| **Build with Gemini XPRIZE** | [xprize.devpost.com](https://xprize.devpost.com/) | **Aug 17** | Gemini API + **real revenue business** | GitHub (shared with judges) + 3-min production demo video + 500–1000 word narrative + **Stripe/bank revenue evidence** + customer contacts | Business Viability, AI-Native Operations, Category Impact | Yes, but theme mismatch |
| **AI Agent Builder Series 2026 (India)** | [aihouze.xyz/google-hackathon](https://www.aihouze.xyz/google-hackathon) | Submit by **Aug 5**; finale **Aug 8** @ Google Bengaluru | Google AI stack (Gemini, ADK, MCP, Vertex) | Working agent + demo video + GitHub + pitch; top 100 invited in-person | Leaderboard + in-person pitch (criteria not fully published) | Yes — Google-affiliated |
| **lablab.ai — AI Agents Hack (AI Alliance)** | [lablab.ai/ai-hackathons/ai-alliance-ai-agents](https://lablab.ai/ai-hackathons/ai-alliance-ai-agents) | Starts **Jul 6** (check platform for end date) | AI Alliance ecosystem; "context engineering / memory" encouraged | lablab.ai platform + Discord submission | Not published in detail on recap page | Likely flexible |
| **lablab.ai — AMD Developer Hackathon ACT II** | [lablab.ai/ai-hackathons/amd-developer](https://lablab.ai/ai-hackathons/amd-developer) | Starts **Jul 6** | AMD Developer Cloud + open models (Llama, Qwen, etc.) | lablab.ai; Track 1 = AI Agents | Track-based | Flexible; not Gemini-focused |
| **Google Cloud Rapid Agent Hackathon** | [rapid-agent.devpost.com](https://rapid-agent.devpost.com/) | Submissions closed Jun 11; **winners ~Jul 16** | Gemini 3 + Agent Builder + **partner MCP** (MongoDB track suggested persistent memory) | ~3-min video + public repo + hosted URL + partner track | Per-partner track | Yes — **already closed** |
| **Gemini Live Agent Challenge** | [geminiliveagentchallenge.devpost.com/rules](https://geminiliveagentchallenge.devpost.com/rules) | Closed Mar 16 | Gemini + GenAI SDK or ADK + **≥1 GCP service** | ≤4-min live demo video (no mockups) + architecture diagram + Cloud deployment proof | Innovation & Multimodal UX **40%**, Technical & Architecture **30%**, Demo **30%** | Yes — **best Google judging template for ClearBorder** |
| **Advent of Agents S2** | [adventofagents.com](https://adventofagents.com/) | Mar 2026 (archived tutorials) | Educational — ADK + Gemini 3.1 Flash-Lite | N/A (not a contest) | N/A | Reference only |
| **ETH × Google Zürich Agentic Hackathon** | [ZHAW news](https://www.zhaw.ch/en/engineering/institutes-centres/cai/news/news/event-news/zhaw-cai-brings-physical-ai-to-the-agentic-hackathon-with-eth-at-google-zurich) | Mar 2 (one-day, closed) | MCP + physical robots | In-person | N/A | DeepMind partner, not memory-themed |

### 10.4 If the real deadline is ~24 hours from now (Jul 5)

The only major **memory-themed** public event closing imminently is **Cognee Hangover Part AI (Jul 5)**. Competing there without Cognee as the memory layer is effectively a disqualifier on criterion #4 ("Best Use of Cognee"). A Gemini-only hand-rolled memory build is the wrong submission for that event.

If the demo is for a **private cohort / investor / internal Google sprint** with no public URL, none of the above tables apply — confirm with the brief owner.

---

## 11. Twilio + Gemini Live integration (real PSTN path)

> Part 1 recommended in-browser simulation. **This section covers the user's chosen real-Twilio path** and stage fallback.

### 11.1 Architecture (server-to-server bridge)

ClearBorder should add a **telephony relay** inside the existing Node agent worker — not client-to-server ephemeral tokens for the phone leg.

```
PSTN caller ──► Twilio Voice ──► POST /voice (TwiML) ──► <Connect><Stream url="wss://…/twilio/stream">
                                                      │
                      ┌───────────────────────────────┘
                      ▼
              Twilio Media Streams WebSocket
              (8 kHz μ-law, base64 JSON frames)
                      │
                      ▼
              Bridge service (Node + ws)
              · decode μ-law → PCM
              · resample 8→16 kHz (inbound) / 24→8 kHz (outbound)
              · carry resampler state across frames (avoid click/pop)
                      │
                      ▼
              Gemini Live API WebSocket (server-to-server)
              model: gemini-3.1-flash-live-preview
              (or gemini-3.5-live-translate-preview for translation-only leg)
                      │
                      ▼
              Transcription events → memory extractor → AgentEvent bus
```

**Official references:**

- Google Cloud sample app + design doc: [gemini-live-telephony-app](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/sample-apps/gemini-live-telephony-app) ([design_doc.md](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/sample-apps/gemini-live-telephony-app/design_doc.md))
- Google AI DEV Community tutorial: [Add Telephony to a Gemini Live Agent with Twilio](https://dev.to/googleai/add-telephony-to-a-gemini-live-agent-with-twilio-1elc)
- Production field guide (Python/FastAPI, transferable patterns): [Gemini Lab — Twilio phone voice agent](https://gemilab.net/en/articles/gemini-api/gemini-live-twilio-phone-voice-agent-production-guide)
- Twilio Media Streams protocol: [overview](https://www.twilio.com/docs/voice/media-streams) · [WebSocket messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages)

### 11.2 TwiML entrypoint

```xml
<Response>
  <Connect>
    <Stream url="wss://YOUR_HOST/twilio/stream" />
  </Connect>
</Response>
```

Use **bidirectional** `<Connect><Stream>` (not unidirectional `<Start><Stream>`) so the agent can speak back on the call ([Twilio docs](https://www.twilio.com/docs/voice/media-streams)).

### 11.3 Audio conversion (Node.js / TypeScript)

| Leg | Twilio format | Gemini Live format | Notes |
|---|---|---|---|
| Inbound (shipper → agent) | `audio/x-mulaw`, 8 kHz mono, base64 in JSON | 16-bit PCM LE, **16 kHz** mono | ~20 ms frames ≈ 160 bytes μ-law → 320 bytes PCM@8k → 640 bytes PCM@16k |
| Outbound (agent → shipper) | same | Gemini outputs **24 kHz** PCM | Downsample 24→8 kHz, then `lin2ulaw`; buffer ~20–60 ms before send |

**Libraries (Node):**

| Library | Role |
|---|---|
| [`alawmulaw`](https://www.npmjs.com/package/alawmulaw) | μ-law ↔ 16-bit PCM (`mulaw.decode` / `encode`) — 28k weekly downloads |
| [`wavefile`](https://www.npmjs.com/package/wavefile) | Alternative: `fromMuLaw()` + `toSampleRate(16000)` ([SO answer](https://stackoverflow.com/questions/68088801/convert-twilio-mulaw-to-16khz-pcm-stream-in-node-js)) |
| [`@tw2gem/audio-converter`](https://www.npmjs.com/package/@tw2gem/audio-converter) | Community package targeting Twilio↔Gemini resampling (evaluate before trusting for demo) |
| **ffmpeg/sox subprocess** | Overkill for hackathon; adds process spawn latency |

Python's `audioop` (used in Google's Python samples) was **removed in Python 3.13** — Node is the right choice for this monorepo anyway.

**Critical implementation detail:** maintain **resampler state** across frames. Resetting state each frame causes boundary clicks audible on PSTN ([Gemini Lab guide](https://gemilab.net/en/articles/gemini-api/gemini-live-twilio-phone-voice-agent-production-guide)).

### 11.4 Latency budget (phone UX)

| Segment | Target | Failure mode |
|---|---|---|
| Twilio frame → bridge decode/resample | < 5 ms | CPU-bound at scale; negligible for 1 demo call |
| Bridge → Gemini Live WSS | 50–200 ms handshake (amortized) | Cold Cloud Run start **kills first 2–3 s of audio** — use `min-instances=1` |
| Gemini inference + TTS | 300–800 ms turn gap | \>1.5 s feels "dead" on phone ([Gemini Lab](https://gemilab.net/en/articles/gemini-api/gemini-live-twilio-phone-voice-agent-production-guide)) |
| Interruption (barge-in) | On `server_content.interrupted` or VAD → send Twilio `{ event: "clear" }` | Without `clear`, shipper hears ghost audio |

**Total first-response budget:** keep **\< 1.5 s** from end of shipper utterance to first agent audio.

### 11.5 Ephemeral tokens vs API key on the bridge

| Path | Auth | When |
|---|---|---|
| **Browser operator ↔ Gemini** (mission control) | Ephemeral token minted by Next.js route; `httpOptions: { apiVersion: 'v1alpha' }` on **both** mint and client ([forum fix](https://discuss.ai.google.dev/t/gemini-api-ephemeral-token-not-working/99122)) | Client-to-server Live sessions |
| **Twilio bridge ↔ Gemini** | **Standing API key** on the agent worker only (server-to-server) | Telephony relay — ephemeral tokens are for client-side Live API, not required for backend WSS ([ephemeral tokens doc](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)) |

Do not expose the telephony bridge WSS publicly without Twilio signature validation on the initial `/voice` webhook.

### 11.6 Translation during PSTN calls

For Chinese/Turkish shippers:

- **Option A (recommended for demo):** `gemini-3.1-flash-live-preview` dialogue session — auto language detection, function calling for memory tools mid-call.
- **Option B:** Dual `gemini-3.5-live-translate-preview` sessions (see Part 1 §3) — no function calling; memory via transcription stream only.

Run translation on the **bridge**, not in the browser.

### 11.7 Stage fallback if Twilio fails

| Tier | Trigger | Fallback |
|---|---|---|
| **A** | Twilio configured, call connects | Real PSTN — primary demo path |
| **B** | Twilio webhook/WSS/ngrok failure | **Browser split-tab**: "Shipper" tab with mic speaking Chinese/Turkish → same Live API session topology as Part 1; dashboard shows identical `call.*` AgentEvents |
| **C** | Live API outage | Pre-recorded 30 s call clip injected into event replayer (`apps/agent/src/replayer.ts`) with live transcripts overlaid |

Rehearse B on the same laptop; switch with an env flag (`VOICE_MODE=browser|twilio|replay`).

### 11.8 Twilio setup checklist (user has no Twilio yet — do today)

1. Create Twilio trial account ([trial docs](https://www.twilio.com/docs/usage/trials)) — **75 free voice minutes**, trial restricts outbound to verified numbers in signup country.
2. Buy/provision a voice number; set Voice webhook → `https://<public-host>/voice`.
3. Expose agent worker via ngrok or Cloud Run (**WebSocket support required**, `min-instances=1`).
4. Verify caller ID / add shipper phone as verified outbound destination (trial limitation).
5. Enable Media Streams on the TwiML path; confirm firewall allows Twilio WSS ([Twilio IP ranges](https://www.twilio.com/docs/voice/media-streams)).

### 11.9 Cost estimate — 3-minute demo call

| Item | Trial | Paid (US, approx.) |
|---|---|---|
| Voice minutes | **$0** (included in 75 min trial bucket) | Outbound US **$0.014/min** × 3 = **$0.042** ([US pricing](https://www.twilio.com/en-us/voice/pricing/us)) |
| Media Streams | 30 min included on trial ([trial table](https://www.twilio.com/docs/usage/trials)) | Bundled in call minute for bidirectional streams |
| Phone number | Trial number included | ~**$1.15/mo** US local |
| Gemini Live audio | Free tier or ~**$0.05–0.11/min** combined in+out (see Part 1 §3) | ~**$0.15–0.33** for 3 min |
| **Total demo** | **~$0** on trial + Gemini free tier | **\< $0.50** all-in |

---

## 12. Computer use — API deep dive & corrections

### 12.1 Model identifier correction (important)

Part 1 pinned `gemini-3.5-flash` for computer use. **As of July 4, 2026, official docs conflict:**

| Source | Claim |
|---|---|
| [Model page `gemini-3.5-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) | Lists **Computer use: Supported (Preview)** |
| [generateContent migration guide](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5) | FAQ says **"Computer Use is not supported in Gemini 3.5 Flash"** |
| [Third-party migration audit (May 2026)](https://www.digitalapplied.com/blog/gemini-3-5-flash-api-developer-migration-guide) | Claims silent failure if migrated from `gemini-3-flash-preview` |
| [Interactions computer-use doc](https://ai.google.dev/gemini-api/docs/computer-use) | Recommends **`gemini-3.5-flash`** with intents + prompt-injection detection |

**Build recommendation:** pin **`gemini-3-flash-preview`** for computer-use loops until verified on a paid key with a smoke-test click. Keep `gemini-3.5-flash` for reasoning/memory extraction. Add startup self-test: send one screenshot + `computer_use` tool; assert response contains `function_call`.

Use the **`generateContent` API path** for computer use — Interactions API computer use for `gemini-3.5-flash` was still catching up as of Part 1.

### 12.2 Exact request shape (`generateContent` + Playwright)

```typescript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const tool = {
  computerUse: {
    environment: "ENVIRONMENT_BROWSER", // or "browser" depending on SDK enum
  },
};

const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview", // verify before switching to gemini-3.5-flash
  contents: [
    {
      role: "user",
      parts: [
        { text: systemPrompt + "\n\nTask: amend declaration value for case CB-2026-0142." },
        { inlineData: { mimeType: "image/png", data: screenshotBase64 } },
      ],
    },
  ],
  config: {
    tools: [tool],
    // optional: thinkingConfig, safetySettings
  },
});
```

**Response parsing loop:**

1. Iterate `response.candidates[0].content.parts`.
2. On `text` part with `intent` — emit `browser.action` AgentEvent with description (visible in UI).
3. On `functionCall` — map normalized **0–999** coordinates to Playwright viewport pixels:  
   `pixelX = (x / 1000) * viewportWidth`.
4. Execute via Playwright (`click_at`, `type_text_at`, `scroll`, `take_screenshot`, etc. — see [computer-use action table](https://ai.google.dev/gemini-api/docs/computer-use)).
5. If `functionCall.args.safety_decision.decision === "require_confirmation"` — **pause loop**, emit approval event (§12.4).
6. Capture new PNG screenshot → send as `functionResponse` with optional `safety_acknowledgement: true`.
7. Repeat until terminal action or max steps.

**Playwright ownership:** the **agent worker** owns the browser process (headed Chromium). The Next.js UI receives screenshots/intents via WebSocket — it does not run Playwright. One browser per case; serialize computer-use loops per case to avoid race conditions.

**Viewport:** lock **1280×800** (or 1280×720) in both Playwright context and coordinate scaling — mismatched viewport is the #1 click-miss bug.

### 12.3 Safety / HITL wiring → `approval.requested`

Existing shared contract ([`packages/shared/src/events.ts`](../packages/shared/src/events.ts)):

```typescript
// approval.requested payload
{
  type: "approval.requested",
  approvalId: string,
  summary: string,      // "Submit amended customs declaration"
  risk?: string,
  diff: FieldDiff[],    // declared value $84 → $840, etc.
}
```

**Wire computer-use `require_confirmation` to this event:**

| Step | Agent worker | UI (Mission Control) |
|---|---|---|
| 1 | Model returns `safety_decision: require_confirmation` on e.g. `click_at` targeting submit button | Render `ApprovalCard` with diff preview |
| 2 | Pause Playwright loop; persist pending action + screenshot in SQLite | Operator clicks Approve / Reject |
| 3 | On approve → resume loop with `functionResponse` including `safety_acknowledgement: true` | Emit `approval.granted` |
| 4 | On reject → emit `approval.rejected`; agent replans or stops | Show rejection reason |

Also enforce via **system prompt** (Google's documented pattern): complete all form fields, then ask confirmation **before** irreversible submit ([computer-use safety section](https://ai.google.dev/gemini-api/docs/computer-use)).

Categories likely triggered on a customs portal: **`SENSITIVE_DATA_MODIFICATION`** (government records), possibly **`FINANCIAL_TRANSACTIONS`** (declared value).

Enable **prompt-injection detection** on screenshots — good judge talking point.

### 12.4 Rate limits, screenshot cost, step caps

| Constraint | Guidance |
|---|---|
| **Free tier** | Computer use **not available** on free tier — billing required (Part 1) |
| **Tier 1 spend cap** | **$10 / rolling 10 min** — screenshot-heavy loops can throttle; keep viewport small, JPEG not PNG if acceptable, cap steps |
| **No published max steps** | Implement **`MAX_COMPUTER_USE_STEPS = 15`** for demo; fall back to scripted path after |
| **Screenshot size** | Full-page screenshots burn tokens; clip to viewport only; ~1280×800 PNG ≈ 100–300k tokens depending on compression — monitor spend in AI Studio |
| **Concurrent sessions** | One computer-use loop per worker; do not parallelize |

### 12.5 Plan B — scripted Playwright fallback (`PORTAL_TEST_IDS`)

The repo already defines a **scripted-fallback contract** in [`packages/shared/src/portal.ts`](../packages/shared/src/portal.ts):

| Step | Action | `data-testid` |
|---|---|---|
| Login | fill + submit | `portal-username`, `portal-password`, `portal-sign-in` |
| Open case | click row | `case-row-{ref}` |
| Start amend | click | `amend-declaration` |
| Fix value | fill | `amend-declared-value`, `amend-currency`, `amend-hs-code`, … |
| Continue | click | `amend-continue` |
| Review | checkbox + submit | `review-declare-truthful`, `review-submit` |
| HITL gate | pause before | `confirm-submit` / `confirm-cancel` |
| Upload doc | select + file + submit | `upload-doc-type`, `upload-file`, `upload-submit` |

**Fallback script behavior:**

1. Same Playwright headed browser and screenshot stream (~1 fps to UI).
2. Emit **`browser.action`** events with `targetTestId` set — UI looks identical to model-driven mode.
3. Source "intent" captions from a static script or cheap `gemini-3.1-flash-lite` call.
4. Still emit **`approval.requested`** before clicking `confirm-submit`.
5. Env flag: `BROWSER_MODE=computer-use|scripted`.

This is the demo-save if Tier 1 throttling or preview-model instability strikes on stage.

---

## 13. Memory implementation playbook (24h build)

### 13.1 SQLite vs Postgres — revised recommendation

Part 1 suggested Postgres + pgvector. **The repo already uses `better-sqlite3`** with tables for `memories`, `cases`, `agent_events` ([`apps/agent/src/db.ts`](../apps/agent/src/db.ts)).

**Recommendation for hackathon: stay on SQLite.**

| Factor | SQLite (current) | Postgres + pgvector |
|---|---|---|
| Setup time | **Zero** — file at `data/clearborder.db` | Docker Cloud SQL / Neon provisioning |
| Demo reliability | Single file — copy/reset/backup trivial | Network dependency |
| Restart proof | Kill worker, file persists | Same, but more moving parts |
| Vector search | Add [`sqlite-vec`](https://github.com/asg017/sqlite-vec) extension or brute-force cosine in TS for \<500 memories | Native pgvector |
| Google Cloud checkbox | Weak | Cloud SQL satisfies GCP requirement if needed |

For \<500 episodic memories in a demo, **brute-force cosine** over cached embeddings in SQLite is fast enough and avoids extension compile pain in 24h.

### 13.2 Schema additions (minimal delta)

Existing `memories` table lacks embedding column. Add:

```sql
ALTER TABLE memories ADD COLUMN embedding BLOB; -- JSON float[] or binary
ALTER TABLE memories ADD COLUMN similarity REAL; -- populated on recall, for UI display
ALTER TABLE memories ADD COLUMN consolidated INTEGER DEFAULT 0;
```

**Three layers (unchanged conceptually from Part 1):**

| Layer | Storage | Write trigger | Read trigger |
|---|---|---|---|
| **Procedural** | `cases.status` + JSON state on case row | Every state transition | Every agent wake / plan step |
| **Episodic** | `memories` type=`episodic` | End of call turn, portal action, approval | Top-k similarity on wake + before call/portal |
| **Semantic** | `memories` type=`semantic` + `shippers.learned_patterns` | Nightly/consolidation job | Injected into system prompt; shown on recall |

### 13.3 Embedding pipeline (`gemini-embedding-2`)

```typescript
// Write path (after episodic event)
const embedding = await ai.models.embedContent({
  model: "gemini-embedding-2",
  contents: episodicText,
});
// Store embedding + metadata

// Read path (on agent.wake)
const queryEmbedding = await embed(recapQuery);
const topK = memories
  .map(m => ({ m, score: cosine(queryEmbedding, m.embedding) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
// Emit memory.read for each with why + score
```

Model: **`gemini-embedding-2`** GA — $0.20/M tokens text ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).

### 13.4 Consolidation job (cheap, Google-sanctioned pattern)

Mirror [Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/agents/always-on-memory-agent/README.md):

- **Trigger:** `POST /internal/consolidate` or cron every 30 min / on `agent.sleep`
- **Model:** `gemini-3.1-flash-lite`
- **Input:** unconsolidated episodic rows since last run
- **Output:** 1–3 semantic memories ("Shenzhen Wholesale always invoices in CNY"; "This shipper prefers WeChat follow-up")
- **Emit:** `memory.write` events + mark source episodics `consolidated=1`

### 13.5 "Day 2 wake" demo mechanics

Existing events: `agent.sleep` (with `until`) and `agent.wake` (with `recap`) in shared protocol.

**Convincing multi-day arc:**

| Beat | Action | What judges see |
|---|---|---|
| Day 1 close | Agent emits `agent.sleep` — "Awaiting fiscal document from shipper" | Timeline shows sleep card with wake time |
| Kill process | `kill -9` agent worker on camera | — |
| "Next day" | Click **Simulate Day 2** → fires wake webhook with mocked clock | Worker cold-starts |
| Wake recap | `agent.wake` with recap text + burst of `memory.read` cards (scores 0.85–0.95) | Memory panel lights up |
| Skip re-work | Agent says "Recalled: value already corrected Jul 3 — proceeding to upload NF-e" | Proves semantic memory |
| Day 3 | Repeat for customs clearance | Cross-case doc recall from episodic store |

**Recap generation prompt (flash-lite):**

> You are ClearBorder waking after sleep. Given case state JSON and top-5 memories, produce a 2-sentence ops briefing for the operator and yourself. Mention dates, shipper name, last action, next action. Never invent facts not in memories.

### 13.6 What judges need to SEE in the Memory panel

| UI element | Why it scores |
|---|---|
| **Live `memory.write` cards** during call/portal | Proves extraction is real-time, not post-hoc |
| **`memory.read` with similarity score + `why`** | Makes recall legible (Managed Memory Bank can't do this) |
| **Provenance** — "Source: call transcript 14:02" / "portal screenshot" | Trust + technical depth |
| **Consolidation banner** — "Merged 4 episodics → 1 semantic fact" | Shows long-horizon learning |
| **Sleep/wake timeline entries** | Proves multi-day autonomy pattern (ADK blog pattern) |
| **Kill & restart** | Strongest persistence proof |
| **Cross-session shipper profile** | "Doesn't re-ask known questions" |

Optional: show Google's Always-On Memory Agent repo link in README as "production migration path."

---

## 14. Demo script & judging optimization

### 14.1 Optimal 3-minute live beat sheet

Assumes Google-style judging (≤3 min video, first impression matters — [Gemini 3 Hackathon](https://gemini3.devpost.com/)).

| Time | Beat | Screen | Narration hook |
|---|---|---|---|
| 0:00–0:20 | **Hook** | Case rail: "CB-2026-0142 — HELD — value mismatch" | "This package has been stuck 72 hours. Watch the agent fix it across three days." |
| 0:20–0:50 | **Day 1 — Call** | Call panel: live Mandarin/Turkish transcript + translation | "Real-time voice to Shenzhen shipper — confirms $840 not $84." |
| 0:50–1:20 | **Day 1 — Portal** | Browser panel: computer-use intents + headed Playwright | "Agent amends customs portal — pauses for human approval." |
| 1:20–1:35 | **HITL** | Approval card with diff | "Nothing submits without the operator." |
| 1:35–1:50 | **Sleep** | Timeline: `agent.sleep` | "Agent sleeps — case stays open." |
| 1:50–2:10 | **Kill + Day 2** | Terminal kill → restart → Memory panel recall burst | "Process dead. Day 2 — it remembers everything." |
| 2:10–2:40 | **Day 2 action** | Upload fiscal doc without re-calling shipper | "Semantic memory: knows this shipper's doc format." |
| 2:40–3:00 | **Close** | Case → CLEARED + architecture diagram flash | "Three pillars: voice, browser, memory. Gemini-native." |

### 14.2 Judging criteria mapping (if Google-flavored)

| Criterion (Gemini Live Challenge template) | ClearBorder evidence |
|---|---|
| Innovation & Multimodal UX **40%** | Live translated call + visual portal + memory cards — breaks "text box" |
| Technical & Architecture **30%** | `@google/genai`, Cloud Run, typed event bus, Twilio bridge diagram |
| Demo & Presentation **30%** | No mockups; show Cloud Run dashboard 2 s; architecture diagram in repo |

If Cognee event: add 60 s on `remember`/`recall`/`improve`/`forget` — **requires Cognee integration**.

If Qwen event: replace Gemini mentions with Qwen Cloud API — **different build entirely**.

### 14.3 What AI + human judges typically probe (2026 Google/Qwen contests)

- **Does it actually work live?** — Pre-recorded fallback obvious; keep real clicks and real audio.
- **Grounding / hallucination** — Show provenance on memories and portal field diffs.
- **Error handling** — Briefly show reject path on approval or Twilio `clear` on interruption.
- **Gemini depth** — Name models used: Live, computer use, embedding, flash-lite consolidation.
- **Architecture clarity** — One diagram: UI ↔ agent worker ↔ Gemini APIs ↔ SQLite ↔ Twilio ↔ Playwright.
- **Impact** — Customs delay costs $X/day; agent resolves in 3 days autonomously.

### 14.4 Risk matrix (demo-kill probability)

| Rank | Risk | P(kill) | Mitigation |
|---|---|---|---|
| 1 | **Wrong competition / wrong stack** | High if unconfirmed | Confirm event URL today |
| 2 | **Computer use silent failure (wrong model ID)** | Medium | Smoke-test `gemini-3-flash-preview`; scripted fallback ready |
| 3 | **Twilio not configured in time** | Medium | Browser voice fallback rehearsed; trial setup checklist §11.8 |
| 4 | **Tier 1 $10/10min cap during portal loop** | Medium | Cap steps; small viewport; scripted fallback |
| 5 | **Live API 10-min WSS recycle mid-call** | Low–Med | Session resumption + compression (Part 1 §3) |
| 6 | **First-response latency on phone** | Medium | `min-instances=1`; warm Gemini session on demo start |
| 7 | **Preview model rename/churn** | Low | Pin model strings; check morning-of |
| 8 | **Cognee deadline Jul 5 with no Cognee** | Fatal for that event | Don't submit to Cognee without Cognee |

---

## 15. New source index (Part 2 only)

**Competition:** [Cognee hackathon](https://www.wemakedevs.org/hackathons/cognee) · [Qwen rules](https://qwencloud-hackathon.devpost.com/rules) · [XPRIZE](https://xprize.devpost.com/) · [AI Agent Builder Series India](https://www.aihouze.xyz/google-hackathon) · [lablab AI Alliance](https://lablab.ai/ai-hackathons/ai-alliance-ai-agents) · [Advent of Agents](https://adventofagents.com/) · [ETH×Google Zürich recap](https://www.zhaw.ch/en/engineering/institutes-centres/cai/news/news/event-news/zhaw-cai-brings-physical-ai-to-the-agentic-hackathon-with-eth-at-google-zurich) · [Devpost AI category](https://devpost.com/c/artificial-intelligence)

**Twilio + Live:** [Google telephony sample](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/sample-apps/gemini-live-telephony-app) · [DEV tutorial](https://dev.to/googleai/add-telephony-to-a-gemini-live-agent-with-twilio-1elc) · [Gemini Lab production guide](https://gemilab.net/en/articles/gemini-api/gemini-live-twilio-phone-voice-agent-production-guide) · [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams) · [Twilio trial](https://www.twilio.com/docs/usage/trials) · [US voice pricing](https://www.twilio.com/en-us/voice/pricing/us)

**Computer use:** [Interactions doc](https://ai.google.dev/gemini-api/docs/computer-use) · [3.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) · [Migration gotcha](https://www.digitalapplied.com/blog/gemini-3-5-flash-api-developer-migration-guide) · [Hands-on guide](https://medium.com/google-cloud/mastering-gemini-computer-use-a-comprehensive-hands-on-guide-ab8ec7db3aab)

**Memory:** [Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/agents/always-on-memory-agent/README.md) · [ADK memory codelab](https://codelabs.developers.google.com/codelabs/agent-memory/instructions)

**Node audio:** [alawmulaw](https://www.npmjs.com/package/alawmulaw) · [SO: mulaw→16kHz](https://stackoverflow.com/questions/68088801/convert-twilio-mulaw-to-16khz-pcm-stream-in-node-js)
