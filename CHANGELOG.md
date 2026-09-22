# CHANGELOG.md - WhatsApp AI Agent Project Log

All notable changes, architectural decisions, and setup events for this project are documented herein.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), adhering to APA 7 documentation standards.

---

## [Unreleased] - 2026-09-18

### Added (تأسيس البنية التحتية والمهارات)
- **AGENTS.md**: Defined operational directives, anti-ban protocols, looping engineering rules, and APA 7 academic citations.
- **GEMINI.md**: Outlined development standards for Node.js ES modules, privacy rules, error handling matrix, and test practices.
- **GUIDELINES.md**: Comprehensive specifications detailing the Looping Engineering framework (debouncing, self-critique reflection loops, circuit breakers), temporal scheduler modes (Work, Sleep, Study, DND), and architectural diagrams.
- **PROJECT_MEMORY.md**: Initialized the project graph memory representing node states, relationships, and constraints.
- **Skills Directory (`.agents/skills/`)**:
  - `looping-engineering/SKILL.md`: Operational skill for agentic self-reflection, message debouncing, and loop management.
  - `whatsapp-automation/SKILL.md`: Operational skill for headless WhatsApp Web socket handling, QR auth, and session lifecycle.
  - `ai-persona-scheduler/SKILL.md`: Operational skill for resolving user time zones, active schedules, and tone adaptation.
  - `safety-and-antiban/SKILL.md`: Operational skill for anti-ban protection, rate-limiting, and whitelist filtering.
- **Software Engineering Standards (Hexagonal & SOLID)**:
  - Updated `GUIDELINES.md`, `AGENTS.md`, and `GEMINI.md` to mandate Hexagonal Architecture (Ports & Adapters) and SOLID principles.
  - Formulated the Middleware / Pipeline pattern to guarantee zero regression and seamless extensibility without impacting existing modules.
  - Incorporated Robert C. Martin (2018) Clean Architecture citation.
- **Voice I/O, Mobile Topology & Escalation Protocol**:
  - Created `.agents/skills/voice-and-audio-io/SKILL.md` for Speech-to-Text (Whisper) and Text-to-Speech (Edge-TTS) integration.
  - Architected the Client-Server topology: 24/7 Node.js Hosted Agent paired with a Flutter Mobile Companion App for voice controls and daily reports.
  - Formulated the Escalation & Fallback protocol for ambiguous queries.
  - Added Radford et al. (2023) Whisper citation.

### Phase 2: Source Code Implementation & Verification (تنفيذ الكود المصدري والاختبار)
- Initialized `package.json` with ES modules, `@whiskeysockets/baileys`, `msedge-tts`, `dotenv`, and `pino`.
- Configured `.gitignore` and `.env.example` to enforce session security and zero credential leaks.
- Implemented Clean Architecture Ports in `src/domain/ports/` (`ILLMProvider`, `IWhatsAppClient`, `ITextToSpeechProvider`, `ISpeechToTextProvider`).
- Implemented `TemporalScheduler` in `src/scheduler/TemporalScheduler.js` supporting overnight sleep, work, study, and emergency keywords.
- Built the decoupled Middleware Pipeline in `src/pipeline/` with 8 specialized middlewares.
- Implemented `MessageDebounceManager` in `src/pipeline/MessageDebouncer.js` for Looping Engineering message aggregation.
- Implemented concrete adapters:
  - `BaileysWhatsAppClient` for live WhatsApp Web connection with Signal session cache and retry mechanism.
  - `MockWhatsAppClient` for testing.
  - `MockLLMProvider` for deterministic testing.
  - `OllamaProvider` for offline local LLMs.
  - `GeminiFreeProvider` for official Google Gemini Free Tier.
  - `FreeSmartAIProvider` for high-performance, zero-key, zero-cost cloud neural AI (Pollinations / OpenAI GPT-OSS / Qwen).
  - `EdgeTTSProvider` for free natural Arabic voice synthesis (msedge-tts).
- Updated `src/index.js` and `.env` to default to `AI_PROVIDER="free"` providing real-time AI comprehension out of the box without requiring manual API key configuration.
- Executed `tests/dry_run.js` verifying 4 core test suites with 100% success:
  1. Temporal schedule mode accuracy.
  2. Looping message debouncing & batch aggregation.
  3. Emergency detection & escalation protocol.
  4. Self-Critique reflection loop validation.

### Self-Chat & Stream Stability Patch (تحديث محادثة المالك واستقرار الاتصال)
- Resolved Baileys Disconnect Reason 515 (Stream Restart) by ensuring old socket listeners and web-sockets are destroyed prior to reconnecting, preventing duplicate socket conflicts.
- Implemented `AdminCommandMiddleware` in `src/pipeline/middlewares/AdminCommandMiddleware.js` to enable direct user interaction via WhatsApp's "Message Yourself" feature:
  - Upgraded Arabic Intent Engine to recognize dialectal phrasing ("مشغول حالياً لدي بعض الأعمال", "أعطني تقرير المحادثات", "مالجديد", "ماذا لدينا من رسائل", "أنا نائم").
  - Decoupled cloud API errors (401/429) from owner commands so that local intent execution and reports succeed even if external AI servers experience temporary downtime.
  - Implemented live context reporting detailing active mode, current tone, and emergency escalations.
- Updated `SafetyMiddleware.js` to whitelist the account owner automatically (`isSelfAdmin: true`).

### Reassurance & Personal Representative Persona (بروتوكول طمأنة المتصلين والتمثيل الشخصي)
- Updated `config/persona.json` and `config/schedules.json` to mandate that every auto-response reassures the sender:
  - Confirms receipt and documentation of their request.
  - Explicitly states that the assistant will inform and brief Yaaqob almahajeri on everything they need.
  - Assures the sender that Yaaqob will personally review their message and reply as soon as he is available.
- Updated system prompt templates in `HuggingFaceProvider.js`, `FreeSmartAIProvider.js`, `GeminiFreeProvider.js`, and `LLMGenerationMiddleware.js` to enforce this communicative tone.

### Cognitive Executive AI Architecture (الترقية إلى وكيل تنفيذي واعٍ بذاكرة محادثات)
- Implemented `ConversationMemoryStore` (`src/domain/memory/ConversationMemoryStore.js`) managing active ring-buffer conversational histories per contact for multi-turn dialogue understanding.
- Implemented `ExecutiveBriefingStore` (`src/domain/memory/ExecutiveBriefingStore.js`) tracking structured briefing cards (contact name, phone, timestamp, inquiry, and reassurance status).
- Implemented `ContextMemoryMiddleware` (`src/pipeline/middlewares/ContextMemoryMiddleware.js`) injecting dialogue transcripts into LLM context and committing interaction records.
- Integrated `ExecutiveBriefingStore` with `AdminCommandMiddleware.js` allowing Yaaqob to query live, structured briefings of who contacted him and their inquiries.
- Verified end-to-end functionality via `tests/test_cognitive_executive.js` and confirmed zero regressions across existing test suites (`npm run test:dry-run`).

### Admin Outbound Delegation & Process Resilience (أوامر التفويض الإداري وتحصين استقرار البوت)
- Added first-class **Admin Outbound Delegation** to `AdminCommandMiddleware.js`:
  - Recognizes commands like `"رد على [فلان] بـ [الرسالة]"` or `"أرسل لـ [رقم/اسم]: [الرسالة]"` and dispatches the message directly to the recipient via WhatsApp socket.
  - Recognizes automated delegation commands like `"رد على [فلان]"` without text, generating a contextual executive reply and dispatching it automatically.
  - Implemented smart contact resolution via `ExecutiveBriefingStore.findContact(query)` searching by name or international phone digits.
  - Added Arabic-English cross-lingual transliteration (e.g. `Mohammed AL-Hadrami` <-> `محمد الحضرمي`).
  - Added keyboard typo tolerance (e.g. `فم بالرد على رسائل...` matching `قم بالرد على رسائل...`).
  - Added direct contact name recognition (e.g. sending `Mohammed AL-Hadrami` displays his contact card or asks for his phone number to reply).
  - Filtered WhatsApp story/status updates (`status@broadcast`) at the socket layer to prevent clogging the debouncer.
- Resolved Hugging Face Error 402 (`credits depleted`) by migrating `.env` to **`Qwen/Qwen2.5-Coder-7B-Instruct`** (100% free serverless tier, zero credit consumption, verified fluent Arabic output under 2 seconds).
- Fortified runtime resilience in `src/index.js` and `MessageDebouncer.js` with global `uncaughtException` and `unhandledRejection` guards preventing sudden termination.
- Integrated a native lightweight HTTP health check server listening on `PORT || 3000` for 24/7 free cloud deployment.
- Initialized and deployed the complete repository to GitHub: `https://github.com/jacobkhaled01-spec/Yagent`.
- **Self-Chat Infinite Loop Fix (حل مشكلة التكرار في محادثة المالك):**
  - Added strict anti-echo text cache preventing the bot from replying to its own outgoing messages in self-chat.
  - Dropped all empty synchronization / receipt / reaction packets (`text === ""`) before triggering pipeline processing.
  - Guarded `AdminCommandMiddleware` to never dispatch replies for empty text or spam fallback menus.
- Expanded `tests/test_cognitive_executive.js` to test and validate outbound delegation with 100% passing results.

### Dynamic Custom Status & Contextual Auto-Responder (نظام الحالة المخصصة الديناميكية والرد التلقائي)
- **TemporalScheduler Dynamic Status Enhancement (`src/scheduler/TemporalScheduler.js`)**:
  - Implemented dynamic custom status state (`customStatus: { active, text, setAt }`) with local JSON persistence in `data/custom_status.json`.
  - Implemented `setCustomStatus(text)`, `clearCustomStatus()`, `loadCustomStatus()`, and `getCustomStatus()`.
  - Prioritized active custom statuses at the highest evaluation tier in `resolveScheduleContext()` ensuring any custom situation overrides default schedules.
- **Self-Chat Intent Engine Expansion (`src/pipeline/middlewares/AdminCommandMiddleware.js`)**:
  - Integrated deterministic Arabic regex detection for any custom condition (`انا في المستشفى`, `عندي اختبار`, `مسافر صنعاء`, `مشغول بالورشة`, `في اجتماع إلى العصر`, etc.).
  - Added real-time status inquiry command (`ايش وضعي`, `ما هي حالتي`, `حالتي الان`).
  - Added instantaneous cancellation commands (`متاح`, `تلقائي`, `فاضي`, `خلصت`, `طبيعي`, `إلغاء`).
  - Prioritized deterministic intent matching ahead of LLM interpretations to eliminate latency and hallucination.
- **Provider & Prompt Synchronization (`HuggingFaceProvider.js`, `FreeSmartAIProvider.js`)**:
  - Injected `customStatusText` into LLM generation prompts instructing models to convey Yaaqob's exact condition with polite reassurance.
  - Reinforced assistant identity constraints preventing the AI from falsely speaking as Yaaqob directly.
  - Added support for `[CUSTOM_STATUS: ...]` tags in `interpretAdminCommand`.
- **Automated Verification (`tests/test_dynamic_status.js`)**:
  - Added and executed automated test suite validating status activation, external contact auto-reply generation, status query, and status clearance with 100% passing score.
