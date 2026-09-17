---
name: looping-engineering
description: >-
  Provides operational patterns and methodologies for Looping Engineering in conversational AI agents,
  including message debouncing loops, agentic self-reflection critique loops, and circuit breaker guards.
---

# Looping Engineering Skill

This skill defines the technical implementation patterns for closed feedback loops within the WhatsApp AI Auto-Responder agent.

## 1. Message Aggregation & Debounce Loop

When users type on messaging platforms like WhatsApp, they frequently send sentences in fragmented bursts. A simple linear agent would reply multiple times in rapid succession.

### Implementation Pattern

```javascript
export class MessageDebounceManager {
  constructor(debounceMs = 3500, onBatchReady) {
    this.debounceMs = debounceMs;
    this.onBatchReady = onBatchReady;
    this.buffers = new Map(); // senderJid -> { timer, messages: [] }
  }

  enqueue(senderJid, messageText, rawMessage) {
    let entry = this.buffers.get(senderJid);
    if (!entry) {
      entry = { timer: null, messages: [] };
      this.buffers.set(senderJid, entry);
    }

    entry.messages.push({ text: messageText, raw: rawMessage, receivedAt: Date.now() });

    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    entry.timer = setTimeout(() => {
      const messagesToProcess = [...entry.messages];
      this.buffers.delete(senderJid);
      this.onBatchReady(senderJid, messagesToProcess);
    }, this.debounceMs);
  }
}
```

---

## 2. The Self-Critique & Reflection Loop

Every candidate reply must be evaluated against the user's active constraints before it reaches WhatsApp.

### Evaluation Criteria

1. **Schedule Alignment:** Does the message reflect whether the user is sleeping, working, or studying?
2. **Persona Tone:** Is the vocabulary and formality strictly matching the user's persona?
3. **No Hallucinated Commitments:** The bot must never promise meetings or actions that contradict the user's schedule.
4. **Brevity & Conciseness:** WhatsApp replies should feel authentic, conversational, and natural, not verbose essays.

### Implementation Pattern

```javascript
export async function runReflectionLoop(llmService, incomingText, candidateReply, activeMode, maxIterations = 2) {
  let currentReply = candidateReply;
  let iteration = 0;

  while (iteration < maxIterations) {
    const critique = await llmService.evaluate({
      incomingText,
      candidateReply: currentReply,
      currentScheduleMode: activeMode.name,
      scheduleInstruction: activeMode.instruction
    });

    if (critique.passed) {
      return currentReply;
    }

    // Refine response using critique feedback
    currentReply = await llmService.refine({
      incomingText,
      previousReply: currentReply,
      feedback: critique.reason,
      activeMode
    });

    iteration++;
  }

  return currentReply;
}
```

---

## 3. Circuit Breaker Loop Guard

To prevent runaway conversations (e.g., bot responding endlessly to automated marketing bots or group notification feeds):

- Maintain an in-memory counter of responses per remote contact per time window (e.g., max 3 messages per 10 minutes in Sleep Mode).
- When the limit is hit, trigger a circuit break and transition that conversation to `SILENT_RECORD_MODE` where messages are recorded to log files without sending further WhatsApp messages.
