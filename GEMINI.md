# GEMINI.md - Developer Guidelines & Code Style Protocols

> **Target Environment:** Node.js (v18+ LTS or v20+)  
> **Module System:** ES Modules (`"type": "module"`)  
> **Language Standards:** Modern JavaScript / Clean Modular Architecture  
> **Core Architecture:** Event-Driven with Reactive Looping Engineering  

---

## 1. Development Principles & Code Hygiene

1. **Clean Architecture & SOLID Compliance:**
   - **Ports & Adapters (Hexagonal):** Business rules (scheduler, persona reflection, debouncing) must never import Baileys or specific AI vendor SDKs directly. They must interact only with port interfaces (`ILLMProvider`, `IWhatsAppClient`, `IScheduleStore`).
   - **Open/Closed Principle (OCP):** Extend system capabilities (e.g. adding new LLM adapters or audio transcription) via new plugins/adapters without modifying stable core logic.
   - **Dependency Injection (DI):** Inject all dependencies (adapters, configurations, loggers) through constructors or factory functions to maximize unit-testability.
   - **Middleware / Pipeline Pattern:** Encapsulate inbound and outbound message transformations inside isolated middleware functions to prevent cross-module regressions.

2. **Strict Modularity & Single Responsibility:**
   - Decouple WhatsApp socket networking from the AI generation engine and scheduler logic.
   - Separate state persistence from runtime listeners.

2. **Looping Engineering Coding Patterns:**
   - **Debounce Loop:** When a contact sends multiple messages within a short timeframe (e.g., 4000ms), buffer the incoming messages into a single conversational batch before calling the LLM.
   - **Self-Critique Reflection Loop:** Every response generated must pass through a secondary validation function (`validateResponseConstraints`) before sending.
   - **Circuit Breaker Loop:** Guard all loops with maximum retry limits (e.g., `maxRetries = 3`) and exponential backoff timeouts to guarantee that no loop becomes infinite.

3. **Privacy & Credential Isolation:**
   - Never commit WhatsApp auth credentials (e.g., `baileys_auth_info/` or `.wwebjs_auth/`).
   - Store all runtime parameters (schedules, whitelist, API keys if using free provider tiers) in `.env` and `config/user_config.json`.
   - Never log private conversation content in unmasked logs.

4. **Resource & Async Optimization:**
   - All network calls and AI inferences must be asynchronous (`async/await`) with proper `try...catch` blocks.
   - Avoid blocking the Node.js event loop with CPU-heavy synchronous parsing.
   - Implement graceful shutdown handlers (`process.on('SIGINT')`, `process.on('SIGTERM')`) to release active sockets and flush buffers.

---

## 2. Error Handling & Resilience Matrix

| Error Type | Handling Protocol | Loop Policy |
| :--- | :--- | :--- |
| Socket Disconnect (401 Unauthorized) | Invalidate current session files, emit QR regeneration event | Stop reconnection loop, alert user |
| Socket Disconnect (428 Connection Lost / 515 Restart) | Execute automated reconnect with exponential backoff | Loop up to 5 attempts (delay: 2s, 4s, 8s, 16s, 32s) |
| Rate Limit / High Message Spike | Enqueue messages into an in-memory priority queue | Debounce loop + 2.5s jitter delay |
| AI Generation Failure / Timeout | Fallback to a polite, static contextual template based on current schedule | Circuit breaker triggers; log error gracefully |

---

## 3. Testing and Verification Protocols

1. **Mock Testing:**
   - Unit test the scheduler against mock system timestamps (testing Sleep Mode, Work Mode, Study Mode).
   - Test the message debouncer with rapid synthetic event emissions.
2. **End-to-End Dry Runs:**
   - Test using simulated WhatsApp messages (`dryRun: true`) before connecting to active live phone sessions.
