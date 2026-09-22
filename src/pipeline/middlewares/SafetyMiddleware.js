/**
 * Safety & Filtering Middleware
 * Guards against banned contacts, groups, unwanted broadcast spam,
 * and active Human Owner Takeover (anti-interference).
 */
export function createSafetyMiddleware(whitelistConfig, humanTakeoverManager = null) {
  return async (context, next) => {
    // Owner messaging themselves always bypasses all filters
    if (context.isSelfAdmin) {
      await next();
      return;
    }

    const { senderJid, isGroup, isBroadcast } = context;

    // Human Takeover Anti-Interference: Suppress auto-reply if owner is chatting manually
    if (humanTakeoverManager && humanTakeoverManager.isTakeoverActive(senderJid)) {
      console.log(`[SafetyMiddleware] 🛑 Auto-reply suppressed for ${senderJid} (Active manual chat by owner).`);
      context.stopped = true;
      context.stopReason = 'Ignored: Owner is actively chatting with contact';
      return;
    }

    // Ignore group chats if configured
    if (isGroup && whitelistConfig.ignoreGroups) {
      context.stopped = true;
      context.stopReason = 'Ignored: Group message';
      return;
    }

    // Ignore broadcasts / status updates
    if (isBroadcast && whitelistConfig.ignoreBroadcasts) {
      context.stopped = true;
      context.stopReason = 'Ignored: Broadcast message';
      return;
    }

    // Blacklist check
    if (whitelistConfig.blacklist && whitelistConfig.blacklist.includes(senderJid)) {
      context.stopped = true;
      context.stopReason = 'Ignored: Sender is blacklisted';
      return;
    }

    // Whitelist check if mode is 'whitelist_only'
    if (whitelistConfig.mode === 'whitelist_only') {
      if (!whitelistConfig.whitelist || !whitelistConfig.whitelist.includes(senderJid)) {
        context.stopped = true;
        context.stopReason = 'Ignored: Sender is not in whitelist';
        return;
      }
    }

    await next();
  };
}
