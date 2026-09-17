/**
 * Safety & Filtering Middleware
 * Guards against banned contacts, groups, and unwanted broadcast spam
 */
export function createSafetyMiddleware(whitelistConfig) {
  return async (context, next) => {
    // Owner messaging themselves always bypasses all filters
    if (context.isSelfAdmin) {
      await next();
      return;
    }

    const { senderJid, isGroup, isBroadcast } = context;

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
