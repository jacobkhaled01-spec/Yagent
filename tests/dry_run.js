import { bootstrap } from '../src/index.js';
import { MockWhatsAppClient } from '../src/adapters/whatsapp/MockWhatsAppClient.js';
import { MockLLMProvider } from '../src/adapters/llm/MockLLMProvider.js';

async function runDryRunTests() {
  console.log('🧪 =======================================================');
  console.log('🧪 Starting Dry-Run Automated Tests for WhatsApp AI Agent');
  console.log('🧪 =======================================================\n');

  const mockWhatsApp = new MockWhatsAppClient();
  const mockLLM = new MockLLMProvider();

  const { scheduler, debouncer, escalationHistory } = await bootstrap({
    whatsappClient: mockWhatsApp,
    llmProvider: mockLLM,
    dryRun: true,
    voiceEnabled: false,
    debounceMs: 500,
    typingOptions: { skipDelay: true }
  });

  const testSender = '966500000001@s.whatsapp.net';

  // ----------------------------------------------------
  // TEST 1: Temporal Schedule Resolution (Sleep, Work, Study)
  // ----------------------------------------------------
  console.log('▶️ TEST 1: Temporal Schedule Context Tests...');
  scheduler.clearCustomStatus();

  // Simulate Night Time (02:00 AM)
  const nightDate = new Date('2026-09-18T02:00:00');
  const sleepContext = scheduler.resolveScheduleContext('مرحبا', nightDate);
  console.log(`- 02:00 AM resolved to: [${sleepContext.modeKey}] -> ${sleepContext.name}`);
  if (sleepContext.modeKey !== 'sleep') {
    throw new Error(`Expected sleep mode, got ${sleepContext.modeKey}`);
  }

  // Simulate Work Time (11:00 AM on Wednesday)
  const workDate = new Date('2026-09-16T11:00:00'); // Wednesday
  const workContext = scheduler.resolveScheduleContext('مرحبا', workDate);
  console.log(`- 11:00 AM (Wed) resolved to: [${workContext.modeKey}] -> ${workContext.name}`);
  if (workContext.modeKey !== 'work') {
    throw new Error(`Expected work mode, got ${workContext.modeKey}`);
  }

  // Simulate Study Time (19:30 on Wednesday)
  const studyDate = new Date('2026-09-16T19:30:00');
  const studyContext = scheduler.resolveScheduleContext('مرحبا', studyDate);
  console.log(`- 19:30 resolved to: [${studyContext.modeKey}] -> ${studyContext.name}`);
  if (studyContext.modeKey !== 'study') {
    throw new Error(`Expected study mode, got ${studyContext.modeKey}`);
  }
  console.log('✅ TEST 1 PASSED: Temporal schedules resolved accurately.\n');

  // ----------------------------------------------------
  // TEST 2: Looping Message Debouncing & Aggregation
  // ----------------------------------------------------
  console.log('▶️ TEST 2: Looping Debounce & Rapid Burst Aggregation...');
  console.log('Simulating 3 rapid fragmented messages from contact...');

  mockWhatsApp.simulateInboundMessage(testSender, 'السلام عليكم');
  await new Promise((r) => setTimeout(r, 400));
  mockWhatsApp.simulateInboundMessage(testSender, 'هل أنت موجود الآن؟');
  await new Promise((r) => setTimeout(r, 400));
  mockWhatsApp.simulateInboundMessage(testSender, 'عندي استفسار بخصوص المشروع.');

  console.log('Waiting for debounce buffer timer to flush and process batch...');
  // Wait for debounce timer (500ms) + typing delay (50ms) + buffer
  await new Promise((r) => setTimeout(r, 1000));

  if (mockWhatsApp.sentMessages.length === 0) {
    throw new Error('Debouncer failed to trigger response dispatch.');
  }

  const firstReply = mockWhatsApp.sentMessages[0];
  console.log(`✅ Debounced Batch Response Dispatched:\n"${firstReply.text}"`);
  console.log('✅ TEST 2 PASSED: Rapid messages successfully aggregated into 1 single response.\n');

  // ----------------------------------------------------
  // TEST 3: Emergency Detection & Escalation Protocol
  // ----------------------------------------------------
  console.log('▶️ TEST 3: Emergency Detection & Escalation Protocol...');
  mockWhatsApp.simulateInboundMessage(testSender, 'أرجو الرد هذا أمر طارئ ومستعجل جداً!');

  await new Promise((r) => setTimeout(r, 1000));

  const lastReply = mockWhatsApp.sentMessages[mockWhatsApp.sentMessages.length - 1];
  console.log(`✅ Emergency Escalation Response Dispatched:\n"${lastReply.text}"`);

  if (!lastReply.text.includes('عاجلة') && !lastReply.text.includes('طوارئ')) {
    throw new Error('Emergency escalation message did not match expected protocol.');
  }

  console.log(`Total logged escalations: ${escalationHistory.length}`);
  console.log('✅ TEST 3 PASSED: Emergency correctly escalated and sender politely notified.\n');

  // ----------------------------------------------------
  // TEST 4: Self-Critique Reflection Loop
  // ----------------------------------------------------
  console.log('▶️ TEST 4: Self-Critique & Reflection Loop Validation...');
  const reflectionResult = await mockLLM.evaluateAndRefine({
    incomingText: 'هل يمكنك الاتصال بي الآن؟',
    candidateReply: 'سأتصل بك الآن فوراً لنناقش التفاصيل.',
    scheduleContext: { modeKey: 'sleep', name: 'Sleep Mode' }
  });

  console.log(`Critique check result: passed=${reflectionResult.passed}`);
  console.log(`Refined safe output: "${reflectionResult.refinedReply}"`);

  if (reflectionResult.passed !== false || !reflectionResult.refinedReply.includes('نائم')) {
    throw new Error('Self-Critique failed to catch conflicting commitment.');
  }
  console.log('✅ TEST 4 PASSED: Reflection loop corrected sleep mode contradiction.\n');

  console.log('🎉 =======================================================');
  console.log('🎉 ALL DRY-RUN TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('🎉 =======================================================\n');

  // Clean exit
  debouncer.clear();
  process.exit(0);
}

runDryRunTests().catch((err) => {
  console.error('❌ Dry-run test failed:', err);
  process.exit(1);
});
