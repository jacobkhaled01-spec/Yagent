/**
 * Schedule & Temporal Context Middleware
 * Enriches the pipeline context with the active schedule mode
 */
export function createScheduleMiddleware(temporalScheduler) {
  return async (context, next) => {
    const text = context.text || '';
    context.scheduleContext = temporalScheduler.resolveScheduleContext(text);
    await next();
  };
}
