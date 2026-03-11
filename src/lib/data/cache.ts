import { CACHE_KEYS, CACHE_TTL } from './types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;
    
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = (now - entry.timestamp) / 1000;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();

export async function cacheGet<T>(key: string): Promise<T | null> {
  return memoryCache.get<T>(key);
}

export async function cacheSet<T>(key: string, data: T, ttl?: number): Promise<void> {
  memoryCache.set(key, data, ttl || 3600);
}

export async function cacheDelete(key: string): Promise<void> {
  memoryCache.delete(key);
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':');
}
