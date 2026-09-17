import { bootstrap } from '../src/index.js';
import { MockWhatsAppClient } from '../src/adapters/whatsapp/MockWhatsAppClient.js';
import { MockLLMProvider } from '../src/adapters/llm/MockLLMProvider.js';

async function runCognitiveTests() {
  console.log('🧠 =======================================================');
  console.log('🧠 Testing Cognitive Memory & Executive Briefing Engine');
  console.log('🧠 =======================================================\n');

  const mockWhatsApp = new MockWhatsAppClient();
  const mockLLM = new MockLLMProvider();

  const {
    pipeline,
    debouncer,
    conversationMemory,
    executiveBriefing,
    whatsappClient
  } = await bootstrap({
    whatsappClient: mockWhatsApp,
    llmProvider: mockLLM,
    dryRun: true,
    debounceMs: 100,
    typingOptions: { skipDelay: true }
  });

  const contact1 = '967711111111@s.whatsapp.net';
  const contact2 = '967722222222@s.whatsapp.net';
  const yaaqobSelf = '967781121904@s.whatsapp.net';

  // 1. Contact 1 (Ahmed) sends a message
  console.log('▶️ Step 1: Contact 1 (م. أحمد) sends message...');
  await pipeline.execute({
    senderJid: contact1,
    senderName: 'م. أحمد',
    text: 'السلام عليكم يا مهندس يعقوب، متى موعد تسليم الفاتورة والتصميم؟',
    isSelfAdmin: false
  });

  // 2. Contact 2 (Khaled) sends an emergency message
  console.log('▶️ Step 2: Contact 2 (خالد) sends urgent message...');
  await pipeline.execute({
    senderJid: contact2,
    senderName: 'خالد السقاف',
    text: 'أرجو الرد هذا أمر طارئ ومستعجل بخصوص الخادم!',
    isEmergency: true,
    isSelfAdmin: false
  });

  // 3. Verify Memory Store
  console.log('\n▶️ Step 3: Checking Conversation Memory Store...');
  const history1 = conversationMemory.getHistory(contact1);
  console.log(`- Contact 1 history entries: ${history1.length}`);
  if (history1.length === 0) throw new Error('Failed to record Contact 1 history');

  const formattedHistory = conversationMemory.formatHistoryForPrompt(contact1, 'م. أحمد');
  console.log('Formatted Dialogue:\n', formattedHistory);

  // 4. Test Yaaqob's Executive Briefing
  console.log('\n▶️ Step 4: Yaaqob asks for executive briefing ("مالجديد؟")...');
  let briefingSent = '';
  mockWhatsApp.sendMessage = async (to, text) => {
    briefingSent = text;
    return { key: { id: 'test-1' } };
  };

  await pipeline.execute({
    senderJid: yaaqobSelf,
    senderName: 'المالك (أنت)',
    text: 'مالجديد؟',
    isSelfAdmin: true
  });

  console.log('\nExecutive Briefing Dispatched to Yaaqob:');
  console.log('===========================================================');
  console.log(briefingSent);
  console.log('===========================================================');

  if (!briefingSent.includes('م. أحمد') || !briefingSent.includes('خالد السقاف')) {
    throw new Error('Executive briefing did not include contact details!');
  }

  // 5. Test Delegation Commands (رد على خالد السقاف بـ ... / رد على م. أحمد / رد على شخص غير موجود)
  console.log('\n▶️ Step 5: Testing Admin Delegation Commands...');

  let delegatedTo = null;
  let delegatedMessage = null;
  let ownerConfirmation = null;

  mockWhatsApp.sendMessage = async (to, text) => {
    if (to === yaaqobSelf) {
      ownerConfirmation = text;
    } else {
      delegatedTo = to;
      delegatedMessage = text;
    }
    return { key: { id: 'test-2' } };
  };

  // Case A: Reply with custom text
  console.log('- Case A: Delegated reply with custom text ("رد على خالد السقاف بـ وعليكم السلام سأعالج الأمر")...');
  await pipeline.execute({
    senderJid: yaaqobSelf,
    senderName: 'المالك (أنت)',
    text: 'رد على خالد السقاف بـ وعليكم السلام سأعالج الأمر فوراً',
    isSelfAdmin: true
  });

  if (delegatedTo !== contact2 || !delegatedMessage.includes('سأعالج الأمر')) {
    throw new Error(`Delegation with custom message failed! Sent to: ${delegatedTo}`);
  }
  console.log(`  Confirmed sent to ${delegatedTo}: "${delegatedMessage}"`);
  console.log(`  Confirmation to Yaaqob: "${ownerConfirmation.split('\n')[0]}"`);

  // Case B: Reply to unknown contact (e.g. محمد الحضرمي before receiving a message from him)
  console.log('\n- Case B: Delegated reply to unknown contact ("رد على محمد الحضرمي")...');
  delegatedTo = null;
  delegatedMessage = null;
  await pipeline.execute({
    senderJid: yaaqobSelf,
    senderName: 'المالك (أنت)',
    text: 'رد على محمد الحضرمي',
    isSelfAdmin: true
  });

  if (delegatedTo !== null) {
    throw new Error('Should not have dispatched to unknown contact without phone number!');
  }
  if (!ownerConfirmation.includes('محمد الحضرمي') || !ownerConfirmation.includes('لم أجد')) {
    throw new Error('Assistant did not clarify that the contact was not found!');
  }
  console.log(`  Helpful clarification sent to Yaaqob:\n  "${ownerConfirmation.replace(/\n+/g, ' ')}"`);

  console.log('\n✅ COGNITIVE MEMORY & EXECUTIVE BRIEFING & DELEGATION ENGINE VERIFIED 100%!');
}

runCognitiveTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
