// Ersatz für "cloudflare:workers" in Node-Tests
export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
