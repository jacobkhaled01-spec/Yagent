---
name: whatsapp-automation
description: >-
  Provides procedures and best practices for managing WhatsApp Web sessions using free JavaScript libraries
  (such as @whiskeysockets/baileys), handling QR authentication, connection state events, and reconnect loops.
---

# WhatsApp Automation Skill (via Baileys / WhatsApp Web)

This skill governs the integration of WhatsApp Web protocols without official paid APIs, focusing on stability, low memory footprints, and session persistence.

## 1. Session Lifecycle & Multi-File Authentication

Using `@whiskeysockets/baileys` with `useMultiFileAuthState`:

```javascript
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

export async function initializeWhatsAppClient(sessionDir = './auth_info_baileys') {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }), // Optimize memory and suppress noisy socket logs
    syncFullHistory: false // Optimize bandwidth and RAM
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Scan the QR code below using your WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        // Trigger adaptive reconnection loop
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connection successfully established!');
    }
  });

  return sock;
}
```

---

## 2. Resource & Memory Conservation Checklist

- Always set `syncFullHistory: false` to avoid downloading months of chat histories into Node.js heap memory.
- Use `pino({ level: 'silent' })` or `pino({ level: 'warn' })` to prevent stdout log buffering from inflating RAM.
- Always clear auth directory caches when an explicit `401 Unauthorized` (Logged Out) occurs to allow clean QR re-generation.
