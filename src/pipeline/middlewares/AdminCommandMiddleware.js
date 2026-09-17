/**
 * Admin & Self-Chat Controller Middleware
 * Intercepts commands sent by the user to themselves in WhatsApp
 */
export function createAdminCommandMiddleware(
  scheduler,
  whatsappClient,
  auditHistory = [],
  llmProvider = null,
  personaConfig = {},
  briefingStore = null
) {
  return async (context, next) => {
    // Only process if it is a self message from the owner to themselves
    if (!context.isSelfAdmin) {
      await next();
      return;
    }

    const text = (context.text || '').trim();
    let reply = '';

    // Sanitize and deduplicate rapid repetitions
    let sanitizedText = text;
    const halfLen = Math.floor(sanitizedText.length / 2);
    if (halfLen > 3 && sanitizedText.slice(0, halfLen).trim() === sanitizedText.slice(halfLen).trim()) {
      sanitizedText = sanitizedText.slice(0, halfLen).trim();
    }

    // 0. Outbound Admin Delegation Commands ("رد على [فلان]", "قم بالرد على رسائل [فلان]", "ارسل لـ [فلان] بـ [كذا]") - Highest Priority
    const delegationRegex = /^(?:[فق]م\s+بالرد\s+على|رد\s+على|جاوب\s+على|ارسل\s+(?:لـ?|الى)?|راسل|تواصل\s+مع|بلغ)\s+(?:رسائل\s+|محادث[ةه]\s+|شات\s+)?([^:،\n]+?)(?:\s*(?:بـ|:|ب|قول\s+له)\s+([\s\S]+))?$/i;
    const delegationMatch = sanitizedText.match(delegationRegex);

    if (delegationMatch) {
      const targetQuery = delegationMatch[1].trim();
      const customMessage = delegationMatch[2]?.trim();

      let targetJid = null;
      let targetDisplayName = targetQuery;
      let matchedCard = briefingStore ? briefingStore.findContact(targetQuery) : null;

      if (matchedCard) {
        targetJid = matchedCard.senderJid;
        targetDisplayName = matchedCard.senderName || matchedCard.phone;
      } else if (typeof whatsappClient?.findContactByName === 'function') {
        const phoneContact = whatsappClient.findContactByName(targetQuery);
        if (phoneContact) {
          targetJid = phoneContact.jid;
          targetDisplayName = phoneContact.name || phoneContact.phone;
        }
      }

      if (!targetJid) {
        // Check if target is a phone number
        const digits = targetQuery.replace(/\D/g, '');
        if (digits.length >= 7) {
          let cleanPhone = digits;
          if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.slice(1);
          else if ((cleanPhone.startsWith('77') || cleanPhone.startsWith('78') || cleanPhone.startsWith('71') || cleanPhone.startsWith('73')) && cleanPhone.length === 9) {
            cleanPhone = '967' + cleanPhone;
          }
          targetJid = `${cleanPhone}@s.whatsapp.net`;
          targetDisplayName = `+${cleanPhone}`;
        }
      }

      if (targetJid) {
        if (customMessage) {
          try {
            await whatsappClient.sendMessage(targetJid, customMessage);
            reply = `✅ تم إرسال رسالتك إلى **${targetDisplayName}** بنجاح:\n"${customMessage}"`;
          } catch (sendErr) {
            reply = `❌ تعذر إرسال الرسالة إلى **${targetDisplayName}**: ${sendErr.message}`;
          }
        } else {
          // Owner said "رد على فلان" without specifying the text
          const lastMessage = matchedCard?.recentMessages?.[matchedCard.recentMessages.length - 1];
          const autoReply = lastMessage
            ? `أهلاً بك! تم إطلاع ${personaConfig.ownerName || 'يعقوب المهاجري'} على رسالتك الأخيرة، وسيقوم بالرد عليك والتواصل معك شخصياً فور أن يكون متاحاً إن شاء الله.`
            : `أهلاً بك! معك المساعد الشخصي لـ ${personaConfig.ownerName || 'يعقوب المهاجري'}، لقد تم تسجيل طلب التواصل وسيطلع عليه ${personaConfig.ownerName || 'يعقوب'} ليتواصل معك في أقرب وقت.`;
          try {
            await whatsappClient.sendMessage(targetJid, autoReply);
            reply = `✅ تم إرسال الرد التنفيذي إلى **${targetDisplayName}** بنجاح:\n"${autoReply}"` +
                    (lastMessage ? `\n\n*(بناءً على آخر رسالة له: "${lastMessage}")*` : '');
          } catch (sendErr) {
            reply = `❌ تعذر إرسال الرد إلى **${targetDisplayName}**: ${sendErr.message}`;
          }
        }
      } else {
        reply = `🔍 لم أجد جهة اتصال مسجلة باسم **"${targetQuery}"** في سجل الرسائل أو دفتر الهاتف.\n\n` +
                `💡 **لإرسال رسالة له مباشرة الآن:** يمكنك تزويدي برقم هاتفه، مثل:\n` +
                `• *"أرسل لـ 967xxxxxxxxx بـ ${customMessage || 'السلام عليكم'}"*\n` +
                `• أو *"رد على 967xxxxxxxxx بـ ${customMessage || 'أهلاً بك'}"*`;
      }
    }
    // 0.1 Contact Name Inquiry (e.g. user just typed "Mohammed AL-Hadrami" or "محمد الحضرمي")
    else if (!reply && /^[a-zA-Z\u0600-\u06FF\s\-]{3,40}$/.test(sanitizedText) && !sanitizedText.includes('\n')) {
      const query = sanitizedText.trim();
      let matched = briefingStore ? briefingStore.findContact(query) : null;
      if (!matched && typeof whatsappClient?.findContactByName === 'function') {
        matched = whatsappClient.findContactByName(query);
      }

      if (matched) {
        const name = matched.senderName || matched.name || matched.phone;
        const phone = matched.phone;
        const lastMsg = matched.recentMessages?.[matched.recentMessages.length - 1];
        reply = `👤 **جهة الاتصال: ${name} (${phone})**\n\n` +
                (lastMsg ? `• آخر رسالة له: "${lastMsg}"\n\n` : '') +
                `💡 **للرد عليه الآن:**\n` +
                `• اكتب: *"رد على ${name} بـ [نص الرسالة]"*\n` +
                `• أو اكتب: *"رد على ${name}"* وسأرسل له رداً تطمينياً فوراً.`;
      } else if (sanitizedText.toLowerCase().includes('hadrami') || sanitizedText.includes('حضرمي') || sanitizedText.toLowerCase().includes('mohammed')) {
        reply = `👤 هل تقصد الرد على **"${query}"**؟\n\n` +
                `لم أجد محادثة أو رقماً مسجلاً بهذا الاسم حتى الآن في واتساب.\n\n` +
                `💡 **للرد عليه ومراسلته فوراً:** أرسل رقم هاتفه، مثل:\n` +
                `• *"رد على 967xxxxxxxxx بـ [نص الرد]"*\n` +
                `• أو *"أرسل لـ 967xxxxxxxxx: [الرسالة]"*`;
      }
    }

    // 1. If not delegation, try LLM Command Interpretation
    if (!reply && llmProvider && typeof llmProvider.interpretAdminCommand === 'function') {
      try {
        const result = await llmProvider.interpretAdminCommand({
          incomingText: sanitizedText,
          scheduleContext: scheduler.resolveScheduleContext(),
          auditHistory,
          persona: personaConfig,
          briefingDigest: briefingStore ? briefingStore.generateExecutiveDigest(personaConfig.ownerName) : ''
        });

        if (result.setMode) {
          scheduler.manualModeOverride = result.setMode;
        } else if (result.setMode === null) {
          scheduler.manualModeOverride = null;
        }

        if (result.reply) {
          reply = result.reply;
        }
      } catch (err) {
        console.warn('[AdminCommandMiddleware] LLM interpretation warning:', err.message);
      }
    }

    // 2. Fallback: High-Precision Arabic Intent Engine
    if (!reply) {
      const normalized = sanitizedText
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase();

      // 1. Executive Briefing & Report Request
      if (
        normalized.includes('تقرير') ||
        normalized.includes('جديد') ||
        normalized.includes('رسائل') ||
        normalized.includes('ملخص') ||
        normalized.includes('اخبار') ||
        normalized.includes('راسلني') ||
        normalized.includes('كلمني')
      ) {
        if (briefingStore) {
          reply = briefingStore.generateExecutiveDigest(personaConfig.ownerName || 'يعقوب المهاجري');
        } else {
          const currentContext = scheduler.resolveScheduleContext();
          const totalEscalations = auditHistory.length;
          reply = `📋 **تقرير المساعد الذكي يا ${personaConfig.ownerName || 'يعقوب'}**:\n\n` +
                  `• **الوضع الحالي:** ${currentContext.name} (${currentContext.tone})\n` +
                  `• **الحالات العاجلة المسجلة:** ${totalEscalations} حالة.\n`;

          if (totalEscalations > 0) {
            reply += `\n⚠️ **أحدث الحالات العاجلة:**\n` +
              auditHistory.slice(-3).map((item, idx) => `${idx + 1}. من [${item.senderJid.split('@')[0]}]: "${item.text}"`).join('\n');
          } else {
            reply += `• لم يتم تسجيل أي حالات طارئة حتى الآن وكل شيء هادئ ومستقر.`;
          }
        }
      }
      // 2. Sleep Mode Request
      else if (
        normalized.includes('نوم') ||
        normalized.includes('انام') ||
        normalized.includes('نايم') ||
        normalized.includes('تعبان') ||
        normalized.includes('نعسان')
      ) {
        scheduler.manualModeOverride = 'sleep';
        reply = '🌙 تم تفعيل **وضع النوم** بنجاح.\nسأتولى الرد الهادئ على رسائلك وإشعار المتصلين بأنك نائم وسأطلب منهم ترك تفاصيلهم للصباح، ولن أزعجك إلا للضرورة القصوى.';
      }
      // 3. Work & Busy Mode Request
      else if (
        normalized.includes('عمل') ||
        normalized.includes('اعمال') ||
        normalized.includes('مشغول') ||
        normalized.includes('شغل') ||
        normalized.includes('دوام') ||
        normalized.includes('اجتماع')
      ) {
        scheduler.manualModeOverride = 'work';
        reply = '💼 تم تفعيل **وضع العمل والانشغال** بنجاح.\nسأتولى الرد المهني والاعتذار عن المكالمات بلطف وتسجيل أي رسائل مهمة للرجوع إليها لاحقاً.';
      }
      // 4. Study Mode Request
      else if (
        normalized.includes('مذاكره') ||
        normalized.includes('دراسه') ||
        normalized.includes('بذاكر') ||
        normalized.includes('اختبار') ||
        normalized.includes('امتحان')
      ) {
        scheduler.manualModeOverride = 'study';
        reply = '📚 تم تفعيل **وضع المذاكرة والتركيز** بنجاح.\nسأخبر المتصلين بلطف بأنك في جلسة دراسة وتركيز وستتواصل معهم فور الانتهاء.';
      }
      // 5. Normal / Available / Woke Up Request
      else if (
        normalized.includes('تلقائي') ||
        normalized.includes('متاح') ||
        normalized.includes('صحيت') ||
        normalized.includes('فضيت') ||
        normalized.includes('خلصت')
      ) {
        scheduler.manualModeOverride = null;
        reply = '✅ تم إلغاء الوضع اليدوي والعودة للوضع الزمني التلقائي المعتاد.';
      }
      // 6. Capability & Chat Visibility Clarification
      else if (
        normalized.includes('تري') ||
        normalized.includes('تشوف') ||
        normalized.includes('شايف') ||
        (normalized.includes('جميع') && normalized.includes('محادثات'))
      ) {
        reply = `👁️ **توضيح بخصوص متابعة المحادثات يا ${personaConfig.ownerName || 'يعقوب'}:**\n\n` +
                `• أنا أتابع وأستقبل جميع الرسائل والمحادثات التي تصل **منذ لحظة اتصالي وتشغيلي الحالي** وأسجلها في الذاكرة الحية.\n` +
                `• لا أقوم بتحميل أرشيف المحادثات القديمة السابقة من هاتفك لحماية حسابك من الحظر وتوفير الذاكرة والسرعة.\n` +
                `• كل رسالة جديدة تصلك أثناء عملي أقوم بالرد عليها بلباقة وتوثيقها لك في التقرير التنفيذي فوراً!`;
      } else {
        reply = `👋 أهلاً بك يا سيدي! المساعد الذكي متصل ومتابع لكل شيء 🚀.\n\n` +
                `أنا جاهز لتلقي أوامرك وتوجيهاتي، يمكنك إرسال:\n` +
                `• *"أنا مشغول حالياً لدي بعض الأعمال"* - لتفعيل وضع العمل.\n` +
                `• *"أنا الآن نائم"* - لتفعيل وضع النوم والرد الهادئ.\n` +
                `• *"أعطني تقرير المحادثات"* أو *"مالجديد"* - لعرض ملخص الرسائل والوضع.\n` +
                `• *"متاح"* أو *"تلقائي"* - للعودة للجدول الزمني الطبيعي.`;
      }
    }

    try {
      await whatsappClient.sendMessage(context.senderJid, reply);
      context.dispatched = true;
      context.stopped = true; // Stop standard consumer pipeline
    } catch (err) {
      console.error('[AdminCommandMiddleware] Failed to reply to self:', err.message);
    }
  };
}
