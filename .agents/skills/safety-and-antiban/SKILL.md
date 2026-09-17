---
name: safety-and-antiban
description: >-
  Provides anti-ban safety guidelines, rate limiting, human typing delay simulation,
  and contact filtering protocols for unofficial WhatsApp Web automation.
---

# Safety & Anti-Ban Protocols Skill

Automating WhatsApp through web protocols requires strict behavioral mimicry to prevent algorithm-based account restrictions or phone number bans.

## 1. Safety Directives

1. **Never Send Bulk Cold Messages:**
   - The agent should strictly act as a *responder* to inbound messages, never an unsolicited outbound spam broadcaster.
2. **Whitelist / Blacklist Configuration:**
   - Always allow the user to whitelist only specific contacts (e.g. VIP clients, specific friends) or ignore certain groups.
3. **Randomized Typing Jitter Simulation:**
   - Prior to dispatching a message, send a `composing` state to the socket for a realistic duration.

### Implementation Pattern

```javascript
export async function simulateHumanTypingAndSend(sock, recipientJid, messageText) {
  // Base delay of 1.2 seconds + random jitter proportional to text length
  const charDelay = Math.min(messageText.length * 35, 3000);
  const totalDelay = 1200 + Math.random() * 800 + charDelay;

  // Signal typing
  await sock.sendPresenceUpdate('composing', recipientJid);

  // Wait delay
  await new Promise((resolve) => setTimeout(resolve, totalDelay));

  // Signal paused
  await sock.sendPresenceUpdate('paused', recipientJid);

  // Dispatch final message
  return await sock.sendMessage(recipientJid, { text: messageText });
}
```

---

## 2. Rate-Limiting Thresholds

- **Per Contact Limit:** Maximum 5 automated replies per hour per contact during non-working or resting hours.
- **Global Inbound Throttle:** If more than 20 messages arrive across all contacts within 1 minute, queue them and process with increasing backoff delays.
