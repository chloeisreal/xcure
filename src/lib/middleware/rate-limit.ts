interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class MemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  
  constructor(
    private windowMs: number = 60000,
    private maxRequests: number = 100
  ) {}
  
  check(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);
    
    if (!entry || now > entry.resetTime) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetIn: this.windowMs,
      };
    }
    
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetTime - now,
      };
    }
    
    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    };
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new MemoryRateLimiter(
  60 * 1000,  // 1 minute window
  100        // 100 requests per minute (Vercel hobby limit)
);

export function getClientId(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

export function rateLimitMiddleware(
  req: Request,
  maxRequests: number = 100,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetIn: number } | null {
  const clientId = getClientId(req);
  const limiter = new MemoryRateLimiter(
    windowSeconds * 1000,
    maxRequests
  );
  return limiter.check(clientId);
}