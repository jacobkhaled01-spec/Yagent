---
name: voice-and-audio-io
description: >-
  Provides operational procedures and adapters for processing voice messages:
  Speech-to-Text (Whisper), Text-to-Speech (Edge-TTS / Piper), and voice command parsing.
---

# Voice and Audio Processing Skill

This skill outlines how the WhatsApp AI agent handles incoming voice messages, processes spoken user commands, and generates natural Arabic/English voice note responses.

## 1. Speech-to-Text (STT) Integration

WhatsApp voice notes are encoded as `.ogg` files (Opus codec). To transcribe them without paid APIs:

```javascript
import fs from 'fs';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export async function transcribeWhatsAppAudio(audioMessage, sttProvider) {
  // 1. Download WhatsApp Audio Buffer
  const buffer = await downloadMediaMessage(audioMessage, 'buffer', {});

  // 2. Transcribe via STT Provider Port (Local Whisper or Free Groq Whisper)
  const transcription = await sttProvider.transcribe(buffer, { language: 'ar' });
  return transcription.text;
}
```

---

## 2. Text-to-Speech (TTS) Integration (Free & High-Quality)

Using Microsoft Edge TTS (free, highly natural Arabic voices such as `ar-SA-HamedNeural` or `ar-EG-SalmaNeural`):

```javascript
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export async function generateWhatsAppVoiceNote(text, outputPath = './temp_reply.ogg') {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('ar-SA-HamedNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_OPUS);

  const readable = tts.toStream(text);
  // Pipe to audio file and dispatch as WhatsApp PTT (Push-To-Talk) voice note
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    readable.pipe(fileStream);
    fileStream.on('finish', () => resolve(outputPath));
    fileStream.on('error', reject);
  });
}
```

---

## 3. Spoken Command Interpretation Loop

When the user speaks to the agent (either from the companion Flutter app or a dedicated admin chat):
1. Transcribe voice command.
2. Route through Intent Recognizer (e.g., `"أنا داخل اجتماع حتى 4 عصراً"` $\rightarrow$ Set Work Mode with 4 PM expiry).
3. Confirm action via voice note reply: `"تم ضبط وضع الاجتماع والعمل حتى الساعة الرابعة عصراً."`
