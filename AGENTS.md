# AGENTS.md - Agent Operating Standards & Workspace Rules

> **Project:** WhatsApp AI Auto-Responder (Free Stack / WhatsApp Web Automation)  
> **Repository Root:** `d:/Projects/agents/`  
> **Last Updated:** 2026-09-18  
> **Methodology:** Looping Engineering & Defensive Automation  

---

## 1. Project Purpose & Scope (نطاق المشروع والغرض)

This workspace contains an intelligent, autonomous WhatsApp auto-responder agent built using **free, open-source JavaScript libraries** (connecting via WhatsApp Web protocols such as Baileys / WPPConnect) without requiring official paid WhatsApp Business Cloud APIs. 

The AI agent interprets incoming messages, adheres to dynamic user personas, respects custom schedules/alerts (e.g., Work Hours, Sleep Time, Study Sessions, DND Mode), and applies **Looping Engineering** principles to critique, refine, and validate responses before dispatching.

---

## 2. Core Agent Behavioral Directives (التوجيهات السلوكية للوكيل)

Every AI coding assistant or autonomous process operating in this codebase MUST abide by:

1. **User Confirmation & Safety:**
   - Never delete, overwrite, or refactor core components without explicit user authorization.
   - Maintain full auditability of all actions in `CHANGELOG.md` and `PROJECT_MEMORY.md`.

2. **Resource Optimization (CPU, Memory, GPU):**
   - Favor lightweight headless socket solutions (e.g., `@whiskeysockets/baileys`) over heavy browser automation (Puppeteer) whenever feasible to minimize RAM and CPU overhead.
   - Prevent memory leaks by properly releasing event listeners, clearing timers, and capping in-memory conversation histories.

3. **Anti-Ban & Rate Limiting Protocols (حماية الحساب من الحظر):**
   - Emulate human behaviors: Add randomized typing indicators (`presenceUpdate('composing')`) with human-like delays (1.5s - 5s).
   - Enforce cooldown thresholds per recipient to prevent spam loops.
   - Exclude broadcast channels and unrecognized group chats unless explicitly tagged or configured.

4. **Looping Engineering Compliance:**
   - Every auto-generated response must pass through an internal evaluation loop (Relevance -> Persona Tone -> Temporal Constraints -> Safety Filter).
   - Implement circuit breakers to break any recursive interaction loops (e.g., bot talking to another bot).

5. **Software Engineering & Zero-Regression Standards (هندسة البرمجيات):**
   - Strictly adhere to SOLID principles and Clean Architecture (Ports & Adapters).
   - Core domain logic (scheduler, state machine, persona evaluator) must never tightly couple to I/O drivers or external libraries.
   - All extensions must be implemented via adapters or pipeline middlewares to ensure that additions or modifications never introduce breaking changes or regressions to other subsystems.

6. **Documentation Standard:**
   - All architectural decisions and documentation must adhere to **APA 7** citation standards.

---

## 3. Directory & File Organization Structure

```
d:/Projects/agents/
├── AGENTS.md                  # Agent behavioral rules & workspace standards
├── GEMINI.md                  # Development instructions & style guide
├── GUIDELINES.md              # Engineering specs, schedule structures, & APA 7 citations
├── CHANGELOG.md               # Continuous chronological log of modifications
├── PROJECT_MEMORY.md          # Project graph memory & state registry
├── .agents/
│   └── skills/
│       ├── looping-engineering/
│       │   └── SKILL.md       # Loop patterns: reflection, debouncing, & keep-alive
│       ├── whatsapp-automation/
│       │   └── SKILL.md       # Session persistence, QR auth, & Baileys socket lifecycle
│       ├── ai-persona-scheduler/
│       │   └── SKILL.md       # Temporal modes (work, study, sleep) & tone adaptation
│       └── safety-and-antiban/
│           └── SKILL.md       # Rate-limiting, whitelisting, & anti-ban rules
└── src/                       # Source code directory (to be created in Phase 2)
```

---

## 4. Academic & Industry Citations (APA 7)

- Baileys Project Contributors. (2024). *Baileys: Lightweight and full-featured WhatsApp Web API library* (Version 6.x) [Computer software]. GitHub. https://github.com/WhiskeySockets/Baileys
- Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). *Design patterns: Elements of reusable object-oriented software*. Addison-Wesley.
- Martin, R. C. (2018). *Clean architecture: A craftsman's guide to software structure and design*. Prentice Hall.
- Meta Platforms. (2024). *WhatsApp terms of service and acceptable use policy*. WhatsApp LLC. https://www.whatsapp.com/legal/
- Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). *ReAct: Synergizing reasoning and acting in language models*. International Conference on Learning Representations (ICLR). https://arxiv.org/abs/2210.03629
