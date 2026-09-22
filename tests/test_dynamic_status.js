import { TemporalScheduler } from '../src/scheduler/TemporalScheduler.js';
import { createAdminCommandMiddleware } from '../src/pipeline/middlewares/AdminCommandMiddleware.js';
import { HuggingFaceProvider } from '../src/adapters/llm/HuggingFaceProvider.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function runDynamicStatusTest() {
  console.log('🧪 === بدء فحص واختبار ميزة الحالة الديناميكية والرد على المتصلين ===\n');

  // Test storage path
  const testStorage = path.resolve('data', 'test_custom_status.json');
  if (fs.existsSync(testStorage)) fs.unlinkSync(testStorage);

  const testConfig = {
    timezone: 'Asia/Riyadh',
    modes: {
      work: { name: 'Work (عمل)', tone: 'مهني', instruction: 'في العمل' }
    }
  };

  const scheduler = new TemporalScheduler(testConfig, testStorage);
  const llmProvider = new HuggingFaceProvider();
  const personaConfig = { ownerName: 'يعقوب المهاجري' };

  let dispatchedMessages = [];
  const mockWhatsappClient = {
    sendMessage: async (jid, text) => {
      dispatchedMessages.push({ jid, text });
      return { status: 'SENT', jid, text };
    },
    findContactByName: () => null
  };

  const adminMiddleware = createAdminCommandMiddleware(
    scheduler,
    mockWhatsappClient,
    [],
    llmProvider,
    personaConfig,
    null
  );

  // 1. Test Owner Setting Dynamic Status: "انا في المستشفى مرافق مع الوالد"
  console.log('1️⃣ اختبار إرسال المالك لحالته: "انا في المستشفى مرافق مع الوالد"');
  const selfContext1 = {
    isSelfAdmin: true,
    senderJid: '967781121904@s.whatsapp.net',
    text: 'انا في المستشفى مرافق مع الوالد'
  };

  await adminMiddleware(selfContext1, async () => {});

  const currentStatus = scheduler.getCustomStatus();
  console.log('   - حالة الـ Scheduler الحالية:', currentStatus);
  console.log('   - الرد الموجه للمالك يعقوب:\n', dispatchedMessages[0]?.text);

  if (!currentStatus.active || !currentStatus.text.includes('المستشفى')) {
    throw new Error('❌ فشل في تسجيل وتفعيل الحالة المخصصة في الـ Scheduler!');
  }
  console.log('   ✅ نجح تفعيل واعتماد الحالة المخصصة بدقة!\n');

  // 2. Test External Contact Sending a Message while Owner is in Hospital
  console.log('2️⃣ اختبار استقبال رسالة من متصل خارجي وهو في المستشفى:');
  const externalContactJid = '967711223344@s.whatsapp.net';
  const incomingContactText = 'السلام عليكم يا مهندس يعقوب، كيف حالك وكيف الشغل معك؟';

  const scheduleCtx = scheduler.resolveScheduleContext(incomingContactText);
  console.log('   - سياق الجدولة الحالي:', scheduleCtx.name);
  console.log('   - التعليمات المرفقة:', scheduleCtx.instruction);

  console.log('   - جارٍ توليد الرد عبر موديل الذكاء الاصطناعي المجاني...');
  const externalReply = await llmProvider.generateResponse({
    senderJid: externalContactJid,
    senderName: 'أحمد علي',
    incomingText: incomingContactText,
    scheduleContext: scheduleCtx,
    persona: personaConfig,
    conversationHistory: ''
  });

  console.log('\n💬 [الرد الصادر للمتصل الخارجي]:\n' + externalReply + '\n');

  // 3. Test Owner Inquiring About Current Status: "ايش وضعي"
  console.log('3️⃣ اختبار استعلام المالك: "ايش وضعي"');
  dispatchedMessages = [];
  const selfContext2 = {
    isSelfAdmin: true,
    senderJid: '967781121904@s.whatsapp.net',
    text: 'ايش وضعي'
  };

  await adminMiddleware(selfContext2, async () => {});
  console.log('   - رد المساعد على استعلام الحالة:\n', dispatchedMessages[0]?.text, '\n');

  // 4. Test Clearing Status: "متاح"
  console.log('4️⃣ اختبار إلغاء الحالة بالقول: "متاح"');
  dispatchedMessages = [];
  const selfContext3 = {
    isSelfAdmin: true,
    senderJid: '967781121904@s.whatsapp.net',
    text: 'متاح'
  };

  await adminMiddleware(selfContext3, async () => {});
  const clearedStatus = scheduler.getCustomStatus();
  console.log('   - رد المساعد بعد الإلغاء:\n', dispatchedMessages[0]?.text);
  console.log('   - حالة الـ Scheduler بعد الإلغاء:', clearedStatus);

  if (clearedStatus.active) {
    throw new Error('❌ فشل في إلغاء الحالة الخاصة!');
  }
  console.log('   ✅ نجح إلغاء الحالة والعودة للوضع التلقائي بنجاح تام!\n');

  // Cleanup test file
  if (fs.existsSync(testStorage)) fs.unlinkSync(testStorage);

  console.log('🎉 جميع اختبارات الحالة الديناميكية والرد على المتصلين تمت بنجاح 100%!');
}

runDynamicStatusTest().catch((err) => {
  console.error('❌ خطأ في الاختبار:', err);
  process.exit(1);
});
