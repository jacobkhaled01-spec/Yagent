import { FreeSmartAIProvider } from '../src/adapters/llm/FreeSmartAIProvider.js';

async function test() {
  const provider = new FreeSmartAIProvider();

  console.log('--- Test 1: Generate Response (Inbound WhatsApp message) ---');
  const response = await provider.generateResponse({
    senderJid: '967700000000@s.whatsapp.net',
    incomingText: 'مرحبا يا باشا، ممكن أكلمك ضروري بخصوص الفاتورة؟',
    scheduleContext: {
      name: 'Sleep Mode (وقت النوم)',
      instruction: 'المستخدم نائم حالياً. لا توقظه ولا تعد بمكالمة هاتفية الآن، واطلب إرسال التفاصيل ليطلع عليها صباحاً.',
      tone: 'هادئ ومحترم ومختصر'
    },
    persona: { ownerName: 'يعقوب المهاجري' }
  });

  console.log('Generated AI Response:');
  console.log(response);

  console.log('\n--- Test 2: Admin Command Interpretation ---');
  const adminResult = await provider.interpretAdminCommand({
    incomingText: 'أنا طالع أذاكر للاختبار ساعتين لا ترن علي',
    scheduleContext: { name: 'Normal Mode' },
    auditHistory: [],
    persona: { ownerName: 'يعقوب المهاجري' }
  });

  console.log('Admin Interpretation Result:');
  console.log(JSON.stringify(adminResult, null, 2));
}

test().catch(console.error);
