import { HumanTakeoverManager } from '../src/domain/safety/HumanTakeoverManager.js';
import { createSafetyMiddleware } from '../src/pipeline/middlewares/SafetyMiddleware.js';
import { MessageDebounceManager } from '../src/pipeline/MessageDebouncer.js';
import { createAdminCommandMiddleware } from '../src/pipeline/middlewares/AdminCommandMiddleware.js';

async function runHumanTakeoverTest() {
  console.log('🧪 === بدء فحص واختبار ميزة الإيقاف التلقائي للبوت عند رد المالك بنفسه (Human Takeover) ===\n');

  const humanTakeover = new HumanTakeoverManager({ cooldownMinutes: 30 });
  const whitelistConfig = { ignoreGroups: true };
  const safetyMiddleware = createSafetyMiddleware(whitelistConfig, humanTakeover);

  const contactJid = '967711223344@s.whatsapp.net';
  const ownerJid = '967781121904@s.whatsapp.net';

  // 1. Initial State: No human takeover
  console.log('1️⃣ الحالة الأولية قبل أن يرد المالك:');
  const initialContext = {
    senderJid: contactJid,
    isSelfAdmin: false,
    text: 'السلام عليكم يا مهندس يعقوب'
  };

  let nextCalled = false;
  await safetyMiddleware(initialContext, async () => {
    nextCalled = true;
  });

  if (!nextCalled || initialContext.stopped) {
    throw new Error('❌ فشل: يجب أن يسمح الميدلوير بمرور الرسالة في البداية عندما لا يكون المالك يتحدث!');
  }
  console.log('   ✅ الرسالة مرت بشكل طبيعي لأن المالك لم يتدخل بعد.\n');

  // 2. Owner Manually Replies to Contact
  console.log('2️⃣ قيام المالك (يعقوب) بالرد شخصياً من هاتفه على جهة الاتصال:');
  humanTakeover.recordOwnerReply(contactJid);

  if (!humanTakeover.isTakeoverActive(contactJid)) {
    throw new Error('❌ فشل: لم يتم تفعيل التدخل البشري!');
  }
  console.log('   ✅ تم تسجيل التدخل البشري وتفعيل فترة التهدئة بنجاح.\n');

  // 3. Debouncer Cancellation Test
  console.log('3️⃣ اختبار إلغاء أي رسائل معلقة للمتصل في مؤقت الـ Debounce:');
  let debouncedExecuted = false;
  const debouncer = new MessageDebounceManager(1000, async () => {
    debouncedExecuted = true;
  });

  debouncer.enqueue({ senderJid: contactJid, text: 'رسالة معلقة' });
  // Owner replies, so debouncer cancels for this contact
  debouncer.cancel(contactJid);

  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (debouncedExecuted) {
    throw new Error('❌ فشل: مؤقت الـ Debounce لم يتم إلغاؤه وأرسل رداً بعد رد المالك!');
  }
  console.log('   ✅ تم إلغاء أي ردود معلقة في مؤقت الـ Debounce بنجاح تام.\n');

  // 4. Contact Replies While Owner is in Active Chat
  console.log('4️⃣ استقبال رد جديد من جهة الاتصال أثناء تحدث المالك معه:');
  const followupContext = {
    senderJid: contactJid,
    isSelfAdmin: false,
    text: 'أهلاً يا بشمهندس، بخصوص الملف اللي أرسلته لك'
  };

  nextCalled = false;
  await safetyMiddleware(followupContext, async () => {
    nextCalled = true;
  });

  if (nextCalled || !followupContext.stopped) {
    throw new Error('❌ خطأ فادح: البوت لم يتوقف وتدخل في الحوار أثناء تحدث المالك!');
  }
  console.log(`   🛑 نجاح باهر: البوت صامت وتوقف تماماً عن التدخل! السبب: [${followupContext.stopReason}]\n`);

  // 5. Test Owner Asking Self-Chat: "من اكلم"
  console.log('5️⃣ اختبار سؤال المالك في شاته الخاص: "من اكلم":');
  const dispatchedReplies = [];
  const mockWhatsapp = {
    sendMessage: async (jid, text) => {
      dispatchedReplies.push({ jid, text });
    }
  };

  const adminMiddleware = createAdminCommandMiddleware(
    { resolveScheduleContext: () => ({ name: 'متاح' }) },
    mockWhatsapp,
    [],
    null,
    { ownerName: 'يعقوب المهاجري' },
    null,
    humanTakeover
  );

  const selfContext = {
    isSelfAdmin: true,
    senderJid: ownerJid,
    text: 'من اكلم'
  };

  await adminMiddleware(selfContext, async () => {});
  console.log('   - رد المساعد على المالك:\n' + dispatchedReplies[0]?.text + '\n');

  // 6. Test Resuming Auto-Reply for this Contact
  console.log('6️⃣ اختبار استئناف الرد التلقائي: "استئناف الرد على 967711223344":');
  const resumeContext = {
    isSelfAdmin: true,
    senderJid: ownerJid,
    text: `استئناف الرد على ${contactJid.split('@')[0]}`
  };

  await adminMiddleware(resumeContext, async () => {});
  console.log('   - رد المساعد بعد طلب الاستئناف:\n' + dispatchedReplies[1]?.text);

  if (humanTakeover.isTakeoverActive(contactJid)) {
    throw new Error('❌ فشل: لم يتم تحرير الرد التلقائي!');
  }

  // Verify message now passes through safety middleware again
  const resumedContext = {
    senderJid: contactJid,
    isSelfAdmin: false,
    text: 'سلام عليكم مجدداً'
  };

  nextCalled = false;
  await safetyMiddleware(resumedContext, async () => {
    nextCalled = true;
  });

  if (!nextCalled || resumedContext.stopped) {
    throw new Error('❌ فشل: لم يعد البوت للعمل بعد الاستئناف!');
  }
  console.log('   ✅ عاد البوت للعمل والرد التلقائي على جهة الاتصال بعد الاستئناف بنجاح!\n');

  console.log('🎉 جميع اختبارات Human Takeover & Anti-Interference نجحت بنسبة 100%!');
}

runHumanTakeoverTest().catch((err) => {
  console.error('❌ خطأ في الاختبار:', err);
  process.exit(1);
});
