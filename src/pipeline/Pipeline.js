/**
 * Middleware Pipeline Engine
 * Executes chained middleware steps with clean error isolation
 */
export class Pipeline {
  constructor(middlewares = []) {
    this.middlewares = middlewares;
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context) {
    let index = -1;

    const runner = async (i) => {
      if (i <= index) {
        throw new Error('next() called multiple times in same middleware step');
      }
      index = i;

      if (context.stopped) {
        return;
      }

      const middleware = this.middlewares[i];
      if (!middleware) {
        return;
      }

      await middleware(context, () => runner(i + 1));
    };

    await runner(0);
    return context;
  }
}
