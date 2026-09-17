import fs from 'fs';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';

// Ports & Entities
import { TemporalScheduler } from './scheduler/TemporalScheduler.js';
import { Pipeline } from './pipeline/Pipeline.js';
import { MessageDebounceManager } from './pipeline/MessageDebouncer.js';
import { ConversationMemoryStore } from './domain/memory/ConversationMemoryStore.js';
import { ExecutiveBriefingStore } from './domain/memory/ExecutiveBriefingStore.js';

// Middlewares
import { createSafetyMiddleware } from './pipeline/middlewares/SafetyMiddleware.js';
import { createAdminCommandMiddleware } from './pipeline/middlewares/AdminCommandMiddleware.js';
import { createContextMemoryMiddleware } from './pipeline/middlewares/ContextMemoryMiddleware.js';
import { createScheduleMiddleware } from './pipeline/middlewares/ScheduleMiddleware.js';
import { createLLMGenerationMiddleware } from './pipeline/middlewares/LLMGenerationMiddleware.js';
import { createSelfCritiqueMiddleware } from './pipeline/middlewares/SelfCritiqueMiddleware.js';
import { createEscalationMiddleware } from './pipeline/middlewares/EscalationMiddleware.js';
import { createVoiceSynthesisMiddleware } from './pipeline/middlewares/VoiceSynthesisMiddleware.js';
import { createTypingSimulationMiddleware } from './pipeline/middlewares/TypingSimulationMiddleware.js';
import { createDispatchMiddleware } from './pipeline/middlewares/DispatchMiddleware.js';

// Adapters
import { MockLLMProvider } from './adapters/llm/MockLLMProvider.js';
import { OllamaProvider } from './adapters/llm/OllamaProvider.js';
import { GeminiFreeProvider } from './adapters/llm/GeminiFreeProvider.js';
import { FreeSmartAIProvider } from './adapters/llm/FreeSmartAIProvider.js';
import { HuggingFaceProvider } from './adapters/llm/HuggingFaceProvider.js';
import { EdgeTTSProvider } from './adapters/voice/EdgeTTSProvider.js';
import { BaileysWhatsAppClient } from './adapters/whatsapp/BaileysWhatsAppClient.js';
import { MockWhatsAppClient } from './adapters/whatsapp/MockWhatsAppClient.js';

dotenv.config();

function loadJsonConfig(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(raw);
}

export async function bootstrap(customOverrides = {}) {
  console.log('================================================================');
  console.log('🤖 Starting WhatsApp AI Auto-Responder Agent (Clean Architecture)');
  console.log('================================================================');

  // 1. Load Configurations
  const schedulesConfig = loadJsonConfig('./config/schedules.json');
  const personaConfig = loadJsonConfig('./config/persona.json');
  const whitelistConfig = loadJsonConfig('./config/whitelist.json');

  if (process.env.USER_NAME) {
    personaConfig.ownerName = process.env.USER_NAME;
  }
  if (process.env.TIMEZONE) {
    schedulesConfig.timezone = process.env.TIMEZONE;
  }

  // 2. Initialize Scheduler
  const scheduler = new TemporalScheduler(schedulesConfig);

  // 3. Resolve AI Provider Adapter (DIP / OCP)
  const providerType = (process.env.AI_PROVIDER || 'huggingface').toLowerCase();
  let llmProvider;

  if (customOverrides.llmProvider) {
    llmProvider = customOverrides.llmProvider;
  } else if (providerType === 'ollama') {
    llmProvider = new OllamaProvider();
    console.log('🧠 AI Provider: Local Ollama (Downloaded Local Model)');
  } else if (providerType === 'huggingface' || providerType === 'hf') {
    llmProvider = new HuggingFaceProvider();
    console.log(`🧠 AI Provider: Hugging Face Pipeline [${process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct'}]`);
  } else if (providerType === 'gemini') {
    if (process.env.GEMINI_API_KEY) {
      llmProvider = new GeminiFreeProvider();
      console.log('🧠 AI Provider: Google Gemini Free Tier');
    } else {
      console.warn('⚠️ GEMINI_API_KEY is empty. Falling back to HuggingFaceProvider.');
      llmProvider = new HuggingFaceProvider();
      console.log('🧠 AI Provider: Hugging Face Pipeline');
    }
  } else if (providerType === 'free') {
    llmProvider = new FreeSmartAIProvider();
    console.log('🧠 AI Provider: Free Smart AI (Zero-Key Cloud Neural Engine)');
  } else {
    llmProvider = new MockLLMProvider();
    console.log('🧠 AI Provider: Deterministic Mock (Testing Mode)');
  }

  // 4. Resolve Voice Provider Adapter (TTS)
  const isVoiceEnabled = process.env.VOICE_ENABLED === 'true' || customOverrides.voiceEnabled;
  const ttsVoice = process.env.TTS_VOICE_NAME || 'ar-SA-HamedNeural';
  const ttsProvider = isVoiceEnabled ? new EdgeTTSProvider(ttsVoice) : null;
  if (isVoiceEnabled) {
    console.log(`🎙️ Voice Engine: Enabled (Edge-TTS voice: ${ttsVoice})`);
  }

  // 5. Resolve WhatsApp Client Adapter
  const isDryRun = process.env.DRY_RUN === 'true' || customOverrides.dryRun;
  const whatsappClient = customOverrides.whatsappClient || (isDryRun ? new MockWhatsAppClient() : new BaileysWhatsAppClient());

  // 6. Escalation & Audit Log Collector
  const escalationHistory = [];
  const onEscalation = (item) => {
    escalationHistory.push(item);
    console.warn(`\n⚠️ [ESCALATION ALERT] Message from ${item.senderJid} flagged: "${item.text}" (Reason: ${item.reason})\n`);
  };

  // 7. Initialize Cognitive Memory & Briefing Stores
  const conversationMemory = customOverrides.conversationMemory || new ConversationMemoryStore();
  const executiveBriefing = customOverrides.executiveBriefing || new ExecutiveBriefingStore();

  // 8. Assemble Middleware Pipeline
  const pipeline = new Pipeline([
    createSafetyMiddleware(whitelistConfig),
    createAdminCommandMiddleware(scheduler, whatsappClient, escalationHistory, llmProvider, personaConfig, executiveBriefing),
    createContextMemoryMiddleware(conversationMemory, executiveBriefing),
    createScheduleMiddleware(scheduler),
    createLLMGenerationMiddleware(llmProvider, personaConfig),
    createSelfCritiqueMiddleware(llmProvider),
    createEscalationMiddleware(personaConfig, onEscalation),
    createVoiceSynthesisMiddleware(ttsProvider, { forceVoice: isVoiceEnabled }),
    createTypingSimulationMiddleware(whatsappClient, customOverrides.typingOptions || {}),
    createDispatchMiddleware(whatsappClient)
  ]);

  // 9. Assemble Message Debounce Loop
  const debounceDelay = customOverrides.debounceMs ?? 3500;
  const debouncer = new MessageDebounceManager(debounceDelay, async (batch) => {
    try {
      console.log(`\n📨 Processing Batched Messages from [${batch.senderJid}] (${batch.senderName}): "${batch.text}"`);
      await pipeline.execute(batch);
    } catch (err) {
      console.error(`[index] Error processing pipeline for ${batch.senderJid}:`, err.message);
    }
  });

  // 10. Wire Inbound Event Listener
  whatsappClient.onMessageReceived((inboundMsg) => {
    debouncer.enqueue(inboundMsg);
  });

  // 11. Resilience & Crash Prevention Guards
  process.on('uncaughtException', (err) => {
    console.error('🛡️ [Process Guard] Uncaught Exception trapped:', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('🛡️ [Process Guard] Unhandled Rejection trapped:', reason?.message || reason);
  });

  // 12. Lightweight Keep-Alive & Cloud Health Check Server (Render / Koyeb / Fly.io 24/7)
  let server = null;
  if (!isDryRun && !customOverrides.skipHttpServer) {
    const port = process.env.PORT || 3000;
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        agent: 'WhatsApp AI Auto-Responder',
        owner: personaConfig.ownerName || 'User',
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString()
      }));
    });

    server.listen(port, () => {
      console.log(`🌐 [Cloud Keep-Alive Server] Listening on port ${port} (Health check ready)`);
    });
  }

  // 13. Start Connection
  await whatsappClient.connect();

  return {
    scheduler,
    pipeline,
    debouncer,
    whatsappClient,
    escalationHistory,
    conversationMemory,
    executiveBriefing,
    server
  };
}

// Auto-run if executed directly
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrapping error:', err);
    process.exit(1);
  });
}
